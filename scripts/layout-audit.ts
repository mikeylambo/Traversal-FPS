import { writeFileSync } from "node:fs";
import { CAMPAIGN_MAPS } from "../src/world/campaign";
import { classifyPair, describeLayout, layoutSimilarity } from "../src/world/layoutAudit";
import { buildChallengeSuite, buildTimeTrialSuite, CHALLENGE_ENTRIES, TIME_TRIAL_ENTRIES } from "../src/world/modeSuites";
import { registerCampaign02 } from "../src/world/registerCampaign02";
import { registerCampaign03 } from "../src/world/registerCampaign03";
import { registerCampaign04 } from "../src/world/registerCampaign04";
import { solveRoom } from "../src/world/routeSolver";
import type { RoomSpec } from "../src/world/stages";

/**
 * Layout-family audit report: descriptors, nearest neighbours, action class and
 * (with --necessity) which verbs each room provably requires. Writes JSON for the
 * visual matrix; `npm run content:audit -- --out <file>`.
 */
registerCampaign02();
registerCampaign03();
registerCampaign04();

const args = process.argv.slice(2);
const out = args.includes("--out") ? args[args.indexOf("--out") + 1]! : "layout-audit.json";
const necessity = args.includes("--necessity");

type Row = { key: string; mode: "campaign" | "time-trial" | "challenge"; label: string; room: RoomSpec; exact: boolean; inspiredBy?: string };
const rows: Row[] = [
  ...CAMPAIGN_MAPS.filter((m) => m.implemented).map((m) => ({ key: m.id, mode: "campaign" as const, label: m.label, room: m.campaignRooms[0]!, exact: false })),
  ...buildTimeTrialSuite().map((room, i) => ({ key: room.id, mode: "time-trial" as const, label: room.title, room, exact: false, inspiredBy: TIME_TRIAL_ENTRIES[i]!.inspiredBy })),
  ...buildChallengeSuite().map((room, i) => ({ key: room.id, mode: "challenge" as const, label: room.title, room, exact: true, inspiredBy: CHALLENGE_ENTRIES[i]!.inspiredBy }))
];

const descriptors = rows.map((row) => describeLayout(row.room));
const matrix = descriptors.map((a) => descriptors.map((b) => Math.round(layoutSimilarity(a, b) * 100) / 100));

const report = rows.map((row, i) => {
  const d = descriptors[i]!;
  const ranked = rows.map((other, j) => ({ key: other.key, score: matrix[i]![j]!, identical: d.geometryHash === descriptors[j]!.geometryHash }))
    .filter((_, j) => j !== i).sort((a, b) => b.score - a.score);
  const nearest = ranked[0]!;
  let needs: Record<string, boolean> | undefined;
  if (necessity) {
    const solve = (o: object) => solveRoom(row.room, { exactKills: row.exact, maxMillis: 15000, ...o }).solved;
    const base = solve({});
    needs = base ? { crouch: !solve({ allowCrouch: false }), reposition: !solve({ allowReposition: false }), chain: !solve({ allowAirborneChain: false }) } : undefined;
  }
  return {
    key: row.key, mode: row.mode, label: row.label, inspiredBy: row.inspiredBy,
    skeleton: d.skeleton, goal: d.goal, span: [d.spanX, d.spanY, d.spanZ],
    floors: d.floors, walls: d.walls, lowCeilings: d.lowCeilings, moving: d.moving,
    spheres: d.spheres, required: d.required, fullClear: d.fullClear,
    movingActors: d.movingActors, originGated: d.originGated, utility: d.utility, hazards: d.hazards,
    goalVisibleFromSpawn: d.goalVisibleFromSpawn,
    nearest: nearest.key, nearestScore: nearest.score, action: classifyPair(nearest.score, nearest.identical),
    top3: ranked.slice(0, 3),
    needs
  };
});

writeFileSync(out, JSON.stringify({ generated: new Date().toISOString(), keys: rows.map((r) => r.key), matrix, rooms: report }, null, 1));
const counts = report.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.action]: (acc[r.action] ?? 0) + 1 }), {});
console.log(`Layout audit: ${rows.length} rooms // nearest-neighbour classes ${JSON.stringify(counts)} // written ${out}`);
