import type { RoomSpec } from "./stages";

/**
 * ACT II opens by expanding the world vocabulary without expanding the player's
 * movement verbs. Spheres still write every vector. Utility geometry only changes
 * the machine the player is reading.
 */
export const MAP_09_FIELD: RoomSpec[] = [
  {
    id: "sector-09-machine-language",
    title: "MACHINE LANGUAGE",
    lesson: "Spheres move you. Everything else changes the machine. Read shape before color.",
    grammar: ["direct-anchor", "stop-short", "reorientation", "origin-matters", "route-fork", "airborne-chain"],
    spawn: [0, 2.2, 22],
    goal: [0, 1.1, -116],
    requiredKills: 5,
    platforms: [
      { center: [0, 0, 20], size: [16, 1, 14] },
      { center: [-9, 1, -7], size: [8, 1, 8] },
      {
        id: "machine-lift",
        center: [9, -4, -27],
        size: [7, 1, 7],
        motion: { axis: "y", amplitude: 9, speed: 0.075, phase: 0, active: false }
      },
      { center: [6, 5, -43], size: [8, 1, 8] },
      { center: [6, 1, -66], size: [8, 1, 8] },
      { center: [-10, -5, -84], size: [9, 1, 9] },
      { center: [0, 2, -103], size: [8, 1, 8] },
      { center: [0, 0, -116], size: [15, 1, 12] },
      { center: [-2, 5, -17], size: [1, 10, 16] },
      { center: [10, 5, -52], size: [1, 10, 17] },
      { center: [-4, 2, -94], size: [1, 12, 16] }
    ],
    enemies: [
      {
        id: "machine-cube",
        kind: "cube",
        position: [4.5, 3.1, 11],
        radius: 0.78,
        effect: { type: "disable-hazard", targetIds: ["machine-entry-gate"] }
      },
      { id: "machine-entry-sphere", kind: "sentry", position: [-9, 3.2, -7] },
      {
        id: "machine-diamond",
        kind: "diamond",
        position: [-9, 4.4, -10],
        radius: 0.82,
        effect: { type: "activate-platform", targetIds: ["machine-lift"] }
      },
      { id: "machine-lift-sphere", kind: "sentry", position: [9, 7.2, -27], radius: 0.68 },
      { id: "machine-mid-sphere", kind: "sentry", position: [6, 7.2, -43] },
      {
        id: "machine-prism",
        kind: "prism",
        position: [3.2, 7.4, -46],
        radius: 0.78,
        effect: { type: "shift-aperture", targetIds: ["machine-aperture"], offset: 12 }
      },
      { id: "machine-aperture-sphere", kind: "sentry", position: [6, 3.2, -66] },
      { id: "machine-down-sphere", kind: "sentry", position: [-10, -2.8, -84], radius: 0.66 },
      { id: "machine-rise-sphere", kind: "sentry", position: [0, 4.2, -103], radius: 0.68 }
    ],
    hazards: [
      {
        id: "machine-entry-gate",
        kind: "sightline-gate",
        center: [0, 4.5, 1],
        size: [17, 9, 0.45],
        cycle: { period: 999, openFor: 0.05, phase: 1 }
      },
      {
        id: "machine-aperture",
        kind: "aperture-wall",
        center: [0, 4.2, -56],
        size: [22, 11, 0.48],
        aperture: { axis: "x", center: -6, span: 4.8 }
      },
      {
        id: "machine-late-sweep",
        kind: "sweep",
        center: [0, 1, -94],
        size: [0.5, 12, 18],
        drift: { axis: "x", amplitude: 15, speed: 0.22, phase: 0.4 }
      }
    ]
  }
];

