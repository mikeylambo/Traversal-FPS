import { CAMPAIGN_MAPS } from "./campaign";
import { MAP_09_COURSE, MAP_09_FIELD } from "./campaign09";

export function registerCampaign09(): void {
  const existing = CAMPAIGN_MAPS.find((entry) => entry.id === "map-09");
  if (existing) {
    existing.implemented = true;
    existing.campaignRooms = MAP_09_FIELD;
    existing.courseRooms = MAP_09_COURSE;
  } else {
    CAMPAIGN_MAPS.push({
      id: "map-09",
      label: "SECTOR 09 // MACHINE LANGUAGE",
      subtitle: "ACT II begins: shapes alter the machine; Spheres remain the only movement currency.",
      focus: ["Cube State", "Diamond Motion", "Prism Routing", "Safe Apertures", "Moving Platforms", "Vertical Return"],
      implemented: true,
      campaignRooms: MAP_09_FIELD,
      courseRooms: MAP_09_COURSE
    });
  }

  if (!CAMPAIGN_MAPS.some((entry) => entry.id === "map-10")) {
    CAMPAIGN_MAPS.push({
      id: "map-10",
      label: "SECTOR 10 // VERTICAL RETURN",
      subtitle: "Planned ACT II sector: descend, double back, and reclaim elevation through a simple high-count space.",
      focus: ["High Sphere Count", "Descent", "Backtracking", "Elevation Recovery", "Simple Geometry"],
      implemented: false,
      campaignRooms: [],
      courseRooms: []
    });
  }
}
