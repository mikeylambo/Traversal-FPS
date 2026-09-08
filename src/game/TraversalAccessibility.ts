import {
  activeTraversalSettingsStore,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  type ColorProfile,
  type TraversalAccessibilitySettings
} from "./TraversalSettings";
import type { EnemyKind, HazardKind } from "../world/stages";

export const ACCESSIBILITY_EVENT = "traversal:accessibility-changed";

/** Live accessibility state. Read it, don't cache it — the Settings screen is reachable mid-run. */
export function traversalAccessibility(): TraversalAccessibilitySettings {
  return activeTraversalSettingsStore()?.value.accessibility ?? DEFAULT_ACCESSIBILITY_SETTINGS;
}

/**
 * Multiplier applied to anything that reads as a flash: additive bloom spikes,
 * arrival bursts, hazard warning pulses. Reduce Flash never removes the signal,
 * it caps the excursion — a capped cue is still a cue, an absent one is not.
 */
export function flashScale(): number {
  return traversalAccessibility().reduceFlash ? 0.34 : 1;
}

/** Multiplier for camera shake, FOV punch, and large screen-space transforms. */
export function motionScale(): number {
  return traversalAccessibility().reduceMotion ? 0.15 : 1;
}

export interface CueColors {
  /** Body/fill colour. */
  fill: number;
  /** Edge/line colour. Always higher luminance than `fill`. */
  edge: number;
  /**
   * Pulse rate in radians/second. This is the non-colour half of hazard identity:
   * a player who cannot separate the hues still reads sweep (urgent, ~2Hz) from
   * lethal field (slow breathing, ~0.5Hz) from sightline gate (cycle-locked blink).
   * The rates are deliberately far apart, not decorative variation.
   */
  pulseRate: number;
}

/**
 * Deuteranopia and protanopia both collapse the red-green axis, so those profiles
 * move every hazard onto the blue-yellow axis plus lightness. Tritanopia collapses
 * blue-yellow, so it moves them onto red-green.
 *
 * The standard profile is unchanged: this is a remap, not a redesign, and players
 * who do not need it should not see a different game.
 */
const HAZARD_PALETTE: Record<ColorProfile, Record<HazardKind, CueColors>> = {
  standard: {
    "sweep": { fill: 0xff5f7a, edge: 0xffd0d8, pulseRate: 12 },
    "lethal-field": { fill: 0xff9a5d, edge: 0xffb476, pulseRate: 3.4 },
    "sightline-gate": { fill: 0x73e7ff, edge: 0xd7fbff, pulseRate: 8 },
    "aperture-wall": { fill: 0xff7895, edge: 0xffd7df, pulseRate: 7.5 }
  },
  deuteranopia: {
    "sweep": { fill: 0xffcf3d, edge: 0xfff0b8, pulseRate: 12 },
    "lethal-field": { fill: 0xa98cff, edge: 0xd9ccff, pulseRate: 3.4 },
    "sightline-gate": { fill: 0x5cc4ff, edge: 0xd4f0ff, pulseRate: 8 },
    "aperture-wall": { fill: 0xf2f2ff, edge: 0xffffff, pulseRate: 7.5 }
  },
  protanopia: {
    "sweep": { fill: 0xffd75c, edge: 0xfff3c6, pulseRate: 12 },
    "lethal-field": { fill: 0x9d8bff, edge: 0xd2caff, pulseRate: 3.4 },
    "sightline-gate": { fill: 0x54bdff, edge: 0xcfeeff, pulseRate: 8 },
    "aperture-wall": { fill: 0xeeeeff, edge: 0xffffff, pulseRate: 7.5 }
  },
  tritanopia: {
    "sweep": { fill: 0xff3b3b, edge: 0xffc9c9, pulseRate: 12 },
    "lethal-field": { fill: 0x8dff5c, edge: 0xd6ffc2, pulseRate: 3.4 },
    "sightline-gate": { fill: 0x66ffc4, edge: 0xd6fff0, pulseRate: 8 },
    "aperture-wall": { fill: 0xffffff, edge: 0xffffff, pulseRate: 7.5 }
  }
};

/**
 * Spatial actors already carry identity in geometry — utility rings, the shield
 * plate, the drifter axis line — which is exactly the pattern this extends. The
 * colours below only have to stay separable; they never have to carry meaning alone.
 */
const ACTOR_PALETTE: Record<ColorProfile, Record<"sphere" | "shield" | "drifter" | "utility", number>> = {
  standard: { sphere: 0x7cefff, shield: 0xffad66, drifter: 0xff78c8, utility: 0xf2fbff },
  deuteranopia: { sphere: 0x7cefff, shield: 0xffce4d, drifter: 0xc79bff, utility: 0xf2fbff },
  protanopia: { sphere: 0x7cefff, shield: 0xffd75c, drifter: 0xbb96ff, utility: 0xf2fbff },
  tritanopia: { sphere: 0x66ffc4, shield: 0xff6b6b, drifter: 0xffffff, utility: 0xf2fbff }
};

export function hazardCue(kind: HazardKind, profile = traversalAccessibility().colorProfile): CueColors {
  return HAZARD_PALETTE[profile][kind];
}

export function actorColor(kind: EnemyKind, profile = traversalAccessibility().colorProfile): number {
  const palette = ACTOR_PALETTE[profile];
  if (kind === "shield") return palette.shield;
  if (kind === "drifter") return palette.drifter;
  if (kind === "cube" || kind === "diamond" || kind === "prism") return palette.sphere;
  return palette.sphere;
}

export function utilityRingColor(profile = traversalAccessibility().colorProfile): number {
  return ACTOR_PALETTE[profile].utility;
}

export function onAccessibilityChange(handler: () => void): () => void {
  window.addEventListener(ACCESSIBILITY_EVENT, handler);
  return () => window.removeEventListener(ACCESSIBILITY_EVENT, handler);
}
