import { CAMPAIGN_MAPS } from "./campaign";
import { MAP_02_COURSE, MAP_02_FIELD } from "./campaign02";

/** Keeps the growing sector data split into authored modules while preserving the
 * existing campaign registry consumed by menus, progression, and content routing.
 */
export function registerCampaign02(): void {
  const map = CAMPAIGN_MAPS.find((entry) => entry.id === "map-02");
  if (!map) return;
  map.implemented = true;
  map.campaignRooms = MAP_02_FIELD;
  map.courseRooms = MAP_02_COURSE;
}
