import type { RoomSpec } from "./stages";

export const MAP_03_FIELD: RoomSpec[] = [
  {
    id: "sector-03-occlusion",
    title: "OCCLUSION",
    lesson: "Find the line. Change your origin when the construct takes it away.",
    grammar: ["origin-matters", "reorientation", "low-profile", "stop-short", "route-fork"],
    spawn: [0, 2.2, 24],
    goal: [0, 1.1, -132],
    requiredKills: 5,
    platforms: [
      { center: [0, 0, 22], size: [18, 1, 15] },
      { center: [10, 0, -3], size: [9, 1, 8] },
      { center: [-15, 2.5, -36], size: [8, 1, 8] },
      { center: [16, 4.5, -61], size: [8, 1, 8] },
      { center: [-5, 1.2, -84], size: [12, 1, 10] },
      { center: [11, 2.8, -105], size: [8, 1, 8] },
      { center: [0, 0, -131], size: [16, 1, 13] },

      { center: [-11.5, 5, -16], size: [13, 10, 1.4] },
      { center: [8.5, 5, -16], size: [7, 10, 1.4] },

      { center: [-6, 6, -49], size: [15, 12, 1.4] },
      { center: [12, 3.2, -49], size: [7, 6.4, 1.4] },
      { center: [12, 9.2, -49], size: [7, 3.6, 1.4] },

      { center: [5.5, 5.5, -75], size: [15, 11, 1.4] },
      { center: [-11.5, 2.3, -75], size: [7, 4.6, 1.4] },
      { center: [-11.5, 8.6, -75], size: [7, 4, 1.4] },

      { center: [-5, 3.25, -91], size: [11, 0.8, 8] },
      { center: [-11, 1.6, -91], size: [0.8, 3.2, 8] },
      { center: [1, 1.6, -91], size: [0.8, 3.2, 8] },

      { center: [-5, 6, -115], size: [17, 12, 1.4] },
      { center: [12.5, 4.5, -115], size: [6, 9, 1.4] }
    ],
    enemies: [
      { id: "occlusion-origin", kind: "shield", position: [10, 2.2, -3] },
      { id: "occlusion-slot", kind: "sentry", position: [-15, 5.3, -36], radius: 0.52 },
      { id: "occlusion-high", kind: "sentry", position: [16, 6.7, -61], radius: 0.58 },

      // Alternate low route. From the high platform the vector crosses the
      // -84 landing well inside its footprint before continuing beyond it.
      { id: "occlusion-low", kind: "drifter", position: [-8, 3.1, -92], radius: 0.55, drift: { axis: "x", amplitude: 3, speed: 0.58 } },

      // Higher alternate route lands directly on the -105 platform.
      { id: "occlusion-alt", kind: "drifter", position: [11, 6.1, -105], radius: 0.55, drift: { axis: "y", amplitude: 2.8, speed: 0.72 } },

      // Both late routes converge on a final vector that passes through the
      // completion platform, making the final Stop Short leg unambiguous.
      { id: "occlusion-final", kind: "sentry", position: [0, 3.2, -140], radius: 0.6 }
    ]
  }
];

export const MAP_03_COURSE: RoomSpec[] = [
  {
    id: "map-03-01",
    title: "ANGLE",
    lesson: "The target rejects this origin. Move right, then write the vector from the valid line.",
    grammar: ["origin-matters"],
    spawn: [-5, 2.2, 7],
    goal: [7, 1.1, -24],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 5], size: [18, 1, 11] },
      { center: [7, 0, -23], size: [9, 1, 9] }
    ],
    enemies: [{ id: "m3-angle", kind: "shield", position: [7, 2.2, -21] }]
  },
  {
    id: "map-03-02",
    title: "APERTURE",
    lesson: "The shot exists through one narrow opening. Scope if you need the precision.",
    grammar: ["origin-matters", "stop-short"],
    spawn: [0, 2.2, 8],
    goal: [-8, 1.1, -30],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 7], size: [12, 1, 11] },
      { center: [-8, 0, -30], size: [8, 1, 8] },
      { center: [-7, 5, -9], size: [9, 10, 1.2] },
      { center: [7, 5, -9], size: [9, 10, 1.2] }
    ],
    enemies: [{ id: "m3-aperture", kind: "sentry", position: [-8, 3.2, -38], radius: 0.48 }]
  },
  {
    id: "map-03-03",
    title: "LOW SIGHT",
    lesson: "The standing line is blocked. Lower your profile and take the shot beneath the structure.",
    grammar: ["low-profile", "origin-matters"],
    spawn: [0, 2.2, 8],
    goal: [0, 1.1, -25],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 6], size: [12, 1, 12] },
      { center: [0, 2.35, -3], size: [10, 0.75, 7] },
      { center: [-5.4, 1.5, -3], size: [0.8, 3, 7] },
      { center: [5.4, 1.5, -3], size: [0.8, 3, 7] },
      { center: [0, 0, -25], size: [10, 1, 9] }
    ],
    enemies: [{ id: "m3-low", kind: "sentry", position: [0, 1.55, -31], radius: 0.55 }]
  },
  {
    id: "map-03-04",
    title: "BACK ANGLE",
    lesson: "The first vector gives you the only useful angle on the second target.",
    grammar: ["reorientation", "airborne-chain"],
    spawn: [-7, 2.2, 7],
    goal: [-8, 1.1, -35],
    requiredKills: 2,
    platforms: [
      { center: [-7, 0, 6], size: [10, 1, 10] },
      { center: [10, 3, -11], size: [6, 1, 6] },
      { center: [-8, 0, -35], size: [10, 1, 10] },
      { center: [0, 5, -20], size: [1.4, 10, 22] }
    ],
    enemies: [
      { id: "m3-back-perch", kind: "sentry", position: [10, 5.2, -11] },
      { id: "m3-back-exit", kind: "sentry", position: [-8, 4.2, -35], radius: 0.55 }
    ]
  },
  {
    id: "map-03-05",
    title: "OCCLUSION",
    lesson: "Read the walls before you fire. A clean route is a sequence of useful sightlines.",
    grammar: ["origin-matters", "reorientation", "low-profile", "route-fork", "stop-short"],
    spawn: [0, 2.2, 9],
    goal: [0, 1.1, -48],
    requiredKills: 2,
    platforms: [
      { center: [0, 0, 8], size: [14, 1, 12] },
      { center: [-10, 2, -16], size: [7, 1, 7] },
      { center: [10, 3.5, -29], size: [7, 1, 7] },
      { center: [0, 0, -48], size: [13, 1, 10] },
      { center: [-5, 5, -7], size: [8, 10, 1.2] },
      { center: [6, 2.4, -21], size: [1.2, 4.8, 14] },
      { center: [-4, 6, -35], size: [10, 12, 1.2] }
    ],
    enemies: [
      { id: "m3-final-left", kind: "sentry", position: [-10, 4.2, -16], radius: 0.58 },
      { id: "m3-final-right", kind: "sentry", position: [10, 5.7, -29], radius: 0.52 },
      { id: "m3-final-drift", kind: "drifter", position: [-3, 6.2, -57], radius: 0.5, drift: { axis: "x", amplitude: 5.5, speed: 0.68 } },
      { id: "m3-final-exit", kind: "sentry", position: [0, 2.8, -45], radius: 0.56 }
    ]
  }
];
