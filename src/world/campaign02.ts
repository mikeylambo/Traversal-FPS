import type { RoomSpec } from "./stages";

export const MAP_02_FIELD: RoomSpec[] = [
  {
    id: "sector-02-timing-field",
    title: "TIMING FIELD",
    lesson: "Read the cycles. Write the route when the field allows it.",
    grammar: ["moving-endpoint", "stop-short", "reorientation", "route-fork"],
    spawn: [0, 2.2, 20],
    goal: [0, 1.1, -112],
    requiredKills: 5,
    platforms: [
      { center: [0, 0, 18], size: [16, 1, 14] },
      { center: [0, 0, -8], size: [10, 1, 8] },
      { center: [-12, 2, -29], size: [8, 1, 8] },
      { center: [0, 4, -49], size: [8, 1, 8] },
      { center: [14, 1.5, -68], size: [8, 1, 9] },
      { center: [0, 0, -88], size: [12, 1, 10] },
      { center: [0, 0, -111], size: [15, 1, 12] },
      { center: [-7, 5, -41], size: [1, 10, 18] },
      { center: [7, 5, -80], size: [1, 10, 18] }
    ],
    enemies: [
      { id: "timing-window", kind: "sentry", position: [0, 2.2, -29] },
      { id: "timing-drift-a", kind: "drifter", position: [-4, 6, -47], drift: { axis: "x", amplitude: 10, speed: 0.68 } },
      { id: "timing-high", kind: "sentry", position: [0, 7.2, -58] },
      { id: "timing-drift-b", kind: "drifter", position: [8, 4.5, -78], drift: { axis: "x", amplitude: 7, speed: 0.92 } },
      { id: "timing-final", kind: "sentry", position: [0, 3.2, -101] },
      { id: "timing-alt", kind: "drifter", position: [-10, 6.2, -94], drift: { axis: "y", amplitude: 2.4, speed: 1.05 } }
    ],
    hazards: [
      {
        id: "timing-gate-a",
        kind: "sightline-gate",
        center: [0, 3.2, -18],
        size: [15, 6.5, 0.42],
        cycle: { period: 2.45, openFor: 0.82, phase: 0.1 }
      },
      {
        id: "timing-sweep-a",
        kind: "sweep",
        center: [0, 4.2, -62],
        size: [0.55, 8.4, 22],
        drift: { axis: "x", amplitude: 18, speed: 0.42, phase: 0.2 }
      },
      {
        id: "timing-gate-b",
        kind: "sightline-gate",
        center: [6.5, 4.2, -86],
        size: [0.45, 8.4, 18],
        cycle: { period: 2.9, openFor: 1.05, phase: 0.8 }
      }
    ]
  }
];

export const MAP_02_COURSE: RoomSpec[] = [
  {
    id: "map-02-01",
    title: "WINDOW",
    lesson: "The line of sight is temporary. Fire in the opening.",
    grammar: ["direct-anchor", "stop-short"],
    spawn: [0, 2.2, 7],
    goal: [0, 1.1, -16],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 5], size: [11, 1, 10] },
      { center: [0, 0, -16], size: [8, 1, 7] }
    ],
    enemies: [{ id: "m2-window", kind: "sentry", position: [0, 2.2, -28] }],
    hazards: [
      {
        id: "m2-window-gate",
        kind: "sightline-gate",
        center: [0, 3, -10],
        size: [10, 6, 0.4],
        cycle: { period: 2.35, openFor: 0.9 }
      }
    ]
  },
  {
    id: "map-02-02",
    title: "RELEASE",
    lesson: "The route is clear only part of the cycle. Commit when the sweep is away.",
    grammar: ["stop-short"],
    spawn: [0, 2.2, 7],
    goal: [0, 1.1, -18],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 6], size: [10, 1, 10] },
      { center: [0, 0, -18], size: [8, 1, 8] }
    ],
    enemies: [{ id: "m2-release", kind: "sentry", position: [0, 2.2, -30] }],
    hazards: [
      {
        id: "m2-release-sweep",
        kind: "sweep",
        center: [0, 4, -9],
        size: [0.55, 8, 20],
        drift: { axis: "x", amplitude: 11, speed: 0.5 }
      }
    ]
  },
  {
    id: "map-02-03",
    title: "DRIFT WINDOW",
    lesson: "Wait for both the opening and the destination.",
    grammar: ["moving-endpoint", "stop-short"],
    spawn: [0, 2.2, 7],
    goal: [8, 1.1, -21],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 6], size: [10, 1, 10] },
      { center: [8, 0, -21], size: [6, 1, 8] }
    ],
    enemies: [
      { id: "m2-drift-window", kind: "drifter", position: [0, 2.2, -29], drift: { axis: "x", amplitude: 12, speed: 0.76 } }
    ],
    hazards: [
      {
        id: "m2-drift-gate",
        kind: "sightline-gate",
        center: [0, 3, -10],
        size: [11, 6, 0.4],
        cycle: { period: 2.7, openFor: 1.0, phase: 0.4 }
      }
    ]
  },
  {
    id: "map-02-04",
    title: "CROSSING",
    lesson: "Reorient, then cross the moving field on your timing.",
    grammar: ["reorientation", "airborne-chain"],
    spawn: [-7, 2.2, 7],
    goal: [8, 1.1, -31],
    requiredKills: 2,
    platforms: [
      { center: [-7, 0, 6], size: [10, 1, 10] },
      { center: [8, 2, -9], size: [6, 1, 6] },
      { center: [8, 0, -31], size: [10, 1, 10] }
    ],
    enemies: [
      { id: "m2-cross-perch", kind: "sentry", position: [8, 4.2, -9] },
      { id: "m2-cross-exit", kind: "sentry", position: [8, 4.2, -26] }
    ],
    hazards: [
      {
        id: "m2-cross-sweep",
        kind: "sweep",
        center: [2, 4, -18],
        size: [0.5, 8, 18],
        drift: { axis: "x", amplitude: 10, speed: 0.56, phase: 0.35 }
      }
    ]
  },
  {
    id: "map-02-05",
    title: "TIMING FIELD",
    lesson: "Read the opening, choose the endpoint, then choose the release.",
    grammar: ["moving-endpoint", "stop-short", "reorientation", "route-fork"],
    spawn: [0, 2.2, 8],
    goal: [0, 1.1, -42],
    requiredKills: 2,
    platforms: [
      { center: [0, 0, 7], size: [13, 1, 11] },
      { center: [-8, 2, -13], size: [7, 1, 7] },
      { center: [8, 2, -25], size: [7, 1, 7] },
      { center: [0, 0, -42], size: [12, 1, 10] }
    ],
    enemies: [
      { id: "m2-final-left", kind: "drifter", position: [-2, 5, -14], drift: { axis: "x", amplitude: 7, speed: 0.82 } },
      { id: "m2-final-right", kind: "sentry", position: [8, 4.2, -25] },
      { id: "m2-final-exit", kind: "sentry", position: [0, 3.2, -38] }
    ],
    hazards: [
      {
        id: "m2-final-gate",
        kind: "sightline-gate",
        center: [0, 3.5, -8],
        size: [12, 7, 0.42],
        cycle: { period: 2.55, openFor: 0.9, phase: 0.25 }
      },
      {
        id: "m2-final-sweep",
        kind: "sweep",
        center: [0, 4, -29],
        size: [0.52, 8, 18],
        drift: { axis: "x", amplitude: 12, speed: 0.48, phase: 0.7 }
      }
    ]
  }
];
