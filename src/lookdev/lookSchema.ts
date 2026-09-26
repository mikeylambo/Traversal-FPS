/*
 * Look Engine schema — the single source of truth for every tunable rendering
 * parameter. The Lab UI, defaults, presets, persistence and per-act moods are
 * all generated from this list, so adding a slider is one line here plus the
 * code that reads it.
 *
 * Game-agnostic: nothing in src/lookdev imports gameplay code.
 */

export type LookFormat = "pct" | "x2" | "x3" | "x4" | "deg" | "signed" | "m";

export interface LookParam {
  key: string;
  group: LookGroup;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  format: LookFormat;
  /** Per-act mood overlays may drive this key. */
  mood?: boolean;
}

export const LOOK_GROUPS = ["Light", "Surface", "Frame", "Atmosphere", "Finish", "Warp", "Rifle"] as const;
export type LookGroup = (typeof LOOK_GROUPS)[number];

export const LOOK_PARAMS = [
  // Light
  { key: "exposure", group: "Light", label: "Exposure", min: 0.3, max: 2.5, step: 0.05, default: 0.65, format: "x2" },
  { key: "bloomStrength", group: "Light", label: "Bloom", min: 0, max: 2.2, step: 0.05, default: 0.2, format: "x2" },
  { key: "bloomThreshold", group: "Light", label: "Bloom threshold", min: 0, max: 1.2, step: 0.01, default: 0.71, format: "x2" },
  { key: "keyAzimuth", group: "Light", label: "Key light angle", min: -180, max: 180, step: 1, default: 56, format: "deg" },
  { key: "keyElevation", group: "Light", label: "Key light height", min: 5, max: 90, step: 1, default: 58, format: "deg" },
  { key: "accentHue", group: "Light", label: "Accent hue shift", min: -180, max: 180, step: 1, default: 0, format: "deg" },
  { key: "energyStrength", group: "Light", label: "Energy", min: 0.3, max: 3.5, step: 0.05, default: 2.25, format: "x2" },
  { key: "rimStrength", group: "Light", label: "Rim light", min: 0, max: 2.5, step: 0.05, default: 0, format: "x2" },
  { key: "toonStrength", group: "Light", label: "Toon banding", min: 0, max: 1, step: 0.01, default: 1, format: "pct" },

  // Surface
  { key: "gridStrength", group: "Surface", label: "Tech grid", min: 0, max: 1.5, step: 0.02, default: 0.4, format: "x2" },
  { key: "gridScale", group: "Surface", label: "Grid spacing", min: 0.5, max: 8, step: 0.1, default: 2.9, format: "m" },
  { key: "panelSize", group: "Surface", label: "Panel size", min: 0.6, max: 5, step: 0.1, default: 1.7, format: "m" },
  { key: "seamDepth", group: "Surface", label: "Seam depth", min: 0, max: 1, step: 0.01, default: 0.65, format: "pct" },
  { key: "toneVariation", group: "Surface", label: "Panel variation", min: 0, max: 1, step: 0.01, default: 0.4, format: "pct" },
  { key: "gloss", group: "Surface", label: "Gloss", min: 0, max: 2.5, step: 0.05, default: 1, format: "x2" },
  { key: "chamferWidth", group: "Surface", label: "Edge bevel", min: 0, max: 3, step: 0.05, default: 1, format: "x2" },
  { key: "edgeLight", group: "Surface", label: "Edge light", min: 0, max: 3, step: 0.05, default: 0.7, format: "x2" },
  { key: "lipStrength", group: "Surface", label: "Light lip", min: 0, max: 3, step: 0.05, default: 1, format: "x2" },

  // Frame — the inverted platform language: dark body, light ceramic edges/corners.
  { key: "ceramicFrame", group: "Frame", label: "Ceramic frame", min: 0, max: 1, step: 0.01, default: 1, format: "pct" },
  { key: "frameWidth", group: "Frame", label: "Frame width", min: 0.02, max: 0.5, step: 0.01, default: 0.2, format: "m" },
  { key: "cornerSize", group: "Frame", label: "Corner bracket", min: 0, max: 2, step: 0.02, default: 0.7, format: "m" },
  { key: "frameRun", group: "Frame", label: "Edge run", min: 0, max: 1, step: 0.01, default: 0.12, format: "pct" },
  { key: "frameSeamGlow", group: "Frame", label: "Frame seam glow", min: 0, max: 3, step: 0.05, default: 0.8, format: "x2" },
  { key: "bodyDarkness", group: "Frame", label: "Body darkness", min: 0, max: 1, step: 0.01, default: 0.35, format: "pct" },

  // Atmosphere
  { key: "fogDensity", group: "Atmosphere", label: "Fog", min: 0.002, max: 0.05, step: 0.0005, default: 0.023, format: "x4" },
  { key: "heightFog", group: "Atmosphere", label: "Height fog", min: 0, max: 1, step: 0.01, default: 0.45, format: "pct" },
  { key: "heightFogLevel", group: "Atmosphere", label: "Height fog level", min: -20, max: 10, step: 0.5, default: -3, format: "m" },
  { key: "dust", group: "Atmosphere", label: "Dust motes", min: 0, max: 1, step: 0.01, default: 0.35, format: "pct" },
  { key: "nebula", group: "Atmosphere", label: "Nebula", min: 0, max: 2, step: 0.05, default: 0.8, format: "x2" },
  { key: "nebulaHueA", group: "Atmosphere", label: "Nebula hue A", min: 0, max: 360, step: 1, default: 200, format: "deg", mood: true },
  { key: "nebulaHueB", group: "Atmosphere", label: "Nebula hue B", min: 0, max: 360, step: 1, default: 265, format: "deg", mood: true },
  { key: "nebulaScale", group: "Atmosphere", label: "Nebula scale", min: 0.4, max: 5, step: 0.05, default: 2.2, format: "x2" },
  { key: "nebulaDrift", group: "Atmosphere", label: "Nebula drift", min: 0, max: 5, step: 0.05, default: 1, format: "x2" },
  { key: "horizonGlow", group: "Atmosphere", label: "Horizon glow", min: 0, max: 3, step: 0.05, default: 1, format: "x2" },
  { key: "starTwinkle", group: "Atmosphere", label: "Star twinkle", min: 0, max: 2.5, step: 0.05, default: 1.5, format: "x2" },

  // Finish
  { key: "ambientOcclusion", group: "Finish", label: "Ambient occlusion", min: 0, max: 1, step: 0.05, default: 0.6, format: "pct" },
  { key: "contrast", group: "Finish", label: "Contrast", min: 0.7, max: 1.5, step: 0.01, default: 1.08, format: "x2" },
  { key: "saturation", group: "Finish", label: "Saturation", min: 0, max: 1.8, step: 0.02, default: 1.05, format: "x2" },
  { key: "warmth", group: "Finish", label: "Warmth", min: -1, max: 1, step: 0.05, default: 0, format: "signed", mood: true },
  { key: "vignette", group: "Finish", label: "Vignette", min: 0, max: 1, step: 0.05, default: 0.35, format: "pct" },
  { key: "grain", group: "Finish", label: "Film grain", min: 0, max: 1, step: 0.05, default: 0.25, format: "pct" },
  { key: "chromatic", group: "Finish", label: "Lens fringe", min: 0, max: 1, step: 0.02, default: 0.15, format: "pct" },
  { key: "actMood", group: "Finish", label: "Act mood", min: 0, max: 1, step: 0.05, default: 1, format: "pct" },

  // Warp
  { key: "warpTunnel", group: "Warp", label: "Tunnel", min: 0, max: 2, step: 0.05, default: 1, format: "x2" },
  { key: "warpStreaks", group: "Warp", label: "Streaks", min: 0, max: 2, step: 0.05, default: 1, format: "x2" },
  { key: "warpRing", group: "Warp", label: "Arrival ring", min: 0, max: 2, step: 0.05, default: 1, format: "x2" },
  { key: "warpTail", group: "Warp", label: "Tail", min: 0.02, max: 0.3, step: 0.01, default: 0.06, format: "x2" },
  { key: "warpArrival", group: "Warp", label: "Ring duration", min: 0.15, max: 1.2, step: 0.01, default: 0.42, format: "x2" },

  // Rifle
  { key: "haloSpeed", group: "Rifle", label: "Halo orbit", min: 0, max: 3, step: 0.05, default: 1, format: "x2" },
  { key: "haloSpread", group: "Rifle", label: "Halo spread", min: 0, max: 3, step: 0.05, default: 1, format: "x2" },
  { key: "haloFloat", group: "Rifle", label: "Halo float", min: 0, max: 3, step: 0.05, default: 1, format: "x2" },
  { key: "rifleGlow", group: "Rifle", label: "Rifle glow", min: 0, max: 2, step: 0.05, default: 1, format: "x2" }
] as const satisfies readonly LookParam[];

