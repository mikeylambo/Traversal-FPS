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
  // Playtest fix: Reconfiguration's final drifter was centered in front of the
  // last platform, so a full warp could resolve into empty space. Keep the
  // horizontal timing read, but move the endpoint locus onto the exit deck.
  const reconfigFinal = MAP_05_FIELD[0]?.enemies.find((enemy) => enemy.id === "reconfig-final");
  if (reconfigFinal) {
    reconfigFinal.position = [0, 3.2, -153];
    if (reconfigFinal.drift) reconfigFinal.drift.amplitude = 4.5;
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
