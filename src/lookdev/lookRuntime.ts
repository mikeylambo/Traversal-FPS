import { DEFAULT_LOOK, LOOK_PARAMS, type LookKey, type LookSettings } from "./lookSchema";

/*
 * Resolves the look actually rendered each frame: the player's base look plus
 * the active mood's offsets (e.g. a per-act palette shift), scaled by the
 * `actMood` slider. Hue offsets rotate around the colour wheel.
 */

export type LookMood = Partial<LookSettings>;

const MOOD_KEYS: LookKey[] = LOOK_PARAMS.filter((p) => "mood" in p && p.mood).map((p) => p.key);
const HUE_KEYS = new Set<LookKey>(LOOK_PARAMS.filter((p) => p.format === "deg" && p.max === 360).map((p) => p.key));

let active: LookSettings = { ...DEFAULT_LOOK };

export function resolveLook(base: LookSettings, mood: LookMood | null): LookSettings {
  if (!mood || base.actMood <= 0) return base;
  const out = { ...base };
  const t = base.actMood;
  for (const key of MOOD_KEYS) {
    const offset = mood[key];
    if (offset === undefined) continue;
    // Moods are offsets from the base look, so any preset keeps its identity
    // and each act shifts it: hues rotate, linear keys add.
    out[key] = HUE_KEYS.has(key) ? (((base[key] + offset * t) % 360) + 360) % 360 : clampKey(key, base[key] + offset * t);
  }
  return out;
}

function clampKey(key: LookKey, value: number): number {
  const param = LOOK_PARAMS.find((p) => p.key === key)!;
  return Math.min(param.max, Math.max(param.min, value));
}

/** Called once per frame by the host with the resolved look. */
export function publishLook(look: LookSettings): void {
  active = look;
}

/** Read the look presentation code should use this frame (rifle, FX, etc.). */
export function activeLook(): LookSettings {
  return active;
}
