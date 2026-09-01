import type { RoomSpec } from "./stages";

/**
 * VERTICAL RETURN deliberately lowers visual complexity while raising navigational
 * commitment. The Gravity Ring is visible at the start, but the player must spend a
 * long Sphere sequence descending into the construct and then route back to it.
 */
export const MAP_10_FIELD: RoomSpec[] = [
  {
    id: "sector-10-vertical-return",
    title: "VERTICAL RETURN",
    lesson: "The Gravity Ring is where you began. Ten Spheres take you down through the construct and back to it.",
    grammar: ["direct-anchor", "stop-short", "reorientation", "origin-matters", "route-fork", "airborne-chain"],
    spawn: [0, 2.2, 20],
    goal: [0, 1.1, 20],
    requiredKills: 10,
    platforms: [
      { center: [0, 0, 20], size: [16, 1, 14] },
      { center: [9, -4, 2], size: [8, 1, 8] },
      { center: [-9, -8, -14], size: [8, 1, 8] },
      { center: [10, -13, -31], size: [8, 1, 8] },
      { center: [-8, -18, -47], size: [8, 1, 8] },
      { center: [0, -24, -60], size: [11, 1, 10] },
      { center: [11, -18, -43], size: [8, 1, 8] },
      { center: [-10, -12, -25], size: [8, 1, 8] },
      { center: [9, -6, -7], size: [8, 1, 8] },
      { center: [-7, 0, 8], size: [8, 1, 8] },
      { center: [0, 4, 16], size: [7, 1, 7] },

      // Sparse ribs make the descent readable without turning the room into a maze.
      { center: [0, -7, -6], size: [1, 18, 12] },
      { center: [1, -16, -38], size: [1, 20, 13] }
    ],
    enemies: [
      { id: "return-01", kind: "sentry", position: [9, -1.8, 2], radius: 0.66 },
      { id: "return-02", kind: "sentry", position: [-9, -5.8, -14], radius: 0.66 },
      { id: "return-03", kind: "sentry", position: [10, -10.8, -31], radius: 0.66 },
      { id: "return-04", kind: "sentry", position: [-8, -15.8, -47], radius: 0.66 },
      { id: "return-05", kind: "sentry", position: [0, -21.8, -60], radius: 0.7 },

      // The route now reverses direction and climbs through familiar coordinates.
      { id: "return-06", kind: "sentry", position: [11, -15.8, -43], radius: 0.66 },
      { id: "return-07", kind: "sentry", position: [-10, -9.8, -25], radius: 0.66 },
      { id: "return-08", kind: "sentry", position: [9, -3.8, -7], radius: 0.66 },
      { id: "return-09", kind: "sentry", position: [-7, 2.2, 8], radius: 0.66 },
      { id: "return-10", kind: "sentry", position: [0, 2.2, 20], radius: 0.72 }
    ]
  }
];

