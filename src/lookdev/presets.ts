import { DEFAULT_LOOK, sanitizeLook, type LookSettings } from "./lookSchema";

/*
 * Named looks. Built-ins ship with the game; user presets live in local
 * storage and can be exported/imported as JSON files so a tuned look can be
 * committed to the repo and shared between games.
 */

export interface LookPresetFile {
  kind: "look-preset";
  version: 1;
  name: string;
  look: Partial<LookSettings>;
}

export const BUILT_IN_PRESETS: Record<string, LookSettings> = {
  "Neon Frame": { ...DEFAULT_LOOK },
  "Neon Void": sanitizeLook({ ceramicFrame: 0, bodyDarkness: 0 }),
  "Ceramic Dawn": sanitizeLook({
    exposure: 1.05, bodyDarkness: 0.1, warmth: 0.25, nebulaHueA: 28, nebulaHueB: 330, nebula: 0.6,
    heightFog: 0.6, energyStrength: 1.4, gridStrength: 0.25, contrast: 1.02, vignette: 0.25
  }),
  "Deep Signal": sanitizeLook({
    gridStrength: 0.2, energyStrength: 3, fogDensity: 0.035, vignette: 0.6, nebula: 0.3,
    nebulaHueA: 185, nebulaHueB: 205, contrast: 1.2, saturation: 0.85, ceramicFrame: 0.6, grain: 0.35
  })
};

const STORAGE_KEY = "lookdev:user-presets";

export function loadUserPresets(): Record<string, LookSettings> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(raw).map(([name, look]) => [name, sanitizeLook(look as Record<string, unknown>)]));
  } catch {
    return {};
  }
}

export function saveUserPreset(name: string, look: LookSettings): void {
  const all = loadUserPresets();
  all[name] = { ...look };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch { /* storage unavailable */ }
}

export function deleteUserPreset(name: string): void {
  const all = loadUserPresets();
  delete all[name];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch { /* storage unavailable */ }
}

export function presetFile(name: string, look: LookSettings): LookPresetFile {
  return { kind: "look-preset", version: 1, name, look: { ...look } };
}

/** Accepts a preset file or a bare look object. */
export function parsePresetFile(text: string): { name: string; look: LookSettings } {
  const data = JSON.parse(text) as Partial<LookPresetFile> & Record<string, unknown>;
  const look = data.kind === "look-preset" && data.look ? data.look : data;
  return { name: typeof data.name === "string" ? data.name : "Imported", look: sanitizeLook(look as Record<string, unknown>) };
}
