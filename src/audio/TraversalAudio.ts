export type TraversalAudioEvent =
  | "rifle.fire"
  | "vector.write"
  | "warp.commit"
  | "warp.arrive"
  | "landing.adjust"
  | "sphere.resolve"
  | "shield.reject"
  | "hazard.hit"
  | "hazard.cycle"
  | "sector.clear"
  | "sector.enter"
  | "achievement.unlock"
  | "ui.confirm"
  | "ui.back";

export type TraversalAudioDetail = {
  campaign?: boolean;
  intensity?: number;
  variant?: string;
};

const AUDIO_EVENT = "traversal:audio";
let installed = false;
let context: AudioContext | null = null;

/**
 * Canonical semantic SFX seam. Gameplay code emits meaning, not oscillator
 * instructions. Procedural placeholders live here today; authored samples can
 * replace individual events later without touching gameplay systems.
 */
export function emitTraversalAudio(
  event: TraversalAudioEvent,
  detail: TraversalAudioDetail = {}
): void {
  ensureTraversalAudioRuntime();
  window.dispatchEvent(new CustomEvent(AUDIO_EVENT, { detail: { event, ...detail } }));
}

export function ensureTraversalAudioRuntime(): void {
  if (installed) return;
  installed = true;
  window.addEventListener(AUDIO_EVENT, onAudioEvent as EventListener);
}

function onAudioEvent(raw: Event): void {
  const custom = raw as CustomEvent<TraversalAudioDetail & { event: TraversalAudioEvent }>;
  const event = custom.detail?.event;
  if (!event) return;

  try {
    context ??= new AudioContext();
    const ctx = context;
    void ctx.resume();
    playEvent(ctx, event, custom.detail);
  } catch {
    // Audio is presentation-only and must never affect gameplay.
  }
}

function playEvent(
  ctx: AudioContext,
  event: TraversalAudioEvent,
  detail: TraversalAudioDetail
): void {
  switch (event) {
    case "rifle.fire":
      // Preserve the certified rifle report: low body, electrical crack,
      // restrained mechanical close.
      tone(ctx, 138, 44, 0.145, "sine", 0.125);
      tone(ctx, 510, 150, 0.105, "sawtooth", 0.062, 0.004);
      tone(ctx, 1680, 690, 0.055, "triangle", 0.027, 0.007);
      noise(ctx, 0.105, 0.072, 560, "lowpass");
      noise(ctx, 0.045, 0.028, 3000, "highpass");
      tone(ctx, 230, 120, 0.055, "triangle", 0.032, 0.105);
      tone(ctx, 820, 410, 0.035, "square", 0.012, 0.132);
      return;

    case "sector.clear":
      tone(ctx, 92, 54, 0.28, "sine", 0.16);
      tone(ctx, 310, 470, 0.18, "triangle", 0.055, 0.035);
      return;

    case "sector.enter":
      tone(
        ctx,
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
      tone(ctx, 104, 46, 0.18, "sawtooth", 0.07);
      noise(ctx, 0.12, 0.04, 760, "bandpass");
      return;

    case "landing.adjust":
      tone(ctx, 760, 620, 0.025, "triangle", 0.012);
      return;

    case "sphere.resolve":
      tone(ctx, 420, 720, 0.09, "sine", 0.025);
      return;

    case "achievement.unlock":
      tone(ctx, 440, 660, 0.12, "sine", 0.025);
      tone(ctx, 660, 990, 0.14, "sine", 0.02, 0.09);
      return;

    // These canonical names are reserved now so gameplay can target a stable
    // vocabulary before final authored audio replaces the procedural layer.
    case "vector.write":
    case "warp.commit":
    case "warp.arrive":
    case "shield.reject":
    case "hazard.cycle":
    case "ui.confirm":
    case "ui.back":
      return;
  }
}

function tone(
  ctx: AudioContext,
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
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(releaseEnd + 0.02);
}

function noise(
  ctx: AudioContext,
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
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(now);
  source.stop(now + duration + 0.01);
}

ensureTraversalAudioRuntime();
