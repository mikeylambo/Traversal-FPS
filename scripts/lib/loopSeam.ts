import { readFileSync } from "node:fs";

/**
 * Lightweight end-to-start seam audit for a native loop WAV. Decodes 16-bit PCM,
 * then checks the two things a genuine gapless loop must satisfy and a mislabeled
 * one-shot fails:
 *
 *   1. Continuity — the jump from the last sample back to the first is no larger
 *      than the ordinary sample-to-sample motion at the edges (a hard step = a click).
 *   2. Edge energy — neither the head nor the tail is a silent pad, which is what a
 *      decay-to-silence one-shot dropped in and flagged as a loop would show.
 *
 * Thresholds are deliberately lenient so a real native loop passes; the point is to
 * deny certification to an asset that plainly does not wrap, not to grade mastering.
 * Returns a problem string, or null when the seam looks real.
 */
export function checkLoopSeam(file: string, expectedChannels: 1 | 2): string | null {
  const buf = readFileSync(file);
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    return "not a RIFF/WAVE file; seam cannot be verified.";
  }

  let format = -1;
  let channels = 0;
  let bits = 0;
  let dataStart = -1;
  let dataLen = 0;
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      format = buf.readUInt16LE(body);
      channels = buf.readUInt16LE(body + 2);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === "data") {
      dataStart = body;
      dataLen = Math.min(size, buf.length - body);
    }
    offset = body + size + (size % 2); // chunks are word-aligned
  }

  if (dataStart < 0 || format < 0) return "missing fmt/data chunk; seam cannot be verified.";
  if (format !== 1 || bits !== 16) return `unsupported WAV format (format ${format}, ${bits}-bit); seam check needs 16-bit PCM.`;
  if (channels !== expectedChannels) return `WAV has ${channels} channel(s) but the manifest declares ${expectedChannels}.`;

  const frames = Math.floor(dataLen / (channels * 2));
  if (frames < 2048) return "too few frames to be a loop bed.";
  const at = (frame: number, ch: number) => buf.readInt16LE(dataStart + (frame * channels + ch) * 2);

  // Overall RMS in one pass, for scaling the edge-energy test.
  let sumSq = 0;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const v = at(i, c);
      sumSq += v * v;
    }
  }
  const globalRms = Math.sqrt(sumSq / (frames * channels));

  const edgeWin = Math.min(Math.floor(frames / 4), Math.max(256, Math.floor(frames * 0.06)));
  const rmsOver = (from: number, count: number): number => {
    let s = 0;
    for (let i = from; i < from + count; i++) {
      for (let c = 0; c < channels; c++) {
        const v = at(i, c);
        s += v * v;
      }
    }
    return Math.sqrt(s / (count * channels));
  };
  const headRms = rmsOver(0, edgeWin);
  const tailRms = rmsOver(frames - edgeWin, edgeWin);

  // Edge-energy: only meaningful once the bed is above a noise floor (~-60 dBFS).
  const AUDIBLE_FLOOR = 32; // int16
  if (globalRms > AUDIBLE_FLOOR) {
    const minEdge = 0.12 * globalRms;
    if (headRms < minEdge) return `the first ${(edgeWin / frames * 100).toFixed(0)}% is near-silent — reads as a one-shot's onset pad, not a loop.`;
    if (tailRms < minEdge) return `the last ${(edgeWin / frames * 100).toFixed(0)}% decays to near-silence — reads as a one-shot's tail, not a loop.`;
  }

  // Continuity: the wrap jump per channel vs. typical adjacent motion at the edges.
  let typicalSq = 0;
  let typicalN = 0;
  const accumulate = (from: number, count: number) => {
    for (let i = from; i < from + count - 1; i++) {
      for (let c = 0; c < channels; c++) {
        const d = at(i + 1, c) - at(i, c);
        typicalSq += d * d;
        typicalN++;
      }
    }
  };
  accumulate(0, edgeWin);
  accumulate(frames - edgeWin, edgeWin);
  const typicalStep = typicalN > 0 ? Math.sqrt(typicalSq / typicalN) : 0;

  const ABS_FLOOR_STEP = 0.03 * 32768; // ~ -30 dBFS instantaneous jump
  const RATIO = 12;
  const allowed = Math.max(ABS_FLOOR_STEP, RATIO * typicalStep);
  for (let c = 0; c < channels; c++) {
    const wrapStep = Math.abs(at(0, c) - at(frames - 1, c));
    if (wrapStep > allowed) {
      return `end-to-start discontinuity on channel ${c} (${wrapStep} vs. allowed ${allowed.toFixed(0)}); the loop point will click.`;
    }
  }

  return null;
}
