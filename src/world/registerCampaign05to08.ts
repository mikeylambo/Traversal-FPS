import { CAMPAIGN_MAPS } from "./campaign";
import {
  MAP_05_COURSE,
  MAP_05_FIELD,
  MAP_06_COURSE,
  MAP_06_FIELD,
  MAP_07_COURSE,
  MAP_07_FIELD,
  MAP_08_COURSE,
  MAP_08_FIELD
} from "./campaign05to08";

export function registerCampaign05to08(): void {
  const reconfiguration = MAP_05_FIELD[0];

  // Playtest fix: Reconfiguration's final drifter was centered in front of the
  // last platform, so a full warp could resolve into empty space. Keep the
  // horizontal timing read, but move the endpoint locus onto the exit deck.
  const reconfigFinal = reconfiguration?.enemies.find((enemy) => enemy.id === "reconfig-final");
  if (reconfigFinal) {
    reconfigFinal.position = [0, 3.2, -153];
    if (reconfigFinal.drift) reconfigFinal.drift.amplitude = 4.5;
  }

  // The first playtest also exposed moving endpoints whose cycles spent too much
  // time outside the platform they visually belonged to. Keep the timing puzzle,
  // but make the useful part of each cycle agree with the visible landing geometry.
  const reconfigMid = reconfiguration?.enemies.find((enemy) => enemy.id === "reconfig-mid");
  if (reconfigMid?.orbit) reconfigMid.orbit.radiusA = 5.2;

  const reconfigLeft = reconfiguration?.enemies.find((enemy) => enemy.id === "reconfig-left");
  if (reconfigLeft?.drift) reconfigLeft.drift.amplitude = 3.2;

  const reconfigRight = reconfiguration?.enemies.find((enemy) => enemy.id === "reconfig-right");
  if (reconfigRight?.orbit) reconfigRight.orbit.radiusB = 3.6;

  // Gate A was reading like a large opaque obstruction rather than a timed line.
  // Preserve the gate mechanic while giving the player more peripheral read and a
  // slightly longer opening to parse its cycle on first contact.
  const entryGate = reconfiguration?.hazards?.find((hazard) => hazard.id === "reconfig-gate-a");
  if (entryGate) {
    entryGate.size = [15, 7, 0.34];
    if (entryGate.cycle) entryGate.cycle.openFor = 1.35;
  }

  const definitions = [
    ["map-05", MAP_05_FIELD, MAP_05_COURSE],
    ["map-06", MAP_06_FIELD, MAP_06_COURSE],
    ["map-07", MAP_07_FIELD, MAP_07_COURSE],
    ["map-08", MAP_08_FIELD, MAP_08_COURSE]
  ] as const;

  for (const [id, campaignRooms, courseRooms] of definitions) {
    const map = CAMPAIGN_MAPS.find((entry) => entry.id === id);
    if (!map) continue;
    map.implemented = true;
    map.campaignRooms = campaignRooms;
    map.courseRooms = courseRooms;
  }
}
