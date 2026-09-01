import { CAMPAIGN_MAPS, type CampaignMapDefinition } from "./campaign";
import type { RoomSpec } from "./stages";

type ExtendedCampaignMap = CampaignMapDefinition & {
  timeTrialRooms?: RoomSpec[];
  challengeRooms?: RoomSpec[];
};

export interface TimeTrialEntry {
  id: string;
  label: string;
  sourceMapId: string;
  sourceRoomIndex: number;
  goldSeconds: number;
  silverSeconds: number;
  bronzeSeconds: number;
}

export interface ChallengeEntry {
  id: string;
  label: string;
  sourceMapId: string;
  sourceRoomIndex: number;
  family: "PRECISION" | "LOGIC" | "FLOW" | "SYNTHESIS";
}

export const TIME_TRIAL_ENTRIES: TimeTrialEntry[] = [
  tt(1, "VECTOR", "map-01", 0, 13),
  tt(2, "RELAY", "map-02", 0, 16),
  tt(3, "ANGLE", "map-03", 0, 17),
  tt(4, "ORBIT", "map-04", 1, 18),
  tt(5, "SWITCHBACK", "map-05", 0, 20),
  tt(6, "LIFTLINE", "map-06", 0, 21),
  tt(7, "FORK", "map-08", 0, 22),
  tt(8, "RETURN", "map-10", 0, 24),
  tt(9, "GATES", "map-12", 0, 25),
  tt(10, "REFRACTION", "map-14", 0, 27),
  tt(11, "COMPOSITION", "map-16", 0, 30),
  tt(12, "SWEEP", "map-18", 0, 31),
  tt(13, "CROSSCURRENT", "map-20", 0, 33),
  tt(14, "PRESSURE", "map-24", 0, 36),
  tt(15, "KINETIC", "map-30", 0, 39),
  tt(16, "TRAVERSAL", "map-32", 0, 45)
];

export const CHALLENGE_ENTRIES: ChallengeEntry[] = [
  challenge(1, "FIRST PRINCIPLE", "map-01", 0, "PRECISION"),
  challenge(2, "SHORT LINE", "map-02", 0, "PRECISION"),
  challenge(3, "REACQUIRE", "map-03", 0, "FLOW"),
  challenge(4, "CROSSCURRENT", "map-04", 4, "FLOW"),
  challenge(5, "LOW ROUTE", "map-05", 0, "PRECISION"),
  challenge(6, "MOVING MARK", "map-06", 0, "PRECISION"),
  challenge(7, "NEW ANGLE", "map-07", 0, "LOGIC"),
  challenge(8, "ROUTE FORK", "map-08", 0, "LOGIC"),
  challenge(9, "MACHINE LANGUAGE", "map-09", 0, "LOGIC"),
  challenge(10, "VERTICAL RETURN", "map-10", 0, "LOGIC"),
  challenge(11, "RELAY", "map-11", 0, "FLOW"),
  challenge(12, "GATES", "map-12", 0, "LOGIC"),
  challenge(13, "FORK", "map-13", 0, "LOGIC"),
  challenge(14, "REFRACTION", "map-14", 0, "LOGIC"),
  challenge(15, "MACHINERY", "map-15", 0, "SYNTHESIS"),
  challenge(16, "COMPOSITION", "map-16", 0, "SYNTHESIS"),
  challenge(17, "SWEEP", "map-18", 0, "FLOW"),
  challenge(18, "CURRENT", "map-20", 0, "PRECISION"),
  challenge(19, "BLINDSIDE", "map-22", 0, "FLOW"),
  challenge(20, "PRESSURE", "map-24", 0, "SYNTHESIS"),
  challenge(21, "ORBIT", "map-26", 0, "FLOW"),
  challenge(22, "STATE", "map-28", 0, "LOGIC"),
  challenge(23, "KINETIC", "map-30", 0, "FLOW"),
  challenge(24, "VECTOR", "map-32", 0, "SYNTHESIS")
];

export function buildTimeTrialSuite(): RoomSpec[] {
  return TIME_TRIAL_ENTRIES.map((entry) => {
    const source = sourceRoom(entry.sourceMapId, entry.sourceRoomIndex, "time-trial");
    const room = structuredClone(source) as RoomSpec;
    room.id = entry.id;
    room.title = `${entry.id.toUpperCase()} // ${entry.label}`;
    room.lesson = `PROVISIONAL PAR // GOLD ${entry.goldSeconds.toFixed(1)}s // SILVER ${entry.silverSeconds.toFixed(1)}s // BRONZE ${entry.bronzeSeconds.toFixed(1)}s. Optimize the route before we lock final medals.`;
    return room;
  });
}

export function buildChallengeSuite(): RoomSpec[] {
  return CHALLENGE_ENTRIES.map((entry) => {
    const source = sourceRoom(entry.sourceMapId, entry.sourceRoomIndex, "challenge");
    const room = structuredClone(source) as RoomSpec;
    room.id = entry.id;
    room.title = `${entry.id.toUpperCase()} // ${entry.label}`;
    room.lesson = `${entry.family} CHALLENGE // Clear with the exact required Sphere count. Utility actors are free. Extra Sphere kills or unnecessary shots break the clean route.`;
    return room;
  });
}

function sourceRoom(mapId: string, roomIndex: number, mode: "time-trial" | "challenge"): RoomSpec {
  const map = CAMPAIGN_MAPS.find((entry) => entry.id === mapId && entry.implemented) as ExtendedCampaignMap | undefined;
  if (!map) throw new Error(`Mode suite references unavailable map ${mapId}`);
  const preferred = mode === "time-trial" ? map.timeTrialRooms : map.challengeRooms;
  const rooms = preferred?.length ? preferred : map.courseRooms;
  if (!rooms.length) throw new Error(`Mode suite references map with no course rooms: ${mapId}`);
  return rooms[Math.min(roomIndex, rooms.length - 1)]!;
}

function tt(index: number, label: string, sourceMapId: string, sourceRoomIndex: number, goldSeconds: number): TimeTrialEntry {
  return {
    id: `tt-${String(index).padStart(2, "0")}`,
    label,
    sourceMapId,
    sourceRoomIndex,
    goldSeconds,
    silverSeconds: Math.round(goldSeconds * 1.22 * 10) / 10,
    bronzeSeconds: Math.round(goldSeconds * 1.5 * 10) / 10
  };
}

function challenge(
  index: number,
  label: string,
  sourceMapId: string,
  sourceRoomIndex: number,
  family: ChallengeEntry["family"]
): ChallengeEntry {
  return {
    id: `challenge-${String(index).padStart(2, "0")}`,
    label,
    sourceMapId,
    sourceRoomIndex,
    family
  };
}
