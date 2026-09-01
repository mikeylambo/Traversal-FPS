import { CAMPAIGN_MAPS } from "./campaign";
import { MAP_10_COURSE, MAP_10_FIELD } from "./campaign10";
import { MAPS_11_TO_16 } from "./campaign11to16";
import { MAPS_17_TO_24 } from "./campaign17to24";
import { MAPS_25_TO_32 } from "./campaign25to32";

export function registerCampaign10(): void {
  const existing = CAMPAIGN_MAPS.find((entry) => entry.id === "map-10");
  if (existing) {
    existing.implemented = true;
    existing.campaignRooms = MAP_10_FIELD;
    existing.courseRooms = MAP_10_COURSE;
  } else {
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

  for (const map of [...MAPS_11_TO_16, ...MAPS_17_TO_24, ...MAPS_25_TO_32]) {
    const current = CAMPAIGN_MAPS.find((entry) => entry.id === map.id);
    if (current) Object.assign(current, map);
    else CAMPAIGN_MAPS.push(map);
  }
}