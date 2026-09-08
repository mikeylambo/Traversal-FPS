/**
 * Audio wiring audit. Runs in `npm run build`.
 *
 * This is the automated version of "do one deliberate sweep confirming every
 * trigger either plays a real asset or hits an intentional, silent-is-fine
 * fallback". It catches the mapping-table miss that a manual pass loses.
 */
import { existsSync, statSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUDIO_ASSETS,
  AUDIO_CUES,
  AUDIO_EVENT_IDS,
  audioAsset,
  cueAssetIds,
  type TraversalAudioEvent
} from "../src/audio/TraversalAudioManifest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const audioDir = join(repoRoot, "public", "audio");
const srcDir = join(repoRoot, "src");

const CORE_BUDGET_KB = 700;

const problems: string[] = [];
const notes: string[] = [];

function fail(message: string): void {
  problems.push(message);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && path.endsWith(".ts") ? [path] : [];
  });
}

const gameplaySource = sourceFiles(srcDir)
  .filter((path) => !path.includes(join("src", "audio")))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

// 1. Every cue resolves to declared assets, and those assets are on disk.
for (const event of AUDIO_EVENT_IDS) {
  const cue = AUDIO_CUES[event];

  if (cue.slots.length === 0) fail(`"${event}" has no slots.`);

  for (const slot of cue.slots) {
    if (slot.assets.length === 0) fail(`"${event}" has an empty slot.`);
    if (slot.assets.length > 1 && !slot.pick && event !== "sector.enter") {
      fail(`"${event}" offers alternates without a pick strategy; playback would always take the first.`);
    }
  }

  for (const assetId of cueAssetIds(cue)) {
    const asset = audioAsset(assetId);
    if (!asset) {
      fail(`"${event}" references unknown asset "${assetId}".`);
      continue;
    }
    if (asset.unused) fail(`"${event}" references "${assetId}", which is marked unused.`);

    const file = join(audioDir, asset.file);
    if (!existsSync(file)) {
      fail(`"${event}" -> "${assetId}": ${asset.file} is missing. Run \`npm run audio:build\`.`);
    } else if (statSync(file).size < 1024) {
      fail(`"${event}" -> "${assetId}": ${asset.file} is suspiciously small.`);
    }
  }

  // 2. Positional cues must be mono. A stereo buffer through a PannerNode is
  //    downmixed by the UA and loses the directional cue we are relying on.
  if (cue.positional) {
    for (const assetId of cueAssetIds(cue)) {
      const asset = audioAsset(assetId);
      if (asset && asset.channels !== 1) {
        fail(`"${event}" is positional but "${assetId}" is stereo; it cannot be spatialised.`);
      }
    }
  }

  // 3. Loop cues need a seamless asset.
  if (cue.loop) {
    for (const assetId of cueAssetIds(cue)) {
      const asset = audioAsset(assetId);
      if (asset && !asset.loopCrossfadeSeconds) {
        fail(`"${event}" loops but "${assetId}" was not built with a seamless crossfade.`);
      }
    }
  }

  // 4. Audio-only information audit (Part 2, Priority 4). Anything that is not
  //    explicitly presentation-only must name the visual signal carrying the same
  //    information.
  if (!cue.visualPair?.trim()) {
    fail(`"${event}" declares no visual pairing. Gameplay information must never be audio-only.`);
  }

  // 5. The miss this whole script exists to catch: a mapped cue nothing emits.
  if (cue.deprecated) {
    notes.push(`deprecated: ${event} — ${cue.deprecated}`);
  } else if (!gameplaySource.includes(`"${event}"`)) {
    fail(`"${event}" is mapped to real audio but no gameplay code emits it.`);
  }
}

// 6. Every authored asset is either used or explicitly retired with a reason.
const used = new Set(AUDIO_EVENT_IDS.flatMap((event) => cueAssetIds(AUDIO_CUES[event])));
for (const asset of AUDIO_ASSETS) {
  if (used.has(asset.id)) {
    if (asset.unused) fail(`"${asset.id}" is marked unused but a cue references it.`);
    continue;
  }
  if (!asset.unused) {
    fail(`"${asset.id}" is authored but unmapped. Map it to a cue or document why it is held back.`);
  } else {
    notes.push(`held back: ${asset.id} — ${asset.unused}`);
  }
}

