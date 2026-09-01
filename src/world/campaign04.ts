import type { RoomSpec } from "./stages";

/**
 * CROSSCURRENT is the first combination sector: moving destinations, Stop Short,
 * reorientation, occlusion, and lethal timing all operate in the same continuous
 * field. Orbit is introduced in a quiet well before the junction asks the player
 * to use it under pressure.
 */
export const MAP_04_FIELD: RoomSpec[] = [
  {
    id: "sector-04-crosscurrent",
    title: "CROSSCURRENT",
    lesson: "Read the whole line. A valid vector is not necessarily a safe one.",
    grammar: ["moving-endpoint", "stop-short", "reorientation", "airborne-chain", "origin-matters", "route-fork"],
    spawn: [0, 2.2, 25],
    goal: [0, 1.1, -169],
    requiredKills: 7,
    platforms: [
      // First Crossing
      { center: [0, 0, 23], size: [18, 1, 15] },
      { center: [0, 0, -7], size: [11, 1, 9] },

      // Passing Window / Broken Current
      { center: [-13, 2, -33], size: [8, 1, 8] },
      { center: [12, 4.5, -55], size: [7, 1, 7] },
      { center: [0, 2, -73], size: [12, 1, 9] },
      { center: [-11, 7, -55], size: [7, 1, 7] },

      // Orbit Well
      { center: [0, -1, -91], size: [9, 1, 9] },
      { center: [0, 7.5, -91], size: [4, 1, 4] },
      { center: [15, 3.5, -106], size: [8, 1, 8] },

      // Crosscurrent Junction
      { center: [-15, 5.5, -124], size: [8, 1, 8] },
      { center: [0, 1, -141], size: [12, 1, 9] },
      { center: [15, 6, -124], size: [7, 1, 7] },
      { center: [0, 0, -168], size: [17, 1, 14] },

      // Readable current machinery and occluders
      { center: [7, 5, -20], size: [1, 10, 18] },
      { center: [-4, 5.5, -45], size: [1, 11, 16] },
      { center: [0, 3.5, -91], size: [2.2, 13, 2.2] },
      { center: [-6, 5, -115], size: [1.2, 10, 17] },
      { center: [7, 5, -151], size: [1.2, 10, 16] }
    ],
    enemies: [
      { id: "cross-entry", kind: "drifter", position: [0, 2.2, -18], drift: { axis: "x", amplitude: 4.5, speed: 0.62 } },
      { id: "cross-window", kind: "drifter", position: [-13, 4.2, -39], drift: { axis: "y", amplitude: 2, speed: 0.72 } },
      { id: "cross-rise", kind: "drifter", position: [12, 7.2, -55], drift: { axis: "y", amplitude: 3.2, speed: 0.82 } },
      { id: "cross-break", kind: "sentry", position: [0, 4.2, -80], radius: 0.62 },

      // Orbit's base is its locus; the endpoint continuously changes altitude and angle.
      { id: "cross-orbit-intro", kind: "orbit", position: [0, 5.2, -91], radius: 0.64, orbit: { plane: "xy", radiusA: 8, radiusB: 3.2, speed: 0.72 } },
      { id: "cross-orbit-transfer", kind: "orbit", position: [7, 7, -106], radius: 0.62, orbit: { plane: "yz", radiusA: 4.5, radiusB: 6, speed: 0.64, phase: 1.6 } },

      // Junction offers an outer/static route and a faster orbit route.
      { id: "cross-junction-left", kind: "drifter", position: [-15, 7.7, -124], drift: { axis: "y", amplitude: 2, speed: 0.68 } },
      { id: "cross-junction-orbit", kind: "orbit", position: [0, 7, -132], radius: 0.68, orbit: { plane: "xy", radiusA: 13, radiusB: 4.5, speed: 0.58, phase: 0.8 } },
      { id: "cross-junction-right", kind: "sentry", position: [15, 8.2, -124], radius: 0.58 },
      { id: "cross-counterflow", kind: "sentry", position: [-2, -0.2, -151], radius: 0.5 },
      { id: "cross-final", kind: "sentry", position: [0, 3.2, -178], radius: 0.68 }
    ],
    hazards: [
      { id: "cross-sweep-entry", kind: "sweep", center: [0, 4.1, -11], size: [0.55, 8.2, 22], drift: { axis: "x", amplitude: 15, speed: 0.34, phase: 0.2 } },
      { id: "cross-window-gate", kind: "sightline-gate", center: [-7, 4.3, -26], size: [13, 8.6, 0.42], cycle: { period: 2.7, openFor: 1.05, phase: 0.35 } },
      { id: "cross-broken-sweep", kind: "sweep", center: [3, 5, -63], size: [24, 0.55, 18], drift: { axis: "y", amplitude: 5, speed: 0.3, phase: 0.65 } },
      { id: "cross-junction-sweep-x", kind: "sweep", center: [0, 5, -132], size: [0.55, 10, 32], drift: { axis: "x", amplitude: 19, speed: 0.3, phase: 0.15 } },
      { id: "cross-junction-sweep-y", kind: "sweep", center: [0, 5, -132], size: [31, 0.55, 22], drift: { axis: "y", amplitude: 6, speed: 0.27, phase: 1.4 } },
      { id: "cross-final-gate", kind: "sightline-gate", center: [0, 4.2, -156], size: [16, 8.4, 0.42], cycle: { period: 3, openFor: 1.2, phase: 0.75 } }
    ]
  }
];

