/**
 * Encodes the authored SFX drop into `public/audio/`.
 *
 *   npx tsx scripts/build-audio.ts "<path to the 'Traversal FPS SFX' parent folder>"
 *   TRAVERSAL_SFX_SOURCE=<path> npx tsx scripts/build-audio.ts
 *
 * Per asset: silence-trim, cap the tail at the manifest's `maxSeconds`, fade,
 * peak-limit to -3 dBFS (never boost — the authored quiet cues stay quiet), fold
 * to mono where the manifest asks for spatialisation, then encode.
 *
 * One-shots become AAC (`.m4a`) for universal decodeAudioData support. The one
 * looping bed stays WAV: AAC encoder priming inserts a click at every loop point.
 *
 * The authored WAVs are ~20MB and stay out of the repository. Only the encoded
 * output is committed, so this script is a one-shot re-run whenever the drop changes.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AUDIO_ASSETS, type AudioAssetSpec } from "../src/audio/TraversalAudioManifest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const outputDir = join(repoRoot, "public", "audio");

const SILENCE_FLOOR = 10 ** (-50 / 20);
const PEAK_CEILING = 10 ** (-3 / 20);
const PRE_ROLL_SECONDS = 0.004;
const FADE_IN_SECONDS = 0.006;
const FADE_OUT_SECONDS = 0.06;

type Pcm = { channels: number; sampleRate: number; data: Float32Array[] };

function findFfmpeg(): string {
  const candidates = [
    process.env.FFMPEG_PATH,
    join(repoRoot, "node_modules", "ffmpeg-static", "ffmpeg"),
    "/usr/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
    "ffmpeg"
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["-version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // try the next candidate
    }
  }
  throw new Error("ffmpeg not found. Set FFMPEG_PATH, or `npm i -D ffmpeg-static`.");
}

function readWav(path: string): Pcm {
  const buffer = readFileSync(path);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`${path} is not a RIFF/WAVE file`);
  }

  let offset = 12;
  let format = 1;
  let channels = 2;
  let sampleRate = 48000;
  let bits = 16;
  let dataStart = -1;
  let dataLength = 0;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      format = buffer.readUInt16LE(body);
      channels = buffer.readUInt16LE(body + 2);
      sampleRate = buffer.readUInt32LE(body + 4);
      bits = buffer.readUInt16LE(body + 14);
    } else if (id === "data") {
      dataStart = body;
      dataLength = size;
    }
    offset = body + size + (size % 2);
  }

  if (dataStart < 0) throw new Error(`${path} has no data chunk`);
  if (format !== 1 || bits !== 16) throw new Error(`${path}: expected 16-bit PCM, got format ${format} / ${bits}-bit`);

  const frames = Math.floor(dataLength / (channels * 2));
  const data = Array.from({ length: channels }, () => new Float32Array(frames));
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      data[channel]![frame] = buffer.readInt16LE(dataStart + (frame * channels + channel) * 2) / 32768;
    }
  }
  return { channels, sampleRate, data };
}

function writeWav(path: string, pcm: Pcm): void {
  const frames = pcm.data[0]!.length;
  const blockAlign = pcm.channels * 2;
  const dataLength = frames * blockAlign;
  const buffer = Buffer.alloc(44 + dataLength);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(pcm.channels, 22);
  buffer.writeUInt32LE(pcm.sampleRate, 24);
  buffer.writeUInt32LE(pcm.sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataLength, 40);

  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < pcm.channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, pcm.data[channel]![frame]!));
      buffer.writeInt16LE(Math.round(sample * 32767), 44 + (frame * pcm.channels + channel) * 2);
    }
  }
  writeFileSync(path, buffer);
}

/** Linear resample. Only used to shrink the low-frequency looping bed. */
function resample(pcm: Pcm, target: number): Pcm {
  if (target === pcm.sampleRate) return pcm;
  const ratio = target / pcm.sampleRate;
  const frames = Math.max(1, Math.round(pcm.data[0]!.length * ratio));
  const data = pcm.data.map((channel) => {
    const out = new Float32Array(frames);
    for (let i = 0; i < frames; i += 1) {
      const position = i / ratio;
      const index = Math.floor(position);
      const next = Math.min(channel.length - 1, index + 1);
      const blend = position - index;
      out[i] = channel[index]! * (1 - blend) + channel[next]! * blend;
    }
    return out;
  });
  return { channels: pcm.channels, sampleRate: target, data };
}

function toMono(pcm: Pcm): Pcm {
  if (pcm.channels === 1) return pcm;
  const frames = pcm.data[0]!.length;
  const mono = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < pcm.channels; channel += 1) sum += pcm.data[channel]![frame]!;
    mono[frame] = sum / pcm.channels;
  }
  return { channels: 1, sampleRate: pcm.sampleRate, data: [mono] };
}

function contentBounds(pcm: Pcm): { start: number; end: number } {
  const frames = pcm.data[0]!.length;
  const level = (frame: number): number => {
    let peak = 0;
    for (let channel = 0; channel < pcm.channels; channel += 1) {
      peak = Math.max(peak, Math.abs(pcm.data[channel]![frame]!));
    }
    return peak;
  };

  let start = 0;
  while (start < frames && level(start) < SILENCE_FLOOR) start += 1;
  let end = frames;
  while (end > start && level(end - 1) < SILENCE_FLOOR) end -= 1;
  return { start, end };
}