export const MAP_10_COURSE: RoomSpec[] = [
  {
    id: "map-10-01",
    title: "TEN COUNT",
    lesson: "Nothing moves. Nothing changes state. Ten Spheres are the puzzle.",
    grammar: ["direct-anchor", "stop-short", "route-fork"],
    spawn: [0, 2.2, 8],
    goal: [0, 1.1, -64],
    requiredKills: 10,
    platforms: [
      { center: [0, 0, 7], size: [13, 1, 11] },
      { center: [-8, 1, -7], size: [7, 1, 7] },
      { center: [8, -1, -15], size: [7, 1, 7] },
      { center: [-9, 2, -23], size: [7, 1, 7] },
      { center: [9, 0, -31], size: [7, 1, 7] },
      { center: [-8, -2, -39], size: [7, 1, 7] },
      { center: [8, 3, -47], size: [7, 1, 7] },
      { center: [-7, 0, -55], size: [7, 1, 7] },
      { center: [0, 0, -64], size: [12, 1, 10] }
    ],
    enemies: [
      { id: "ten-01", kind: "sentry", position: [-8, 3.2, -7] },
      { id: "ten-02", kind: "sentry", position: [8, 1.2, -15] },
      { id: "ten-03", kind: "sentry", position: [-9, 4.2, -23] },
      { id: "ten-04", kind: "sentry", position: [9, 2.2, -31] },
      { id: "ten-05", kind: "sentry", position: [-8, 0.2, -39] },
      { id: "ten-06", kind: "sentry", position: [8, 5.2, -47] },
      { id: "ten-07", kind: "sentry", position: [-7, 2.2, -55] },
      { id: "ten-08", kind: "sentry", position: [4, 5.8, -58] },
      { id: "ten-09", kind: "sentry", position: [-4, 4.6, -61] },
      { id: "ten-10", kind: "sentry", position: [0, 2.2, -64] }
    ]
  },
  {
    id: "map-10-02",
    title: "DOWN AND BACK",
    lesson: "The exit is behind you. Descend first; the second half is the return route.",
    grammar: ["reorientation", "airborne-chain", "origin-matters"],
    spawn: [0, 2.2, 14],
    goal: [0, 1.1, 14],
    requiredKills: 8,
    platforms: [
      { center: [0, 0, 14], size: [13, 1, 11] },
      { center: [8, -4, -2], size: [7, 1, 7] },
      { center: [-8, -9, -17], size: [7, 1, 7] },
      { center: [7, -15, -31], size: [7, 1, 7] },
      { center: [0, -20, -43], size: [9, 1, 8] },
      { center: [-8, -13, -24], size: [7, 1, 7] },
      { center: [8, -7, -8], size: [7, 1, 7] },
      { center: [-6, -2, 5], size: [7, 1, 7] }
    ],
    enemies: [
      { id: "back-01", kind: "sentry", position: [8, -1.8, -2] },
      { id: "back-02", kind: "sentry", position: [-8, -6.8, -17] },
      { id: "back-03", kind: "sentry", position: [7, -12.8, -31] },
      { id: "back-04", kind: "sentry", position: [0, -17.8, -43] },
      { id: "back-05", kind: "sentry", position: [-8, -10.8, -24] },
      { id: "back-06", kind: "sentry", position: [8, -4.8, -8] },
      { id: "back-07", kind: "sentry", position: [-6, 0.2, 5] },
      { id: "back-08", kind: "sentry", position: [0, 2.2, 14] }
    ]
  },
  {
    id: "map-10-03",
    title: "ELEVATION EQUATION",
    lesson: "The next useful Sphere alternates above and below you. Read height as part of the route.",
    grammar: ["airborne-chain", "reorientation", "stop-short"],
    spawn: [0, 2.2, 7],
    goal: [0, 1.1, -42],
    requiredKills: 7,
    platforms: [
      { center: [0, 0, 6], size: [11, 1, 10] },
      { center: [-7, 7, -7], size: [7, 1, 7] },
      { center: [7, -5, -15], size: [7, 1, 7] },
      { center: [-8, 10, -23], size: [7, 1, 7] },
      { center: [8, -8, -31], size: [7, 1, 7] },
      { center: [0, 5, -36], size: [7, 1, 7] },
      { center: [0, 0, -42], size: [11, 1, 9] }
    ],
    enemies: [
      { id: "elev-01", kind: "sentry", position: [-7, 9.2, -7] },
      { id: "elev-02", kind: "sentry", position: [7, -2.8, -15] },
      { id: "elev-03", kind: "sentry", position: [-8, 12.2, -23] },
      { id: "elev-04", kind: "sentry", position: [8, -5.8, -31] },
      { id: "elev-05", kind: "sentry", position: [0, 7.2, -36] },
      { id: "elev-06", kind: "sentry", position: [5, 2.2, -40] },
      { id: "elev-07", kind: "sentry", position: [0, 2.2, -42] }
    ]
  }
];
