import type { RoomSpec } from "./stages";
import { CHALLENGE_ROOMS, TIME_TRIAL_ROOMS } from "./modeRooms";

export interface TimeTrialEntry {
  id: string;
  label: string;
  goldSeconds: number;
  silverSeconds: number;
  bronzeSeconds: number;
}

export interface ChallengeEntry {
  id: string;
  label: string;
  family: "PRECISION" | "LOGIC" | "FLOW" | "SYNTHESIS";
}

const TT_PARS = [12,18,18,19,21,23,22,25,24,24,26,25,28,27,30,32,34,42];

export const TIME_TRIAL_ENTRIES: TimeTrialEntry[] = TIME_TRIAL_ROOMS.map((room, index) => {
  const gold = TT_PARS[index] ?? 30;
  return {
    id: room.id,
    label: room.title.replace(/^\d+\s*\/\/\s*/, ""),
    goldSeconds: gold,
    silverSeconds: Math.round(gold * 1.22 * 10) / 10,
    bronzeSeconds: Math.round(gold * 1.5 * 10) / 10
  };
});

const CHALLENGE_FAMILIES: ChallengeEntry["family"][] = [
  "PRECISION","PRECISION","LOGIC","PRECISION","LOGIC","FLOW",
  "LOGIC","LOGIC","PRECISION","FLOW","PRECISION","FLOW",
  "LOGIC","FLOW","LOGIC","FLOW","PRECISION","PRECISION",
  "LOGIC","FLOW","SYNTHESIS","SYNTHESIS","FLOW","SYNTHESIS"
];

export const CHALLENGE_ENTRIES: ChallengeEntry[] = CHALLENGE_ROOMS.map((room, index) => ({
  id: room.id,
  label: room.title.replace(/^\d+\s*\/\/\s*/, ""),
  family: CHALLENGE_FAMILIES[index] ?? "SYNTHESIS"
}));

export function buildTimeTrialSuite(): RoomSpec[] {
  return TIME_TRIAL_ROOMS.map((source, index) => {
    const room = structuredClone(source) as RoomSpec;
    const entry = TIME_TRIAL_ENTRIES[index]!;
    room.title = `${String(index + 1).padStart(2, "0")} // ${entry.label}`;
    room.lesson = `GOLD ${entry.goldSeconds.toFixed(1)}s // SILVER ${entry.silverSeconds.toFixed(1)}s // BRONZE ${entry.bronzeSeconds.toFixed(1)}s`;
    return room;
  });
}

export function buildChallengeSuite(): RoomSpec[] {
  return CHALLENGE_ROOMS.map((source, index) => {
    const room = structuredClone(source) as RoomSpec;
    const entry = CHALLENGE_ENTRIES[index]!;
    room.title = `${String(index + 1).padStart(2, "0")} // ${entry.label}`;
    room.lesson = `${entry.family} // Exact required Sphere count. Extra Sphere kills or unnecessary shots break the clean route.`;
    return room;
  });
}
