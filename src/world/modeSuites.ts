import { CHALLENGE_CHAMBERS, type ChallengeFamily } from "./modes/challenges";
import { TIME_TRIAL_COURSES } from "./modes/timeTrials";
import type { RoomSpec } from "./stages";

/**
 * Time Trial and Challenge are their own spaces. Every course and chamber is
 * authored geometry (src/world/modes); `inspiredBy` names the Campaign sector
 * whose idea it rebuilds, never a room it copies.
 */
export interface TimeTrialEntry {
  id: string;
  label: string;
  inspiredBy?: string;
  goldSeconds: number;
  silverSeconds: number;
  bronzeSeconds: number;
}

export interface ChallengeEntry {
  id: string;
  label: string;
  inspiredBy?: string;
  family: ChallengeFamily;
}

const pad = (n: number) => String(n).padStart(2, "0");

export const TIME_TRIAL_ENTRIES: TimeTrialEntry[] = TIME_TRIAL_COURSES.map((course, index) => ({
  id: `tt-${pad(index + 1)}`,
  label: course.label,
  inspiredBy: course.inspiredBy,
  goldSeconds: course.goldSeconds,
  silverSeconds: Math.round(course.goldSeconds * 1.22 * 10) / 10,
  bronzeSeconds: Math.round(course.goldSeconds * 1.5 * 10) / 10
}));

export const CHALLENGE_ENTRIES: ChallengeEntry[] = CHALLENGE_CHAMBERS.map((chamber, index) => ({
  id: `challenge-${pad(index + 1)}`,
  label: chamber.label,
  inspiredBy: chamber.inspiredBy,
  family: chamber.family
}));

export function buildTimeTrialCourse(index: number): RoomSpec {
  const entry = TIME_TRIAL_ENTRIES[index]!;
  const room = structuredClone(TIME_TRIAL_COURSES[index]!.room) as RoomSpec;
  room.id = entry.id;
  room.title = `TIME TRIAL ${pad(index + 1)} // ${entry.label}`;
  room.lesson = `GOLD ${entry.goldSeconds.toFixed(1)}s // SILVER ${entry.silverSeconds.toFixed(1)}s // BRONZE ${entry.bronzeSeconds.toFixed(1)}s. Find the fastest clean line.`;
  return room;
}

export function buildChallengeChamber(index: number): RoomSpec {
  const entry = CHALLENGE_ENTRIES[index]!;
  const room = structuredClone(CHALLENGE_CHAMBERS[index]!.room) as RoomSpec;
  room.id = entry.id;
  room.title = `CHALLENGE ${pad(index + 1)} // ${entry.label}`;
  room.lesson = `${entry.family} // Exactly ${room.requiredKills} Sphere${room.requiredKills === 1 ? "" : "s"}. Leave the rest alive.`;
  return room;
}

export function buildTimeTrialSuite(): RoomSpec[] {
  return TIME_TRIAL_ENTRIES.map((_, index) => buildTimeTrialCourse(index));
}

export function buildChallengeSuite(): RoomSpec[] {
  return CHALLENGE_ENTRIES.map((_, index) => buildChallengeChamber(index));
}
