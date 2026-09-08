import {
  AUDIO_CUES,
  CORE_AUDIO_ASSET_IDS,
  cueAssetIds,
  type TraversalAudioEvent
} from "./TraversalAudioManifest";
import {
  traversalAudioEngine,
  type TraversalAudioLoopHandle,
  type TraversalVolumeSnapshot
} from "./TraversalAudioEngine";

export type { TraversalAudioEvent } from "./TraversalAudioManifest";
export type { TraversalAudioLoopHandle } from "./TraversalAudioEngine";

export type TraversalAudioDetail = {
  campaign?: boolean;
  intensity?: number;
  variant?: string;
  /** World-space emitter position. Only used by cues declared `positional`. */
  position?: { x: number; y: number; z: number };
};

const AUDIO_EVENT = "traversal:audio";
let installed = false;

/**
 * Canonical semantic SFX seam. Gameplay code emits meaning, not filenames and not
 * oscillator instructions.
 *
 * Playback order per event:
 *   1. Authored samples from `TraversalAudioManifest`, layered/alternated as the
 *      manifest specifies, through the shared bus graph.
 *   2. If the assets are not resident or failed to load, the procedural tone layer
 *      below. It is a deliberate fallback, not dead code: several of these cues are
 *      the only non-visual confirmation that a state change happened, and silence
 *      would read as "nothing happened".
 */
export function emitTraversalAudio(
  event: TraversalAudioEvent,
  detail: TraversalAudioDetail = {}
): void {
  ensureTraversalAudioRuntime();
  window.dispatchEvent(new CustomEvent(AUDIO_EVENT, { detail: { event, ...detail } }));
}

/** Positional variant. Non-positional cues ignore the position and play head-locked. */
export function emitTraversalAudioAt(
  event: TraversalAudioEvent,
  position: { x: number; y: number; z: number },
  detail: TraversalAudioDetail = {}
): void {
  emitTraversalAudio(event, { ...detail, position: { x: position.x, y: position.y, z: position.z } });
}

export function ensureTraversalAudioRuntime(): void {
  if (installed) return;
  installed = true;
  window.addEventListener(AUDIO_EVENT, onAudioEvent as EventListener);
}

/**
 * Points the whole graph at the Shell's Master / Music / SFX sliders. Until this
 * is called the engine runs at unity, so audio never depends on boot ordering.
 */
export function configureTraversalAudio(volumes: () => TraversalVolumeSnapshot): void {
  ensureTraversalAudioRuntime();
  traversalAudioEngine.configure(volumes);
}

/** Fold the final master mix so both output channels carry the same information. */
export function setTraversalAudioMono(enabled: boolean): void {
  traversalAudioEngine.setMono(enabled);
}

/**
 * Suspend or resume playback for one lifecycle reason. Reasons stack, so returning
 * to the game cannot resume audio while the document is still hidden or unfocused.
 */
export function setTraversalAudioSuspended(reason: string, suspended: boolean): void {
  traversalAudioEngine.setSuspended(reason, suspended);
}

/** High-frequency, always-needed cues. Small enough to sit in the boot bundle. */
export function preloadCoreTraversalAudio(): Promise<void> {
  ensureTraversalAudioRuntime();
  return traversalAudioEngine.load(CORE_AUDIO_ASSET_IDS);
}

/** Per-room lazy load, driven by what the room actually contains. */
export function preloadTraversalAudioEvents(events: readonly TraversalAudioEvent[]): Promise<void> {
  ensureTraversalAudioRuntime();
  const assets = new Set<string>();
  for (const event of events) {
    const cue = AUDIO_CUES[event];
    if (!cue) continue;
    for (const asset of cueAssetIds(cue)) assets.add(asset);
  }
  return traversalAudioEngine.load([...assets]);
}

export function startTraversalAudioLoop(
  event: TraversalAudioEvent,
  position: { x: number; y: number; z: number }
): TraversalAudioLoopHandle | null {
  ensureTraversalAudioRuntime();
  return traversalAudioEngine.startLoop(event, position);
}

export function updateTraversalAudioListener(
  position: { x: number; y: number; z: number },
  forward: { x: number; y: number; z: number },
  up: { x: number; y: number; z: number }
): void {
  traversalAudioEngine.syncSettings();
  traversalAudioEngine.setListener(position, forward, up);
}

