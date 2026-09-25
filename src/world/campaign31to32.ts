import type { CampaignMapDefinition } from "./campaign";
import type { HazardSpec, RoomSpec } from "./stages";
import {
  apertureX, crawl, cube, diamond, drifter, eye, floor, low, moving, orbit, prism, ring,
  sentry, shield, solid, sweep
} from "./authoring";

/** Act IV openers, rebuilt: synthesis across stacked space, then the wall. */

// SYNTHESIS — a broken bridge. Deck spans sit over catwalks; each catwalk owns one
// actor (Cube, a crouch-hidden Diamond, Prism). The route weaves above and below
// the deck, then the Diamond's shuttle and the Prism's aperture reach the ring.
const S31_GATE: HazardSpec = {
  id: "syn-gate",
  kind: "sightline-gate",
  center: [3, 11, 0],
  size: [0.45, 6, 6],
  cycle: { period: 999, openFor: 0.05, phase: 1 }
};

const S31: RoomSpec = {
  id: "sector-31-synthesis",
  title: "SYNTHESIS",
  lesson: "No dominant actor. Read the relationship among Cube, Diamond, Prism, hazards and Spheres before choosing a route.",
  grammar: ["route-fork", "origin-matters", "moving-endpoint", "low-profile"],
  spawn: eye(-27, 10, 0),
  goal: ring(29, 10, -18),
  requiredKills: 7,
  platforms: [
    floor(-24, 10, 0, 12, 6),
    floor(-6, 10, 0, 12, 6),
    floor(12, 10, 0, 12, 6),
    floor(27, 10, -17, 10, 6),
    floor(-14, 4, 0, 12, 6),
    floor(4, 4, 0, 12, 6),
    floor(22, 4, 0, 12, 6),
    crawl(-2, 4, -3, 3, 4),
    moving(floor(20, 10, -6, 4, 4), "syn-shuttle", "z", 6, 0.08, true)
  ],
  enemies: [
    sentry("syn-01", eye(-15, 4, 0)),
    cube("syn-cube", [-18, 6, 2], ["syn-gate"]),
    sentry("syn-02", eye(-11, 10, 1)),
    sentry("syn-03", eye(3, 4, 0)),
    diamond("syn-diamond", [0, 4.8, 1], ["syn-shuttle"]),
    sentry("syn-04", eye(7, 10, 0)),
    prism("syn-prism", [24, 6, -2], ["syn-aperture"], -25),
    drifter("syn-05", [22, 7, 2], "y", 1, 0.7),
    orbit("syn-06", [0, 14, -8], "xz", 6, 4, 0.08),
    shield("syn-07", eye(27, 10, -16), { axis: "z", max: -8 })
  ],
  hazards: [
    S31_GATE,
    apertureX("syn-aperture", 16, 34, 6, 16, -9, 20, 3)
  ]
};

// VECTOR — the Great Wall. From the first second the ring is visible through a
// gated crouch slit at the wall's base. Climb the face, clear the top, find the
// far-side Cube, drop back down, and write one final crouched line through it.
const S32_SLIT_GATE: HazardSpec = {
  id: "vec-slit",
  kind: "sightline-gate",
  center: [0, 1.075, -8.5],
  size: [4, 0.55, 0.45],
  cycle: { period: 999, openFor: 0.05, phase: 1 }
};

const S32: RoomSpec = {
  id: "sector-32-vector",
  title: "VECTOR",
  lesson: "The construct is the boss. Transform it, cross it, then write one final clean line.",
  grammar: ["stop-short", "low-profile", "reorientation", "origin-matters"],
  spawn: eye(0, 0, 4),
  goal: ring(0, 0, -40),
  requiredKills: 7,
  platforms: [
    floor(0, 0, 0, 40, 12),
    solid(-24, -2, 0, 24, -10, -7),
    solid(2, 24, 0, 24, -10, -7),
    solid(-2, 2, 0, 0.8, -10, -7),
    solid(-2, 2, 1.35, 24, -10, -7),
    floor(-16, 6, -5, 6, 4),
    floor(14, 12, -5, 6, 4),
    floor(-6, 18, -5, 6, 4),
    floor(0, 0, -40, 8, 8)
  ],
  enemies: [
    sentry("vec-01", eye(-16, 6, -5)),
    sentry("vec-02", eye(14, 12, -5)),
    sentry("vec-03", eye(-6, 18, -5)),
    sentry("vec-04", eye(10, 24, -7.6)),
    cube("vec-cube", [-10, 4, -30], ["vec-slit"]),
    orbit("vec-05", [0, 10, -28], "xz", 6, 4, 0.08),
    drifter("vec-06", [12, 8, -24], "y", 2, 0.6),
    sentry("vec-final", low(0, 0, -38), undefined, { axis: "y", max: 3 })
  ],
  hazards: [
    S32_SLIT_GATE,
    sweep("vec-sweep", [0, 25.5, -8.5], [0.8, 3, 3], "x", 22, 0.08)
  ]
};

export const ROOMS_31_TO_32: RoomSpec[] = [S31, S32];

export const MAPS_31_TO_32: CampaignMapDefinition[] = ROOMS_31_TO_32.map((room, i) => {
  const n = i + 31;
  return {
    id: `map-${n}`,
    label: `SECTOR ${String(n).padStart(2, "0")} // ${room.title}`,
    subtitle: room.lesson,
    focus: room.grammar,
    implemented: true,
    campaignRooms: [room],
    courseRooms: [structuredClone(room) as RoomSpec]
  };
});
