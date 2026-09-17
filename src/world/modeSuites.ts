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

/**
 * TT is not Campaign-with-a-clock. Most entries use compact course geometry or a
 * dedicated race variant. KINETIC and NEGATIVE SPACE are deliberate reprises:
 * their Campaign layouts already contain useful speed-routing decisions, so the
 * clock changes what the player is optimizing without pretending the room is new.
 */
export const TIME_TRIAL_ENTRIES: TimeTrialEntry[] = [
  tt(1, "VECTOR", "map-01", 0, 13),
  tt(2, "DRIFT WINDOW", "map-02", 2, 16),
  tt(3, "BACK ANGLE", "map-03", 3, 18),
  tt(4, "ALIGNMENT", "map-04", 2, 18),
  tt(5, "SHIFT CHAIN", "map-05", 2, 19),
  tt(6, "CUT THE CORNER", "map-06", 1, 17),
  tt(7, "MACHINE LANGUAGE", "map-09", 3, 23),
  tt(8, "RETURN", "map-10", 1, 24),
  tt(9, "ASCENT", "map-33", 0, 24),
  tt(10, "DROP", "map-36", 0, 22),
  tt(11, "CROSS", "map-37", 0, 27),
  tt(12, "LONGSPAN", "map-39", 0, 26),
  tt(13, "LOOP", "map-41", 0, 28),
  tt(14, "CONVERGENCE", "map-42", 0, 38),
  tt(15, "KINETIC", "map-30", 0, 34),
  tt(16, "NEGATIVE SPACE", "map-27", 0, 36)
];

/**
 * Challenge deliberately leans on authored course/chamber geometry instead of
 * cloning the 42-sector Campaign. A few Campaign reprises remain on purpose where
 * the constraint itself creates the puzzle: COMPOSITION's shot economy,
 * NEGATIVE SPACE's landing discipline and KINETIC's route exploitation.
 */
export const CHALLENGE_ENTRIES: ChallengeEntry[] = [
  challenge(1, "FIRST PRINCIPLE", "map-01", 0, "PRECISION"),
  challenge(2, "LOW LINE", "map-01", 1, "PRECISION"),
  challenge(3, "SIDE SOLUTION", "map-01", 2, "LOGIC"),
  challenge(4, "CLEAN VECTOR", "map-01", 4, "LOGIC"),
  challenge(5, "WINDOW", "map-02", 0, "PRECISION"),
  challenge(6, "RELEASE", "map-02", 1, "FLOW"),
  challenge(7, "DRIFT WINDOW", "map-02", 2, "FLOW"),
  challenge(8, "CROSSING", "map-02", 3, "FLOW"),
  challenge(9, "ANGLE", "map-03", 0, "PRECISION"),
  challenge(10, "APERTURE", "map-03", 1, "PRECISION"),
  challenge(11, "LOW SIGHT", "map-03", 2, "PRECISION"),
  challenge(12, "BACK ANGLE", "map-03", 3, "LOGIC"),
  challenge(13, "SAFE LINE", "map-04", 0, "PRECISION"),
  challenge(14, "ORBIT", "map-04", 1, "FLOW"),
  challenge(15, "ALIGNMENT", "map-04", 2, "SYNTHESIS"),
  challenge(16, "COMPOSITION", "map-16", 0, "SYNTHESIS"),
  challenge(17, "NEGATIVE SPACE", "map-27", 0, "FLOW"),
  challenge(18, "VERTICAL RETURN", "map-10", 1, "LOGIC"),
  challenge(19, "UNDERPASS", "map-34", 0, "PRECISION"),
  challenge(20, "FOUR POINT", "map-35", 0, "LOGIC"),
  challenge(21, "PARALLAX", "map-40", 0, "LOGIC"),
  challenge(22, "CONVERGENCE", "map-42", 0, "SYNTHESIS"),
  challenge(23, "MACHINE LANGUAGE", "map-09", 3, "SYNTHESIS"),
  challenge(24, "KINETIC", "map-30", 0, "FLOW")
];

export function buildTimeTrialSuite(): RoomSpec[] {
  return TIME_TRIAL_ENTRIES.map((entry, index) => {
    const source = sourceRoom(entry.sourceMapId, entry.sourceRoomIndex, "time-trial");
    const room = structuredClone(source) as RoomSpec;
    room.id = entry.id;
    room.title = `TIME TRIAL ${String(index + 1).padStart(2, "0")} // ${entry.label}`;
    room.lesson = `GOLD ${entry.goldSeconds.toFixed(1)}s // SILVER ${entry.silverSeconds.toFixed(1)}s // BRONZE ${entry.bronzeSeconds.toFixed(1)}s. Find the fastest clean line.`;
    return room;
  });
}

export function buildChallengeSuite(): RoomSpec[] {
  return CHALLENGE_ENTRIES.map((entry, index) => {
    const source = sourceRoom(entry.sourceMapId, entry.sourceRoomIndex, "challenge");
    const room = structuredClone(source) as RoomSpec;
    room.id = entry.id;
    room.title = `CHALLENGE ${String(index + 1).padStart(2, "0")} // ${entry.label}`;
    room.lesson = `${entry.family} // Clear the required Spheres without wasting the route.`;
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