function slice(pcm: Pcm, start: number, end: number): Pcm {
  return {
    channels: pcm.channels,
    sampleRate: pcm.sampleRate,
    data: pcm.data.map((channel) => channel.slice(start, end))
  };
}

function applyFades(pcm: Pcm): void {
  const frames = pcm.data[0]!.length;
  const fadeIn = Math.min(Math.floor(pcm.sampleRate * FADE_IN_SECONDS), frames);
  const fadeOut = Math.min(Math.floor(pcm.sampleRate * FADE_OUT_SECONDS), frames);
  for (const channel of pcm.data) {
    for (let i = 0; i < fadeIn; i += 1) channel[i]! *= i / fadeIn;
    for (let i = 0; i < fadeOut; i += 1) {
      channel[frames - 1 - i]! *= i / fadeOut;
    }
  }
}

/** Peak-limit only. Boosting would flatten the authored dynamic range. */
function limitPeak(pcm: Pcm): number {
  let peak = 0;
  for (const channel of pcm.data) {
    for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  }
  if (peak <= PEAK_CEILING || peak === 0) return 1;
  const gain = PEAK_CEILING / peak;
  for (const channel of pcm.data) {
    for (let i = 0; i < channel.length; i += 1) channel[i]! *= gain;
  }
  return gain;
}

/**
 * Folds the tail back over the head so the buffer loops without a seam, then
 * trims the consumed tail. The result is exactly loopable end-to-start.
 */
function makeSeamless(pcm: Pcm, crossfadeSeconds: number): Pcm {
  const frames = pcm.data[0]!.length;
  const fade = Math.min(Math.floor(pcm.sampleRate * crossfadeSeconds), Math.floor(frames / 2));
  const looped = frames - fade;
  const data = pcm.data.map((channel) => {
    const out = channel.slice(0, looped);
    for (let i = 0; i < fade; i += 1) {
      // Equal-power crossfade keeps a steady-state drone at constant loudness.
      const t = i / fade;
      const head = Math.cos(t * Math.PI * 0.5);
      const tail = Math.sin(t * Math.PI * 0.5);
      out[i] = channel[i]! * tail + channel[looped + i]! * head;
    }
    return out;
  });
  return { channels: pcm.channels, sampleRate: pcm.sampleRate, data };
}

function encode(ffmpeg: string, wavPath: string, target: string, channels: number): void {
  execFileSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", wavPath,
    "-c:a", "aac",
    "-b:a", channels === 1 ? "80k" : "128k",
    "-movflags", "+faststart",
    target
  ], { stdio: "inherit" });
}

function buildAsset(ffmpeg: string, sourceRoot: string, spec: AudioAssetSpec, scratch: string): number {
  const sourcePath = join(sourceRoot, spec.source);
  if (!existsSync(sourcePath)) throw new Error(`Missing source for "${spec.id}": ${sourcePath}`);

  let pcm = readWav(sourcePath);
  if (spec.channels === 1) pcm = toMono(pcm);

  const bounds = contentBounds(pcm);
  const preRoll = Math.floor(pcm.sampleRate * PRE_ROLL_SECONDS);
  const start = Math.max(0, bounds.start - preRoll);
  const end = Math.min(bounds.end, start + Math.round(pcm.sampleRate * spec.maxSeconds));
  pcm = slice(pcm, start, Math.max(start + 1, end));

  if (spec.sampleRate) pcm = resample(pcm, spec.sampleRate);

  if (spec.loopCrossfadeSeconds) {
    pcm = makeSeamless(pcm, spec.loopCrossfadeSeconds);
  } else {
    applyFades(pcm);
  }
  limitPeak(pcm);

  const target = join(outputDir, spec.file);
  if (spec.file.endsWith(".wav")) {
    writeWav(target, pcm);
  } else {
    const wavPath = join(scratch, `${spec.id}.wav`);
    writeWav(wavPath, pcm);
    encode(ffmpeg, wavPath, target, pcm.channels);
  }

  const seconds = pcm.data[0]!.length / pcm.sampleRate;
  const bytes = statSync(target).size;
  console.log(
    `  ${spec.id.padEnd(28)} ${spec.channels === 1 ? "mono  " : "stereo"} ` +
    `${seconds.toFixed(2)}s  ${(bytes / 1024).toFixed(1)} KB`
  );
  return bytes;
}

const sourceRoot = resolve(process.argv[2] ?? process.env.TRAVERSAL_SFX_SOURCE ?? "");
if (!sourceRoot || !existsSync(sourceRoot)) {
  console.error(
    "Point this at the folder that contains `Traversal FPS SFX`:\n" +
    "  npx tsx scripts/build-audio.ts \"~/Downloads/Traversal_FPS_SFX\""
  );
  process.exit(1);
}

const ffmpeg = findFfmpeg();
const scratch = join(repoRoot, "node_modules", ".traversal-audio");
mkdirSync(outputDir, { recursive: true });
mkdirSync(scratch, { recursive: true });

const shipping = AUDIO_ASSETS.filter((spec) => !spec.unused);
console.log(`Encoding ${shipping.length} assets from ${sourceRoot}`);
let total = 0;
for (const spec of shipping) total += buildAsset(ffmpeg, sourceRoot, spec, scratch);

for (const spec of AUDIO_ASSETS) {
  if (!spec.unused) continue;
  console.log(`  ${spec.id.padEnd(28)} skipped — ${spec.unused}`);
}

console.log(`\nTotal: ${(total / 1024).toFixed(1)} KB across ${shipping.length} files.`);
