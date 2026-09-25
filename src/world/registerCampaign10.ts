import { CAMPAIGN_MAPS, type CampaignMapDefinition } from "./campaign";
import { MAP_10_COURSE, MAP_10_FIELD } from "./campaign10";
import { MAPS_11_TO_18 } from "./campaign11to18";
import { MAPS_19_TO_30 } from "./campaign19to30";
import { MAPS_31_TO_32 } from "./campaign31to32";
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

  // Sectors 11-32 are rebuilt around distinct spatial skeletons (see campaign11to18,
  // campaign19to30, campaign31to32).
  for (const map of [...MAPS_11_TO_18, ...MAPS_19_TO_30, ...MAPS_31_TO_32]) {
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
