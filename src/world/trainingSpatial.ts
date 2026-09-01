import type { RoomSpec } from "./stages";

/**
 * Spatial actor onboarding is intentionally literal. Each shape gets one clean
 * demonstration before the final room composes all three with Sphere traversal.
 */
export const SPATIAL_ACTOR_TRAINING: RoomSpec[] = [
  {
    id: "training-cube-state",
    title: "CUBE // STATE",
    lesson: "Cube changes world state. Shoot it to remove the barrier. It never writes a Warp vector.",
    grammar: ["direct-anchor", "reorientation"],
    spawn: [0, 2.2, 8],
    goal: [0, 1.1, -30],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 7], size: [12, 1, 11] },
      { center: [0, 0, -29], size: [11, 1, 10] }
    ],
    enemies: [
      {
        id: "training-cube",
        kind: "cube",
        position: [-3.6, 3.1, -1],
        effect: { type: "disable-hazard", targetIds: ["training-cube-gate"] }
      },
      { id: "training-cube-sphere", kind: "sentry", position: [0, 2.2, -29] }
    ],
    hazards: [
      {
        id: "training-cube-gate",
        kind: "sightline-gate",
        center: [0, 4, -12],
        size: [13, 8, 0.45],
        cycle: { period: 999, openFor: 0.05, phase: 1 }
      }
    ]
  },
  {
    id: "training-diamond-motion",
    title: "DIAMOND // MOTION",
    lesson: "Diamond wakes moving geometry. The platform remains real collision while it moves; the Sphere remains your movement currency.",
    grammar: ["moving-endpoint", "reorientation"],
    spawn: [-7, 2.2, 8],
    goal: [8, 5.1, -33],
    requiredKills: 2,
    platforms: [
      { center: [-7, 0, 7], size: [11, 1, 11] },
      {
        id: "training-diamond-lift",
        center: [0, -4, -11],
        size: [7, 1, 7],
        motion: { axis: "y", amplitude: 8, speed: 0.08, active: false }
      },
      { center: [8, 4, -33], size: [10, 1, 10] }
    ],
    enemies: [
      {
        id: "training-diamond",
        kind: "diamond",
        position: [-3.5, 3.2, -1],
        effect: { type: "activate-platform", targetIds: ["training-diamond-lift"] }
      },
      { id: "training-diamond-sphere-a", kind: "sentry", position: [0, 6.2, -11] },
      { id: "training-diamond-sphere-b", kind: "sentry", position: [8, 6.2, -33] }
    ]
  },
  {
    id: "training-prism-energy",
    title: "PRISM // ENERGY",
    lesson: "Prism reroutes red energy. White structure is ordinary matter; Warp phases through it. Red energy intersects Warp unless you use its opening.",
    grammar: ["stop-short", "reorientation"],
    spawn: [-6, 2.2, 8],
    goal: [6, 1.1, -34],
    requiredKills: 1,
    platforms: [
      { center: [-6, 0, 7], size: [11, 1, 11] },
      { center: [6, 0, -33], size: [11, 1, 10] }
    ],
    enemies: [
      {
        id: "training-prism",
        kind: "prism",
        position: [-2.5, 3.2, -2],
        effect: { type: "shift-aperture", targetIds: ["training-prism-wall"], offset: 8 }
      },
      { id: "training-prism-sphere", kind: "sentry", position: [6, 2.2, -33] }
    ],
    hazards: [
      {
        id: "training-prism-wall",
        kind: "aperture-wall",
        center: [0, 4, -14],
        size: [22, 10, 0.45],
        aperture: { axis: "x", center: -8, span: 3.2 }
      }
    ]
  },
  {
    id: "training-machine-sentence",
    title: "SHAPES // SENTENCE",
    lesson: "Cube changes state. Diamond wakes motion. Prism reroutes energy. Spheres move you. White matter can be phased through; red energy cannot. Gravity Ring ends the sector.",
    grammar: ["stop-short", "moving-endpoint", "reorientation", "airborne-chain"],
    spawn: [0, 2.2, 10],
    goal: [0, 1.1, -64],
    requiredKills: 3,
    platforms: [
      { center: [0, 0, 9], size: [13, 1, 12] },
      {
        id: "training-sentence-lift",
        center: [-8, -4, -20],
        size: [7, 1, 7],
        motion: { axis: "y", amplitude: 8, speed: 0.085, active: false }
      },
      { center: [8, 3, -36], size: [7, 1, 7] },
      { center: [0, 0, -63], size: [12, 1, 10] }
    ],
    enemies: [
      {
        id: "training-sentence-cube",
        kind: "cube",
        position: [4, 3, 1],
        effect: { type: "disable-hazard", targetIds: ["training-sentence-gate"] }
      },
      {
        id: "training-sentence-diamond",
        kind: "diamond",
        position: [-4, 3.6, -8],
        effect: { type: "activate-platform", targetIds: ["training-sentence-lift"] }
      },
      { id: "training-sentence-sphere-a", kind: "sentry", position: [-8, 6.2, -20] },
      { id: "training-sentence-sphere-b", kind: "sentry", position: [8, 6.2, -36] },
      {
        id: "training-sentence-prism",
        kind: "prism",
        position: [4, 7.2, -41],
        effect: { type: "shift-aperture", targetIds: ["training-sentence-wall"], offset: 13 }
      },
      { id: "training-sentence-sphere-c", kind: "sentry", position: [0, 2.2, -64] }
    ],
    hazards: [
      {
        id: "training-sentence-gate",
        kind: "sightline-gate",
        center: [0, 4, -5],
        size: [14, 8, 0.45],
        cycle: { period: 999, openFor: 0.05, phase: 1 }
      },
      {
        id: "training-sentence-wall",
        kind: "aperture-wall",
        center: [0, 5, -49],
        size: [24, 11, 0.45],
        aperture: { axis: "x", center: -7, span: 3.5 }
      }
    ]
  }
];