export type LookKey = (typeof LOOK_PARAMS)[number]["key"];
export type LookSettings = Record<LookKey, number>;

export const DEFAULT_LOOK: LookSettings = Object.fromEntries(LOOK_PARAMS.map((p) => [p.key, p.default])) as LookSettings;

const PARAM_BY_KEY = new Map<string, LookParam>(LOOK_PARAMS.map((p) => [p.key, p]));

export function lookParam(key: string): LookParam | undefined {
  return PARAM_BY_KEY.get(key);
}

/** Clamp and fill a partial/untrusted look into a complete, valid one. */
export function sanitizeLook(input: Partial<Record<string, unknown>> | null | undefined, base: LookSettings = DEFAULT_LOOK): LookSettings {
  const out = { ...base };
  if (!input) return out;
  for (const param of LOOK_PARAMS) {
    const value = Number(input[param.key]);
    if (Number.isFinite(value)) out[param.key] = Math.min(param.max, Math.max(param.min, value));
  }
  return out;
}

export function formatLook(param: LookParam, value: number): string {
  switch (param.format) {
    case "pct": return `${Math.round(value * 100)}%`;
    case "x3": return value.toFixed(3);
    case "x4": return value.toFixed(4);
    case "deg": return `${Math.round(value)}°`;
    case "signed": return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
    case "m": return `${value.toFixed(2)} m`;
    default: return value.toFixed(2);
  }
}
