import { CAMPAIGN_MAPS } from "../src/world/campaign";
import { buildChallengeSuite, buildTimeTrialSuite } from "../src/world/modeSuites";
import { registerCampaign02 } from "../src/world/registerCampaign02";
import { registerCampaign03 } from "../src/world/registerCampaign03";
import { registerCampaign04 } from "../src/world/registerCampaign04";
import { solveRoom, type GoalFirst } from "../src/world/routeSolver";
import type { RoomSpec } from "../src/world/stages";

/**
 * Warning-only report: which rooms can be finished by reaching the goal area
 * early and shooting the rest from there. Never fails the build; the tactic is
 * valid, this only shows how much of the game leans on it.
 *
 *   SKIPPABLE     the goal platform is reachable within 1 kill and every other
 *                 required Sphere is shootable from it (one warp, then a gallery)
 *   EARLY FINISH  reachable within half the requirement, the rest shootable from it
 *   BALANCED      the goal platform comes late, or can't finish the job alone
 * Rooms needing fewer than 3 Spheres are always BALANCED ("hit it, warp there").
 */

registerCampaign02();
registerCampaign03();
registerCampaign04();

type Row = { mode: string; id: string; title: string; result: GoalFirst };

const rooms: { mode: string; room: RoomSpec }[] = [
  ...CAMPAIGN_MAPS.filter((map) => map.implemented).map((map) => ({ mode: "campaign", room: map.campaignRooms[0]! })),
  ...buildTimeTrialSuite().map((room) => ({ mode: "time-trial", room })),
  ...buildChallengeSuite().map((room) => ({ mode: "challenge", room }))
];

const rows: Row[] = [];
for (const { mode, room } of rooms) {
  const result = solveRoom(room, { goalFirstOnly: true, maxMillis: 20000 }).goalFirst;
  if (result) rows.push({ mode, id: room.id, title: room.title, result });
}

const arrival = (r: GoalFirst) => r.arrivalKills < 0 ? ">3" : String(r.arrivalKills);
for (const row of rows) {
  if (row.result.verdict === "BALANCED") continue;
  const tag = row.result.verdict === "SKIPPABLE" ? "[WARN ]" : "[NOTE ]";
  console.log(`${tag} ${row.mode}:${row.id} (${row.title}) :: ${row.result.verdict} :: goal platform after ${arrival(row.result)} kill(s), ${row.result.finaleSpheres}/${row.result.required} required shootable from it`);
}

console.log("\nGoal-first balance");
for (const mode of ["campaign", "time-trial", "challenge"]) {
  const subset = rows.filter((row) => row.mode === mode);
  const count = (verdict: GoalFirst["verdict"]) => subset.filter((row) => row.result.verdict === verdict).length;
  console.log(`  ${mode.padEnd(11)} ${String(count("SKIPPABLE")).padStart(2)} skippable // ${String(count("EARLY FINISH")).padStart(2)} early finish // ${String(count("BALANCED")).padStart(2)} balanced  (of ${subset.length})`);
}
