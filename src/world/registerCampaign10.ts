import { CAMPAIGN_MAPS } from "./campaign";
import { MAP_10_COURSE, MAP_10_FIELD } from "./campaign10";

export function registerCampaign10(): void {
  const existing = CAMPAIGN_MAPS.find((entry) => entry.id === "map-10");
  if (existing) {
    existing.implemented = true;
    existing.campaignRooms = MAP_10_FIELD;
    existing.courseRooms = MAP_10_COURSE;
    return;
  }

  CAMPAIGN_MAPS.push({
    id: "map-10",
    label: "SECTOR 10 // VERTICAL RETURN",
    subtitle: "The ring is visible at the beginning. Progress means leaving it, descending, and finding your way back.",
    focus: ["High Sphere Count", "Descent", "Backtracking", "Elevation", "Route Memory", "Return Path"],
    implemented: true,
    campaignRooms: MAP_10_FIELD,
    courseRooms: MAP_10_COURSE
  });
}
