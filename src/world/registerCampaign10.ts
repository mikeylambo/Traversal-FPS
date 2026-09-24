import { CAMPAIGN_MAPS, type CampaignMapDefinition } from "./campaign";
import { MAP_10_COURSE, MAP_10_FIELD } from "./campaign10";
import { MAPS_11_TO_16 } from "./campaign11to16";
import { MAPS_17_TO_24 } from "./campaign17to24";
import { MAPS_25_TO_32 } from "./campaign25to32";
import { MAPS_33_TO_42 } from "./campaign33to42";
import type { RoomSpec } from "./stages";

export type ExtendedCampaignMap = CampaignMapDefinition & {
  timeTrialRooms?: RoomSpec[];
  challengeRooms?: RoomSpec[];
};

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

  // Legacy Acts II-III/early-IV maps keep their existing course material for now;
  // the RC content pass can selectively replace them without breaking IDs.
  for (const map of [...MAPS_11_TO_16, ...MAPS_17_TO_24, ...MAPS_25_TO_32]) {
    const extended = map as ExtendedCampaignMap;
    extended.timeTrialRooms = map.courseRooms.map((room, index) => modeClone(
      room,
      `tt-${index + 1}`,
      "TIME TRIAL // The solution is known. Remove waits, extra Spheres and dead air."
    ));
    extended.challengeRooms = map.courseRooms.map((room, index) => modeClone(
      room,
      `challenge-${index + 1}`,
      "CHALLENGE // Exact Sphere route. Utility actors are free; unnecessary Sphere kills fail the chamber."
    ));

    const current = CAMPAIGN_MAPS.find((entry) => entry.id === map.id);
    if (current) Object.assign(current, extended);
    else CAMPAIGN_MAPS.push(extended);
  }

  // Sectors 33-42 are authored around missing spatial families and already carry
  // bespoke TT/Challenge geometry where that family benefits those modes.
  for (const map of MAPS_33_TO_42) {
    const current = CAMPAIGN_MAPS.find((entry) => entry.id === map.id);
    if (current) Object.assign(current, map);
    else CAMPAIGN_MAPS.push(map);
  }
}

function modeClone(room: RoomSpec, suffix: string, lesson: string): RoomSpec {
  const clone = structuredClone(room) as RoomSpec;
  clone.id = `${room.id}-${suffix}`;
  clone.title = suffix.startsWith("tt")
    ? `${room.title.replace(/ \/\/ COURSE$/, "")} // TIME`
    : `${room.title.replace(/ \/\/ COURSE$/, "")} // CLEAN`;
  clone.lesson = lesson;
  return clone;
}