export const MAP_09_COURSE: RoomSpec[] = [
  {
    id: "map-09-01",
    title: "CUBE",
    lesson: "A Cube changes world state. It never writes a vector.",
    grammar: ["direct-anchor"],
    spawn: [0, 2.2, 7],
    goal: [0, 1.1, -24],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 6], size: [11, 1, 10] },
      { center: [0, 0, -24], size: [9, 1, 8] }
    ],
    enemies: [
      { id: "m9-cube", kind: "cube", position: [4, 2.8, -1], effect: { type: "disable-hazard", targetIds: ["m9-cube-gate"] } },
      { id: "m9-cube-sphere", kind: "sentry", position: [0, 2.2, -24] }
    ],
    hazards: [
      { id: "m9-cube-gate", kind: "sightline-gate", center: [0, 4, -8], size: [12, 8, 0.4], cycle: { period: 999, openFor: 0.05, phase: 1 } }
    ]
  },
  {
    id: "map-09-02",
    title: "DIAMOND",
    lesson: "A Diamond wakes motion. Ride the changing origin; the Sphere is still your movement currency.",
    grammar: ["reorientation", "origin-matters"],
    spawn: [-7, 2.2, 7],
    goal: [7, 6.1, -31],
    requiredKills: 2,
    platforms: [
      { center: [-7, 0, 6], size: [10, 1, 10] },
      { id: "m9-lift", center: [0, -4, -10], size: [7, 1, 7], motion: { axis: "y", amplitude: 8, speed: 0.08, active: false } },
      { center: [7, 5, -31], size: [10, 1, 10] }
    ],
    enemies: [
      { id: "m9-diamond", kind: "diamond", position: [-4, 3, 2], effect: { type: "activate-platform", targetIds: ["m9-lift"] } },
      { id: "m9-lift-sphere", kind: "sentry", position: [0, 6.2, -10] },
      { id: "m9-lift-exit", kind: "sentry", position: [7, 7.2, -31] }
    ]
  },
  {
    id: "map-09-03",
    title: "PRISM",
    lesson: "A Prism reroutes energy. Move the safe aperture into your vector before committing.",
    grammar: ["stop-short", "reorientation"],
    spawn: [-6, 2.2, 7],
    goal: [6, 1.1, -31],
    requiredKills: 1,
    platforms: [
      { center: [-6, 0, 6], size: [10, 1, 10] },
      { center: [6, 0, -31], size: [10, 1, 10] }
    ],
    enemies: [
      { id: "m9-prism", kind: "prism", position: [-2, 3, -2], effect: { type: "shift-aperture", targetIds: ["m9-aperture"], offset: 11 } },
      { id: "m9-prism-sphere", kind: "sentry", position: [6, 2.2, -31] }
    ],
    hazards: [
      { id: "m9-aperture", kind: "aperture-wall", center: [0, 4, -12], size: [20, 10, 0.45], aperture: { axis: "x", center: -6, span: 5 } }
    ]
  },
  {
    id: "map-09-04",
    title: "MACHINE LANGUAGE",
    lesson: "Read the machine: Cube, Diamond, Prism, Spheres, Gravity Ring. Shape tells you what matters.",
    grammar: ["route-fork", "reorientation", "stop-short", "origin-matters"],
    spawn: [0, 2.2, 8],
    goal: [0, 1.1, -50],
    requiredKills: 3,
    platforms: [
      { center: [0, 0, 7], size: [13, 1, 11] },
      { center: [-8, 2, -13], size: [7, 1, 7] },
      { id: "m9-final-lift", center: [8, -3, -27], size: [7, 1, 7], motion: { axis: "y", amplitude: 7, speed: 0.09, active: false } },
      { center: [6, 2, -39], size: [7, 1, 7] },
      { center: [0, 0, -50], size: [12, 1, 10] }
    ],
    enemies: [
      { id: "m9-final-cube", kind: "cube", position: [4, 3, 0], effect: { type: "disable-hazard", targetIds: ["m9-final-gate"] } },
      { id: "m9-final-a", kind: "sentry", position: [-8, 4.2, -13] },
      { id: "m9-final-diamond", kind: "diamond", position: [-8, 5.4, -16], effect: { type: "activate-platform", targetIds: ["m9-final-lift"] } },
      { id: "m9-final-b", kind: "sentry", position: [8, 6.2, -27] },
      { id: "m9-final-prism", kind: "prism", position: [5, 5, -32], effect: { type: "shift-aperture", targetIds: ["m9-final-aperture"], offset: 10 } },
      { id: "m9-final-c", kind: "sentry", position: [6, 4.2, -39] }
    ],
    hazards: [
      { id: "m9-final-gate", kind: "sightline-gate", center: [0, 4, -5], size: [13, 8, 0.4], cycle: { period: 999, openFor: 0.05, phase: 1 } },
      { id: "m9-final-aperture", kind: "aperture-wall", center: [0, 4, -34], size: [18, 10, 0.45], aperture: { axis: "x", center: -5, span: 4.5 } }
    ]
  }
];