export const MAP_04_COURSE: RoomSpec[] = [
  {
    id: "map-04-01", title: "SAFE LINE", lesson: "The endpoint is valid. The line is not. Release when the current clears.",
    grammar: ["moving-endpoint", "stop-short"], spawn: [0, 2.2, 7], goal: [0, 1.1, -18], requiredKills: 1,
    platforms: [{ center: [0, 0, 6], size: [11, 1, 10] }, { center: [0, 0, -18], size: [8, 1, 8] }],
    enemies: [{ id: "m4-safe-drift", kind: "drifter", position: [0, 2.2, -31], drift: { axis: "x", amplitude: 5, speed: 0.66 } }],
    hazards: [{ id: "m4-safe-sweep", kind: "sweep", center: [0, 4, -10], size: [0.5, 8, 20], drift: { axis: "x", amplitude: 11, speed: 0.42 } }]
  },
  {
    id: "map-04-02", title: "ORBIT", lesson: "The endpoint changes the line and arrival angle together. Choose the useful arc.",
    grammar: ["moving-endpoint", "stop-short", "origin-matters"], spawn: [0, 2.2, 8], goal: [8, 1.1, -25], requiredKills: 1,
    platforms: [{ center: [0, 0, 7], size: [11, 1, 11] }, { center: [0, 0, -11], size: [5, 1, 5] }, { center: [8, 0, -25], size: [9, 1, 9] }],
    enemies: [{ id: "m4-orbit", kind: "orbit", position: [0, 5, -20], orbit: { plane: "xy", radiusA: 9, radiusB: 3, speed: 0.72 } }]
  },
  {
    id: "map-04-03", title: "ALIGNMENT", lesson: "Two cycles briefly create one route. Read their relationship, not either target alone.",
    grammar: ["moving-endpoint", "airborne-chain", "reorientation"], spawn: [-8, 2.2, 7], goal: [8, 1.1, -36], requiredKills: 2,
    platforms: [{ center: [-8, 0, 6], size: [10, 1, 10] }, { center: [0, 3, -14], size: [5, 1, 5] }, { center: [8, 0, -36], size: [10, 1, 10] }],
    enemies: [
      { id: "m4-align-a", kind: "orbit", position: [-1, 6, -13], orbit: { plane: "xy", radiusA: 7, radiusB: 2.5, speed: 0.64 } },
      { id: "m4-align-b", kind: "orbit", position: [6, 6, -31], orbit: { plane: "yz", radiusA: 3.5, radiusB: 5, speed: 0.58, phase: 1.4 } }
    ]
  },
  {
    id: "map-04-04", title: "CROSSING", lesson: "Maintain the aerial chain while the world cuts across it.",
    grammar: ["airborne-chain", "moving-endpoint", "reorientation"], spawn: [-8, 2.2, 7], goal: [8, 1.1, -39], requiredKills: 2,
    platforms: [{ center: [-8, 0, 6], size: [10, 1, 10] }, { center: [8, 0, -39], size: [11, 1, 10] }, { center: [0, 2, -17], size: [6, 1, 6] }],
    enemies: [
      { id: "m4-crossing-a", kind: "drifter", position: [0, 6, -17], drift: { axis: "y", amplitude: 3, speed: 0.72 } },
      { id: "m4-crossing-b", kind: "orbit", position: [6, 6, -34], orbit: { plane: "xy", radiusA: 5, radiusB: 3, speed: 0.68, phase: 0.7 } }
    ],
    hazards: [{ id: "m4-crossing-sweep", kind: "sweep", center: [0, 4.5, -26], size: [0.5, 9, 20], drift: { axis: "x", amplitude: 12, speed: 0.35, phase: 0.4 } }]
  },
  {
    id: "map-04-05", title: "CROSSCURRENT", lesson: "Choose a route, read the cycles, and write one continuous solution.",
    grammar: ["route-fork", "moving-endpoint", "stop-short", "reorientation", "airborne-chain"], spawn: [0, 2.2, 8], goal: [0, 1.1, -53], requiredKills: 3,
    platforms: [
      { center: [0, 0, 7], size: [13, 1, 11] }, { center: [-10, 2, -14], size: [7, 1, 7] },
      { center: [10, 4, -27], size: [7, 1, 7] }, { center: [-7, 1, -39], size: [7, 1, 7] },
      { center: [0, 0, -53], size: [13, 1, 10] }
    ],
    enemies: [
      { id: "m4-final-left", kind: "drifter", position: [-10, 4.2, -14], drift: { axis: "y", amplitude: 2, speed: 0.65 } },
      { id: "m4-final-orbit", kind: "orbit", position: [2, 7, -27], orbit: { plane: "xy", radiusA: 8, radiusB: 3, speed: 0.62 } },
      { id: "m4-final-safe", kind: "sentry", position: [10, 6.2, -27] },
      { id: "m4-final-low", kind: "drifter", position: [-7, 3.2, -44], drift: { axis: "x", amplitude: 3, speed: 0.78 } },
      { id: "m4-final-exit", kind: "sentry", position: [0, 2.8, -61] }
    ],
    hazards: [
      { id: "m4-final-gate", kind: "sightline-gate", center: [0, 4, -9], size: [13, 8, 0.4], cycle: { period: 2.7, openFor: 1.05 } },
      { id: "m4-final-sweep", kind: "sweep", center: [0, 5, -34], size: [0.5, 10, 22], drift: { axis: "x", amplitude: 14, speed: 0.34, phase: 0.5 } }
    ]
  }
];
