import {
  AUDIO_CUES,
  audioAsset,
  type AudioBus,
  type AudioCueSpec,
  type TraversalAudioEvent
} from "./TraversalAudioManifest";

export interface TraversalVolumeSnapshot {
  master: number;
  music: number;
  sfx: number;
}

export interface TraversalAudioLoopHandle {
  /** 0..1, relative to the cue's authored gain. Ramped, never stepped. */
  setIntensity(intensity: number): void;
  setPosition(x: number, y: number, z: number): void;
  stop(): void;
}

type BusNodes = Record<AudioBus, GainNode>;

const AUDIO_BASE = "/audio/";
const LISTENER_LERP = 0.28;
const VOICE_DEFAULT_LIMIT = 8;

/**
 * The single WebAudio graph for the game.
 *
 * destination <- master <- { sfx, ui, world, music }
 *
 * Every sound in the game — authored sample, procedural fallback, positional
 * hazard, looping bed — is connected to one of those four buses, so the Shell's
 * Master / Music / SFX sliders stay accurate for all of it. Nothing connects to
 * `context.destination` directly.
 */
class TraversalAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: BusNodes | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly pending = new Map<string, Promise<AudioBuffer | null>>();
  private readonly failed = new Set<string>();
  private readonly cursors = new Map<string, number>();
  private readonly cooldowns = new Map<string, number>();
  private readonly voices = new Map<string, number>();
  private volumes: () => TraversalVolumeSnapshot = () => ({ master: 1, music: 1, sfx: 1 });
  private lastVolumes = "";
  private unlockBound = false;

  configure(volumes: () => TraversalVolumeSnapshot): void {
    this.volumes = volumes;
    this.syncVolumes(true);
  }

  /**
   * Browsers refuse to start an AudioContext outside a user gesture. Creating it
   * lazily and resuming on the first interaction keeps the very first shot audible
   * instead of swallowing it.
   */
  ensureContext(): AudioContext | null {
    if (this.context) {
      if (this.context.state === "suspended") void this.context.resume();
      return this.context;
    }

    try {
      const context = new AudioContext();
      const master = context.createGain();
      master.connect(context.destination);

      const makeBus = (): GainNode => {
        const gain = context.createGain();
        gain.connect(master);
        return gain;
      };

      this.context = context;
      this.master = master;
      this.buses = { sfx: makeBus(), ui: makeBus(), world: makeBus(), music: makeBus() };
      this.bindUnlock();
      this.syncVolumes(true);
      return context;
    } catch {
      // Audio is presentation-only and must never affect gameplay.
      return null;
    }
  }

  private bindUnlock(): void {
    if (this.unlockBound) return;
    this.unlockBound = true;
    const unlock = () => {
      if (this.context?.state === "suspended") void this.context.resume();
    };
    for (const type of ["pointerdown", "keydown", "touchstart"]) {
      window.addEventListener(type, unlock, { passive: true });
    }
  }

  /** Bus node for callers that generate their own sound (the procedural fallback). */
  busNode(bus: AudioBus): GainNode | null {
    this.ensureContext();
    this.syncVolumes(false);
    return this.buses?.[bus] ?? null;
  }

  private syncVolumes(force: boolean): void {
    if (!this.master || !this.buses || !this.context) return;
    const { master, music, sfx } = this.volumes();
    const key = `${master}|${music}|${sfx}`;
    if (!force && key === this.lastVolumes) return;
    this.lastVolumes = key;

    const now = this.context.currentTime;
    const ramp = (node: GainNode, value: number) => {
      node.gain.cancelScheduledValues(now);
      node.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), now, 0.02);
    };
    ramp(this.master, master);
    ramp(this.buses.sfx, sfx);
    ramp(this.buses.ui, sfx);
    ramp(this.buses.world, sfx);
    ramp(this.buses.music, music);
  }

  /** Call once per frame so volume changes and the 3D listener stay live. */
  syncSettings(): void {
    this.syncVolumes(false);
  }

  isLoaded(assetId: string): boolean {
    return this.buffers.has(assetId);
  }

  hasFailed(assetId: string): boolean {
    return this.failed.has(assetId);
  }

  async load(assetIds: readonly string[]): Promise<void> {
    await Promise.all(assetIds.map((id) => this.loadOne(id)));
  }

  private loadOne(assetId: string): Promise<AudioBuffer | null> {
    const existing = this.buffers.get(assetId);
    if (existing) return Promise.resolve(existing);
    const inFlight = this.pending.get(assetId);
    if (inFlight) return inFlight;
    if (this.failed.has(assetId)) return Promise.resolve(null);

    const spec = audioAsset(assetId);
    const context = this.ensureContext();
    if (!spec || !context) {
      this.failed.add(assetId);
      return Promise.resolve(null);
    }

    const request = (async () => {
      try {
        const response = await fetch(`${AUDIO_BASE}${spec.file}`);
        if (!response.ok) throw new Error(`${response.status}`);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(assetId, buffer);
        return buffer;
      } catch {
        // A missing or undecodable asset falls back to the procedural layer
        // rather than going silent. See TraversalAudio.playProcedural.
        this.failed.add(assetId);
        return null;
      } finally {
        this.pending.delete(assetId);
      }
    })();

    this.pending.set(assetId, request);
    return request;
  }

  /**
   * @returns true when at least one authored layer played. False tells the caller
   * to fall back to the procedural tone layer.
   */
  play(
    event: TraversalAudioEvent,
    options: { position?: { x: number; y: number; z: number }; variant?: string; gain?: number } = {}
  ): boolean {
    const cue = AUDIO_CUES[event];
    if (!cue || cue.loop) return false;

    const context = this.ensureContext();
    const bus = this.buses?.[cue.bus];
    if (!context || !bus) return false;
    this.syncVolumes(false);

    const now = performance.now();
    if (cue.cooldownMs) {
      const readyAt = this.cooldowns.get(event) ?? 0;
      if (now < readyAt) return true;
      this.cooldowns.set(event, now + cue.cooldownMs);
    }

    const limit = cue.maxVoices ?? VOICE_DEFAULT_LIMIT;
    if ((this.voices.get(event) ?? 0) >= limit) return true;

    const rate = cue.pitchJitter ? 1 + (Math.random() * 2 - 1) * cue.pitchJitter : 1;
    const destination = options.position && cue.positional
      ? this.createPanner(context, options.position, bus)
      : bus;

    let played = false;
    let longest = 0;

    for (const slot of cue.slots) {
      const assetId = this.pickAsset(event, slot.assets, slot.pick, options.variant);
      if (!assetId) continue;
      const buffer = this.buffers.get(assetId);
      if (!buffer) {
        // Not resident yet: warm it so the next trigger is authored audio.
        void this.loadOne(assetId);
        continue;
      }

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      const gain = context.createGain();
      gain.gain.value = (cue.gain ?? 1) * (slot.gain ?? 1) * (options.gain ?? 1);
      source.connect(gain).connect(destination);
      source.start(context.currentTime + (slot.delaySeconds ?? 0));
      played = true;
      longest = Math.max(longest, (slot.delaySeconds ?? 0) + buffer.duration / rate);

      source.onended = () => {
        gain.disconnect();
        source.disconnect();
      };
    }

    if (!played) {
      if (destination !== bus) (destination as PannerNode).disconnect();
      return false;
    }

    this.voices.set(event, (this.voices.get(event) ?? 0) + 1);
    window.setTimeout(() => {
      this.voices.set(event, Math.max(0, (this.voices.get(event) ?? 1) - 1));
      if (destination !== bus) (destination as PannerNode).disconnect();
    }, (longest + 0.1) * 1000);

    return true;
  }

  startLoop(
    event: TraversalAudioEvent,
    position: { x: number; y: number; z: number }
  ): TraversalAudioLoopHandle | null {
    const cue = AUDIO_CUES[event];
    const context = this.ensureContext();
    const bus = this.buses?.[cue?.bus ?? "world"];
    if (!cue?.loop || !context || !bus) return null;

    const assetId = cue.slots[0]?.assets[0];
    if (!assetId) return null;

    const gain = context.createGain();
    gain.gain.value = 0;
    const panner = cue.positional ? this.createPanner(context, position, bus) : null;
    gain.connect(panner ?? bus);

    let source: AudioBufferSourceNode | null = null;
    let stopped = false;
    let intensity = 0;

    const attach = (buffer: AudioBuffer) => {
      if (stopped) return;
      source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      source.start();
      applyIntensity();
    };

    const applyIntensity = () => {
      if (stopped) return;
      const target = (cue.gain ?? 1) * Math.max(0, Math.min(1, intensity));
      gain.gain.setTargetAtTime(target, context.currentTime, 0.18);
    };

    void this.loadOne(assetId).then((buffer) => {
      if (buffer) attach(buffer);
    });

    return {
      setIntensity(value: number) {
        intensity = value;
        applyIntensity();
      },
      setPosition(x: number, y: number, z: number) {
        if (!panner) return;
        setPannerPosition(panner, context, x, y, z);
      },
      stop() {
        if (stopped) return;
        stopped = true;
        gain.gain.setTargetAtTime(0, context.currentTime, 0.12);
        const node = source;
        window.setTimeout(() => {
          try {
            node?.stop();
          } catch {
            // already stopped
          }
          node?.disconnect();
          gain.disconnect();
          panner?.disconnect();
        }, 400);
      }
    };
  }

  setListener(
    position: { x: number; y: number; z: number },
    forward: { x: number; y: number; z: number },
    up: { x: number; y: number; z: number }
  ): void {
    const context = this.context;
    if (!context) return;
    const listener = context.listener;
    const now = context.currentTime;

    if (listener.positionX) {
      // setTargetAtTime smooths the per-frame camera jitter that would otherwise
      // zipper the panning of a nearby hazard.
      listener.positionX.setTargetAtTime(position.x, now, LISTENER_LERP * 0.1);
      listener.positionY.setTargetAtTime(position.y, now, LISTENER_LERP * 0.1);
      listener.positionZ.setTargetAtTime(position.z, now, LISTENER_LERP * 0.1);
      listener.forwardX.setTargetAtTime(forward.x, now, LISTENER_LERP * 0.1);
      listener.forwardY.setTargetAtTime(forward.y, now, LISTENER_LERP * 0.1);
      listener.forwardZ.setTargetAtTime(forward.z, now, LISTENER_LERP * 0.1);
      listener.upX.setTargetAtTime(up.x, now, LISTENER_LERP * 0.1);
      listener.upY.setTargetAtTime(up.y, now, LISTENER_LERP * 0.1);
      listener.upZ.setTargetAtTime(up.z, now, LISTENER_LERP * 0.1);
      return;
    }

    const legacy = listener as AudioListener & {
      setPosition?: (x: number, y: number, z: number) => void;
      setOrientation?: (fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) => void;
    };
    legacy.setPosition?.(position.x, position.y, position.z);
    legacy.setOrientation?.(forward.x, forward.y, forward.z, up.x, up.y, up.z);
  }

  private createPanner(
    context: AudioContext,
    position: { x: number; y: number; z: number },
    bus: GainNode
  ): PannerNode {
    const panner = context.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    // Tuned so a hazard stays legible across a whole room rather than fading to
    // nothing: this is an information channel, not ambience.
    panner.refDistance = 6;
    panner.rolloffFactor = 0.9;
    panner.maxDistance = 110;
    setPannerPosition(panner, context, position.x, position.y, position.z);
    panner.connect(bus);
    return panner;
  }

  private pickAsset(
    event: TraversalAudioEvent,
    assets: readonly string[],
    pick: "cycle" | "random" | undefined,
    variant: string | undefined
  ): string | undefined {
    if (assets.length === 0) return undefined;
    if (assets.length === 1) return assets[0];
    if (variant && assets.includes(variant)) return variant;
    if (pick === "random") return assets[Math.floor(Math.random() * assets.length)];
    if (pick === "cycle") {
      const key = `${event}:${assets.join(",")}`;
      const next = ((this.cursors.get(key) ?? -1) + 1) % assets.length;
      this.cursors.set(key, next);
      return assets[next];
    }
    // No pick strategy and no variant: the first entry is the documented default.
    return assets[0];
  }
}

function setPannerPosition(
  panner: PannerNode,
  context: AudioContext,
  x: number,
  y: number,
  z: number
): void {
  if (panner.positionX) {
    const now = context.currentTime;
    panner.positionX.setTargetAtTime(x, now, 0.02);
    panner.positionY.setTargetAtTime(y, now, 0.02);
    panner.positionZ.setTargetAtTime(z, now, 0.02);
    return;
  }
  (panner as PannerNode & { setPosition?: (x: number, y: number, z: number) => void })
    .setPosition?.(x, y, z);
}

export function cueSpec(event: TraversalAudioEvent): AudioCueSpec | undefined {
  return AUDIO_CUES[event];
}

export const traversalAudioEngine = new TraversalAudioEngine();