function onAudioEvent(raw: Event): void {
  const custom = raw as CustomEvent<TraversalAudioDetail & { event: TraversalAudioEvent }>;
  const detail = custom.detail;
  const event = detail?.event;
  if (!event) return;

  try {
    const variant = detail.variant ?? sectorVariant(event, detail);
    const played = traversalAudioEngine.play(event, {
      position: detail.position,
      variant,
      gain: detail.intensity
    });
    if (!played) playProcedural(event, detail);
  } catch {
    // Audio is presentation-only and must never affect gameplay.
  }
}

/**
 * Campaign and the timed/challenge modes get different sector-entry takes rather
 * than a round-robin, which is what the two authored `sector_enter` files are for.
 */
function sectorVariant(event: TraversalAudioEvent, detail: TraversalAudioDetail): string | undefined {
  if (event !== "sector.enter") return undefined;
  return detail.campaign ? "sector-enter-campaign" : "sector-enter-course";
}

// ---------------------------------------------------------------------------
// Procedural fallback layer.
//
// Retained deliberately. Every cue that confirms a state change the player cannot
// otherwise hear has an entry here, so a failed asset download degrades to a
// weaker sound rather than to silence.
// ---------------------------------------------------------------------------

function playProcedural(event: TraversalAudioEvent, detail: TraversalAudioDetail): void {
  const bus = traversalAudioEngine.busNode(AUDIO_CUES[event]?.bus ?? "sfx");
  const ctx = bus?.context as AudioContext | undefined;
  if (!bus || !ctx) return;

  switch (event) {
    case "rifle.fire":
      // Preserve the certified rifle report: low body, electrical crack,
      // restrained mechanical close.
      tone(ctx, bus, 138, 44, 0.145, "sine", 0.125);
      tone(ctx, bus, 510, 150, 0.105, "sawtooth", 0.062, 0.004);
      tone(ctx, bus, 1680, 690, 0.055, "triangle", 0.027, 0.007);
      noise(ctx, bus, 0.105, 0.072, 560, "lowpass");
      noise(ctx, bus, 0.045, 0.028, 3000, "highpass");
      tone(ctx, bus, 230, 120, 0.055, "triangle", 0.032, 0.105);
      tone(ctx, bus, 820, 410, 0.035, "square", 0.012, 0.132);
      return;

    case "sector.clear":
      tone(ctx, bus, 92, 54, 0.28, "sine", 0.16);
      tone(ctx, bus, 310, 470, 0.18, "triangle", 0.055, 0.035);
      return;

    case "sector.enter":
      tone(
        ctx,
        bus,
        detail.campaign ? 660 : 560,
        detail.campaign ? 880 : 720,
        0.22,
        "sine",
        detail.campaign ? 0.045 : 0.03,
        0.08,
        0.42
      );
      return;

    case "hazard.hit":
      tone(ctx, bus, 104, 46, 0.18, "sawtooth", 0.07);
      noise(ctx, bus, 0.12, 0.04, 760, "bandpass");
      return;

    case "landing.adjust":
      tone(ctx, bus, 760, 620, 0.025, "triangle", 0.012);
      return;

    case "sphere.resolve":
      tone(ctx, bus, 430, 820, 0.09, "sine", 0.05);
      tone(ctx, bus, 690, 1120, 0.075, "triangle", 0.032, 0.018);
      return;

    case "vector.write":
      tone(ctx, bus, 520, 960, 0.11, "sine", 0.032, 0.025);
      tone(ctx, bus, 820, 1460, 0.08, "triangle", 0.02, 0.045);
      return;

    case "warp.commit":
    case "rewind.begin":
      tone(ctx, bus, 126, 38, 0.2, "sawtooth", 0.085);
      tone(ctx, bus, 900, 190, 0.16, "triangle", 0.045);
      noise(ctx, bus, 0.18, 0.055, 720, "bandpass");
      return;

    case "warp.arrive":
    case "rewind.arrive":
      tone(ctx, bus, 150, 64, 0.13, "sine", 0.09);
      tone(ctx, bus, 1320, 430, 0.085, "triangle", 0.045);
      noise(ctx, bus, 0.065, 0.07, 2400, "highpass");
      return;

    case "shield.reject":
      tone(ctx, bus, 360, 120, 0.11, "square", 0.045);
      noise(ctx, bus, 0.04, 0.028, 1500, "bandpass");
      return;

    // Utility-actor resolves are fairness-critical: the flash message and this
    // sound are the only two signals that a Cube/Diamond/Prism kill did anything.
    // Each keeps a distinct interval so the three stay tellable apart by ear.
    case "actor.cube":
      tone(ctx, bus, 300, 150, 0.16, "square", 0.05);
      tone(ctx, bus, 600, 300, 0.12, "triangle", 0.03, 0.02);
      return;

    case "actor.diamond":
      tone(ctx, bus, 420, 840, 0.16, "triangle", 0.05);
      tone(ctx, bus, 630, 1260, 0.12, "sine", 0.03, 0.03);
      return;

    case "actor.prism":
      tone(ctx, bus, 520, 390, 0.14, "sine", 0.05);
      tone(ctx, bus, 780, 1170, 0.16, "triangle", 0.032, 0.04);
      return;

    case "achievement.unlock":
      tone(ctx, bus, 440, 660, 0.12, "sine", 0.025);
      tone(ctx, bus, 660, 990, 0.14, "sine", 0.02, 0.09);
      return;

    case "exit.online":
      tone(ctx, bus, 180, 360, 0.34, "sine", 0.07);
      tone(ctx, bus, 540, 720, 0.28, "triangle", 0.03, 0.05);
      return;

    case "hazard.field-on":
    case "hazard.gate-close":
    case "hazard.cycle":
      tone(ctx, bus, 220, 120, 0.13, "sawtooth", 0.035);
      return;

    case "hazard.field-off":
    case "hazard.gate-open":
      tone(ctx, bus, 140, 260, 0.13, "sine", 0.03);
      return;

    case "hazard.sweep":
      noise(ctx, bus, 0.16, 0.04, 1400, "bandpass");
      return;

    case "hazard.aperture-shift":
    case "platform.activate":
      tone(ctx, bus, 96, 148, 0.3, "sine", 0.06);
      noise(ctx, bus, 0.22, 0.03, 520, "lowpass");
      return;

    case "ui.confirm":
      tone(ctx, bus, 620, 930, 0.07, "sine", 0.03);
      return;

    case "ui.back":
      tone(ctx, bus, 520, 340, 0.07, "sine", 0.028);
      return;

    case "ui.select":
      tone(ctx, bus, 880, 900, 0.03, "sine", 0.008);
      return;

    case "route.fail":
      tone(ctx, bus, 260, 190, 0.1, "square", 0.03);
      tone(ctx, bus, 170, 120, 0.16, "sawtooth", 0.035, 0.05);
      return;

    // Ambient bed only. Silence here costs the player no information the lit
    // gravity ring and the HUD objective line do not already give them.
    case "exit.enter":
    case "exit.loop":
      return;
  }
}

function tone(
  ctx: AudioContext,
  destination: AudioNode,
  startFrequency: number,
  endFrequency: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  delay = 0,
  releaseDuration = duration
): void {
  const start = ctx.currentTime + delay;
  const end = start + duration;
  const releaseEnd = start + Math.max(duration, releaseDuration);
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(1, startFrequency), start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), end);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(0.018, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(releaseEnd + 0.02);
  oscillator.onended = () => {
    gain.disconnect();
    oscillator.disconnect();
  };
}

function noise(
  ctx: AudioContext,
  destination: AudioNode,
  duration: number,
  volume: number,
  frequency: number,
  type: BiquadFilterType
): void {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i += 1) channel[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  source.buffer = buffer;
  filter.type = type;
  filter.frequency.value = frequency;
  gain.gain.setValueAtTime(Math.max(0.0002, volume), now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter).connect(gain).connect(destination);
  source.start(now);
  source.stop(now + duration + 0.01);
  source.onended = () => {
    gain.disconnect();
    filter.disconnect();
    source.disconnect();
  };
}

ensureTraversalAudioRuntime();
