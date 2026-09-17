import { CAMPAIGN_MAPS, type CampaignMapDefinition } from "./campaign";
import { MAP_10_COURSE, MAP_10_FIELD } from "./campaign10";
import { MAPS_11_TO_16 } from "./campaign11to16";
import { MAPS_17_TO_24 } from "./campaign17to24";
import { MAPS_25_TO_32 } from "./campaign25to32";
import { CAMPAIGN_EXPANSION_MAPS } from "./campaignExpansion";

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

  // Act I remains the compact eight-sector learning curve. Acts II–IV expand to
  // 10 / 12 / 12 sectors so the game can introduce new spatial families without
  // deleting every good room from the original 32-sector playtest build.
  registerSet(MAPS_11_TO_16);
  registerSet(CAMPAIGN_EXPANSION_MAPS.filter((entry) => ["map-17", "map-18"].includes(entry.id)));
  registerSet(remapSet(MAPS_17_TO_24, 19));
  registerSet(CAMPAIGN_EXPANSION_MAPS.filter((entry) => ["map-27", "map-28", "map-29", "map-30"].includes(entry.id)));
  registerSet(remapSet(MAPS_25_TO_32, 31));
  registerSet(CAMPAIGN_EXPANSION_MAPS.filter((entry) => ["map-39", "map-40", "map-41", "map-42"].includes(entry.id)));

  CAMPAIGN_MAPS.sort((a, b) => sectorNumber(a.id) - sectorNumber(b.id));
}

function registerSet(definitions: CampaignMapDefinition[]): void {
  for (const map of definitions) {
    const current = CAMPAIGN_MAPS.find((entry) => entry.id === map.id);
    if (current) Object.assign(current, map);
    else CAMPAIGN_MAPS.push(map);
  }
}

function remapSet(definitions: CampaignMapDefinition[], firstSector: number): CampaignMapDefinition[] {
  return definitions.map((source, index) => {
    const sector = firstSector + index;
    const clone = structuredClone(source) as CampaignMapDefinition;
    clone.id = `map-${String(sector).padStart(2, "0")}`;
    clone.label = clone.label.replace(/SECTOR\s+\d+\s*\/\//, `SECTOR ${String(sector).padStart(2, "0")} //`);
    return clone;
  });
}

function sectorNumber(id: string): number {
  return Number(id.replace("map-", "")) || 0;
}