// 7. Boot budget. Core tier is fetched during load; deferred tier is not.
let coreBytes = 0;
let deferredBytes = 0;
for (const asset of AUDIO_ASSETS) {
  if (asset.unused) continue;
  const file = join(audioDir, asset.file);
  if (!existsSync(file)) continue;
  const size = statSync(file).size;
  const isCore = AUDIO_EVENT_IDS.some(
    (event) => AUDIO_CUES[event].tier === "core" && cueAssetIds(AUDIO_CUES[event]).includes(asset.id)
  );
  if (isCore) coreBytes += size;
  else deferredBytes += size;
}

if (coreBytes / 1024 > CORE_BUDGET_KB) {
  fail(`Core SFX bundle is ${(coreBytes / 1024).toFixed(0)} KB, over the ${CORE_BUDGET_KB} KB boot budget.`);
}

// 8. Report unmapped procedural-only events, which are legitimate but should be visible.
const proceduralOnly: TraversalAudioEvent[] = AUDIO_EVENT_IDS.filter(
  (event) => cueAssetIds(AUDIO_CUES[event]).length === 0
);
for (const event of proceduralOnly) notes.push(`procedural-only: ${event}`);

console.log(
  `audio-doctor: ${AUDIO_EVENT_IDS.length} cues, ${AUDIO_ASSETS.length} authored assets, ` +
  `core ${(coreBytes / 1024).toFixed(0)} KB / deferred ${(deferredBytes / 1024).toFixed(0)} KB.`
);
for (const note of notes) console.log(`  note: ${note}`);

if (problems.length > 0) {
  console.error(`\naudio-doctor found ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

// The mapping table ships as documentation, generated from the same manifest the
// game plays, so the two can never drift apart.
if (process.argv.includes("--emit-map")) {
  writeFileSync(join(repoRoot, "docs", "AUDIO_MAPPING.md"), renderMappingDoc(), "utf8");
  console.log("audio-doctor: wrote docs/AUDIO_MAPPING.md");
}

console.log("audio-doctor: every cue maps to a real asset and to a visual signal.");

function renderMappingDoc(): string {
  const lines: string[] = [
    "# Audio mapping",
    "",
    "> Generated by `npm run audio:doctor -- --emit-map`. Edit",
    "> `src/audio/TraversalAudioManifest.ts`, not this file.",
    "",
    "Every semantic trigger the game can emit, the authored asset(s) behind it, and",
    "the visual signal carrying the same information. Cues marked **layered** play all",
    "their takes together; cues marked **alternating** rotate between takes.",
    "",
    "| Trigger | Bus | Load | Assets | Composition | Visual pairing |",
    "| --- | --- | --- | --- | --- | --- |"
  ];

  for (const event of AUDIO_EVENT_IDS) {
    const cue = AUDIO_CUES[event];
    const assets = cueAssetIds(cue);
    const alternating = cue.slots.some((slot) => slot.assets.length > 1);
    const layered = cue.slots.length > 1;
    const composition = [
      layered ? "layered" : null,
      alternating ? "alternating" : null,
      cue.positional ? "positional" : null,
      cue.loop ? "loop" : null
    ].filter(Boolean).join(", ") || "single";

    lines.push(
      `| \`${event}\`${cue.deprecated ? " *(deprecated)*" : ""} | ${cue.bus} | ${cue.tier} | ` +
      `${assets.map((id) => `\`${id}\``).join("<br>")} | ${composition} | ${cue.visualPair} |`
    );
  }

  lines.push("", "## Notes", "");
  for (const event of AUDIO_EVENT_IDS) {
    const cue = AUDIO_CUES[event];
    if (cue.note) lines.push(`- **\`${event}\`** — ${cue.note}`);
    if (cue.deprecated) lines.push(`- **\`${event}\`** — ${cue.deprecated}`);
  }

  lines.push("", "## Authored but not shipped", "");
  for (const asset of AUDIO_ASSETS) {
    if (asset.unused) lines.push(`- **\`${asset.id}\`** (\`${asset.source}\`) — ${asset.unused}`);
  }

  lines.push(
    "",
    "## Fallback contract",
    "",
    "Any trigger whose asset is missing or fails to decode falls through to the",
    "procedural tone layer in `src/audio/TraversalAudio.ts` rather than going silent.",
    "Utility-actor resolves each keep a distinct procedural interval, because the flash",
    "message and the sound are the only two signals that a Cube/Diamond/Prism kill",
    "changed world state. The only cues allowed to degrade to silence are `exit.enter`",
    "and `exit.loop`, which are ambience over information the lit gravity ring and the",
    "HUD objective line already carry.",
    ""
  );

  return lines.join("\n");
}
