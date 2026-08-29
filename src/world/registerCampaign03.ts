import { CAMPAIGN_MAPS } from "./campaign";
import { MAP_03_COURSE, MAP_03_FIELD } from "./campaign03";

export function registerCampaign03(): void {
  const map = CAMPAIGN_MAPS.find((entry) => entry.id === "map-03");
  if (!map) return;
  map.implemented = true;
  map.campaignRooms = MAP_03_FIELD;
  map.courseRooms = MAP_03_COURSE;
}
