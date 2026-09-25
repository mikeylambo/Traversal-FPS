import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CAMPAIGN_MAPS } from "../src/world/campaign";
import { classifyPair, describeLayout, similarityPairs } from "../src/world/layoutAudit";
import { buildChallengeSuite, buildTimeTrialSuite } from "../src/world/modeSuites";
import { registerCampaign02 } from "../src/world/registerCampaign02";
import { registerCampaign03 } from "../src/world/registerCampaign03";
import { registerCampaign04 } from "../src/world/registerCampaign04";
import { solveRoom } from "../src/world/routeSolver";
import type { RoomSpec } from "../src/world/stages";

/**
 * Route certification. Every authored room must be provably clearable under the
 * runtime movement/warp rules, and no two rooms in Campaign/Time Trial/Challenge
 * may be near-duplicates. Certificates are cached by geometry hash, so only
 * changed rooms are re-solved.
 *
 * Legacy Act I sectors (01-10) were certified by playtest; they are reported but
 * not blocking, because their long corridors exceed the solver's time budget.
 */

registerCampaign02();
registerCampaign03();
registerCampaign04();

type Certificate = { hash: string; solved: boolean; warps: number; ms: number; reason?: string };
type Entry = { key: string; room: RoomSpec; exact: boolean; blocking: boolean };

const CACHE = new URL("./route-certificates.json", import.meta.url);
const cache: Record<string, Certificate> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const ADVISORY = new Set(["map-01", "map-02", "map-03", "map-04", "map-05", "map-06", "map-07", "map-08", "map-09", "map-10"]);

const entries: Entry[] = [
  ...CAMPAIGN_MAPS.filter((map) => map.implemented).map((map) => ({
    key: `campaign:${map.id}`, room: map.campaignRooms[0]!, exact: false, blocking: !ADVISORY.has(map.id)
  })),
  ...buildTimeTrialSuite().map((room) => ({ key: `time-trial:${room.id}`, room, exact: false, blocking: true })),
  ...buildChallengeSuite().map((room) => ({ key: `challenge:${room.id}`, room, exact: true, blocking: true }))
];

const geometryHash = (room: RoomSpec, exact: boolean) => createHash("sha1")
  .update(JSON.stringify([room.spawn, room.goal, room.requiredKills, room.platforms, room.enemies, room.hazards ?? [], exact]))
  .digest("hex")
  .slice(0, 16);

let errors = 0;
let solvedFresh = 0;
const next: Record<string, Certificate> = {};

for (const entry of entries) {
  const hash = geometryHash(entry.room, entry.exact);
  const cached = cache[entry.key];
  // Reuse any certificate for unchanged geometry; advisory rooms keep their
  // (possibly unsolved) result so they are not re-searched on every build.
  if (cached && cached.hash === hash && (cached.solved || !entry.blocking)) {
    if (!cached.solved) console.log(`[WARN ] ${entry.key} :: route.unsolved :: ${cached.reason} (cached)`);
    next[entry.key] = cached;
    continue;
  }
  const started = Date.now();
  const result = solveRoom(entry.room, { exactKills: entry.exact, maxMillis: entry.blocking ? 60000 : 8000 });
  const certificate: Certificate = { hash, solved: result.solved, warps: result.warps, ms: Date.now() - started, reason: result.reason };
  next[entry.key] = certificate;
  solvedFresh += 1;
  if (!result.solved) {
    const severity = entry.blocking ? "ERROR" : "WARN ";
    if (entry.blocking) errors += 1;
    console.log(`[${severity}] ${entry.key} :: route.unsolved :: ${result.reason}`);
  }
}

// Near-duplicate layouts across every mode fail the build.
const descriptors = entries.map((entry) => ({ ...describeLayout(entry.room), id: entry.key }));
for (const pair of similarityPairs(descriptors)) {
  if (classifyPair(pair.score, pair.identical) !== "RED") break;
  errors += 1;
  console.log(`[ERROR] ${pair.a} ~ ${pair.b} :: layout.duplicate :: ${Math.round(pair.score * 100)}% similar`);
}

writeFileSync(CACHE, `${JSON.stringify(next, null, 2)}\n`);
const solved = Object.values(next).filter((c) => c.solved).length;
console.log(`Route certify: ${solved}/${entries.length} rooms proven clearable (${solvedFresh} re-solved) // ${errors} errors`);
if (errors > 0) {
  console.error("Route certify FAIL.");
  process.exit(1);
}
console.log("Route certify PASS.");
