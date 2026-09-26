import type { LookMood } from "../lookdev/lookRuntime";
import { ROOMS } from "../world/stages";

/*
 * Per-act palette moods, as offsets from the active look: each act rotates the
 * nebula pair and shifts colour temperature so the campaign visibly travels
 * somewhere whatever preset is loaded; the Act Mood slider sets how strongly
 * they apply. Gameplay accent colours are deliberately untouched — they carry
 * colour-vision-profile cues.
 */
const ACT_MOODS: Record<"I" | "II" | "III" | "IV", LookMood> = {
  I: {},                                                     // the preset as authored
  II: { nebulaHueA: -28, nebulaHueB: -51, warmth: -0.15 },   // deep water: toward cyan / sea-green
  III: { nebulaHueA: 85, nebulaHueB: 57, warmth: 0.05 },     // signal: toward violet / magenta
  IV: { nebulaHueA: 178, nebulaHueB: 71, warmth: 0.3 }       // ascent: toward ember / rose
};

function actForSector(sector: number): keyof typeof ACT_MOODS {
  return sector <= 8 ? "I" : sector <= 18 ? "II" : sector <= 30 ? "III" : "IV";
}

/** Mood for the room at `index`, or null for non-campaign spaces (training, lab…). */
export function moodForRoom(index: number): LookMood | null {
  const match = /^sector-(\d+)/.exec(ROOMS[index]?.id ?? "");
  return match ? ACT_MOODS[actForSector(Number(match[1]))] : null;
}
