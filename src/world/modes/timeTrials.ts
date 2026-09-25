import type { RoomSpec } from "../stages";
import {
  crawl, cube, diamond, drifter, eye, floor, lockedGate, low, moving, orbit, ring, sentry,
  shield, solid
} from "../authoring";

/**
 * Time Trial: sixteen bespoke race spaces. None reuses Campaign or Challenge
 * geometry; each takes one Campaign idea and rebuilds it around speed — multiple
 * lines, risky cuts, chains and interceptions.
 */
/** A wall across a step boundary with a window band that fits a descending line. */
function slalomWall(z: number, lowTop: number, highTop: number, winX0: number, winX1: number) {
  const y0 = lowTop;
  const y1 = highTop + 6;
  const w0 = lowTop + 3;
  const w1 = highTop + 2;
  return [
    solid(-7, winX0, y0, y1, z - 0.5, z + 0.5),
    solid(winX1, 7, y0, y1, z - 0.5, z + 0.5),
    solid(winX0, winX1, y0, w0, z - 0.5, z + 0.5),
    solid(winX0, winX1, w1, y1, z - 0.5, z + 0.5)
  ];
}

export interface TimeTrialCourse {
  label: string;
  inspiredBy?: string;
  goldSeconds: number;
  room: Omit<RoomSpec, "title" | "lesson">;
}

export const TIME_TRIAL_COURSES: TimeTrialCourse[] = [
  {
    label: "DOWNHILL", inspiredBy: "map-01", goldSeconds: 9,
    room: {
      id: "tt-downhill", grammar: ["direct-anchor", "airborne-chain"],
      spawn: eye(0, 16, 5), goal: ring(4, 0, -55), requiredKills: 4,
      platforms: [floor(0, 16, 4, 8, 8), floor(-8, 12, -12, 5, 5), floor(6, 8, -26, 5, 5), floor(-6, 4, -40, 5, 5), floor(4, 0, -54, 8, 8)],
      enemies: [sentry("dh-1", eye(-8, 12, -12)), sentry("dh-2", eye(6, 8, -26)), sentry("dh-3", eye(-6, 4, -40)), sentry("dh-4", eye(4, 0, -53))]
    }
  },
  {
    label: "DRIFT WINDOW", inspiredBy: "map-02", goldSeconds: 11,
    room: {
      id: "tt-drift-window", grammar: ["moving-endpoint", "stop-short"],
      spawn: eye(-20, 0, 12), goal: ring(22, 4, -32), requiredKills: 3,
      platforms: [floor(-20, 0, 10, 8, 8), floor(-6, 2, -4, 4, 4), floor(8, 3, -18, 4, 4), floor(22, 4, -32, 8, 8)],
      enemies: [drifter("dw-1", eye(-6, 2, -4), "y", 2.5, 0.5), drifter("dw-2", eye(8, 3, -18), "x", 4, 0.62), drifter("dw-3", eye(21, 4, -30), "y", 2, 0.74)]
    }
  },


  {
    label: "BACK ANGLE", inspiredBy: "map-03", goldSeconds: 7,
    room: {
      id: "tt-back-angle", grammar: ["reorientation", "origin-matters"],
      spawn: eye(0, 0, 1), goal: ring(0, 4, -21), requiredKills: 2,
      platforms: [floor(0, 0, 0, 12, 8), solid(-14, 14, 0, 6, -8, -6.5), floor(0, 12, 26, 5, 5), floor(0, 4, -20, 10, 8)],
      enemies: [sentry("ba-1", eye(0, 12, 25)), sentry("ba-2", eye(0, 4, -19)), drifter("ba-decoy", [8, 7, -2], "y", 2, 0.6)]
    }
  },

  {
    label: "SLALOM", inspiredBy: "map-04", goldSeconds: 10,
    room: {
      id: "tt-slalom", grammar: ["reorientation", "stop-short"],
      spawn: eye(0, 18, 2), goal: ring(0, 0, -36), requiredKills: 4,
      platforms: [
        floor(0, 18, -1, 14, 10), floor(0, 12, -11, 14, 10), floor(0, 6, -21, 14, 10), floor(0, 0, -32, 14, 12),
        ...slalomWall(-6, 12, 18, -5, -2),
        ...slalomWall(-16, 6, 12, 2, 5),
        ...slalomWall(-26, 0, 6, -5, -2)
      ],
      enemies: [sentry("sl-1", eye(-3.5, 12, -9)), sentry("sl-2", eye(3.5, 6, -19)), sentry("sl-3", eye(-3.5, 0, -29)), sentry("sl-4", eye(0, 0, -37))]
    }
  },


  {
    label: "ELEVATOR", inspiredBy: "map-05", goldSeconds: 9,
    room: {
      id: "tt-elevator", grammar: ["moving-endpoint", "stop-short"],
      spawn: eye(0, 0, 4), goal: ring(0, 20, -12), requiredKills: 2,
      platforms: [floor(0, 0, 4, 10, 8), moving(floor(0, 10, -4, 5, 5), "tt-elevator-deck", "y", 9, 0.1, true), floor(0, 20, -12, 8, 6)],
      enemies: [diamond("el-diamond", [4, 3, -2], ["tt-elevator-deck"]), sentry("el-1", eye(0, 1, -4)), sentry("el-2", eye(0, 20, -11), undefined, { axis: "y", min: 14 })]
    }
  },

  {
    label: "CORNER CUT", inspiredBy: "map-06", goldSeconds: 8,
    room: {
      id: "tt-corner-cut", grammar: ["route-fork", "stop-short"],
      spawn: eye(0, 0, 3), goal: ring(30, 0, -28), requiredKills: 3,
      platforms: [floor(0, 0, -12, 8, 32), floor(18, 0, -28, 28, 8), floor(12, 2, -12, 2, 2)],
      enemies: [sentry("cc-1", eye(0, 0, -24)), sentry("cc-2", eye(12, 2, -12)), sentry("cc-3", eye(28, 0, -28)), orbit("cc-4", [16, 6, -8], "xz", 3, 3, 0.1)]
    }
  },
  {
    label: "SWITCHYARD", inspiredBy: "map-09", goldSeconds: 10,
    room: {
      id: "tt-switchyard", grammar: ["origin-matters", "reorientation"],
      spawn: eye(0, 0, 3), goal: ring(0, 6, -35), requiredKills: 3,
      platforms: [floor(0, 0, 0, 10, 10), floor(-10, 3, -16, 6, 6), floor(10, 3, -16, 6, 6), floor(0, 6, -34, 8, 6)],
      enemies: [cube("sy-cube", [0, 3, -10], ["sy-gate"]), sentry("sy-1", eye(-10, 3, -16)), sentry("sy-2", eye(10, 3, -16)), sentry("sy-3", eye(0, 6, -33))],
      hazards: [lockedGate("sy-gate", -4, 4, 5, 12, -28)]
    }
  },
  {
    label: "OUT AND BACK", inspiredBy: "map-10", goldSeconds: 14,
    room: {
      id: "tt-out-and-back", grammar: ["route-fork", "reorientation"],
      spawn: eye(0, 8, 2), goal: ring(3, 8, -2), requiredKills: 4,
      platforms: [floor(0, 8, 0, 10, 8), floor(-14, 4, -14, 5, 5), floor(0, 0, -28, 5, 5), floor(14, 4, -14, 5, 5), solid(-4, 4, 0, 14, -18, -10)],
      enemies: [sentry("ob-1", eye(-14, 4, -14)), sentry("ob-2", eye(0, 0, -28)), sentry("ob-3", eye(14, 4, -14)), sentry("ob-home", eye(-3, 8, 1))]
    }
  },
  {
    label: "CORKSCREW", inspiredBy: "map-33", goldSeconds: 12,
    room: {
      id: "tt-corkscrew", grammar: ["reorientation", "airborne-chain"],
      spawn: eye(0, 0, 8), goal: ring(0, 21, -6), requiredKills: 4,
      platforms: [floor(0, 0, 8, 12, 8), solid(-1.5, 1.5, 0, 20, -7.5, -4.5), floor(10, 5, -6, 5, 5), floor(0, 10, -16, 5, 5), floor(-10, 15, -6, 5, 5), floor(0, 20.5, -6, 8, 8)],
      enemies: [sentry("cs-1", eye(10, 5, -6)), sentry("cs-2", eye(0, 10, -16)), sentry("cs-3", eye(-10, 15, -6)), sentry("cs-4", eye(-3, 20.5, -6))]
    }
  },
  {
    label: "FREEFALL", inspiredBy: "map-36", goldSeconds: 8,
    room: {
      id: "tt-freefall", grammar: ["airborne-chain", "stop-short"],
      spawn: eye(0, 30, 3), goal: ring(16, 0, -24), requiredKills: 4,
      platforms: [floor(0, 30, 3, 8, 6), floor(16, 0, -24, 10, 10)],
      enemies: [sentry("ff-1", [8, 24, -4]), sentry("ff-2", [14, 17, -12]), sentry("ff-3", [8, 10, -20]), sentry("ff-4", eye(16, 0, -22), undefined, { axis: "y", max: 12 })]
    }
  },

  {
    label: "HANDOFF", inspiredBy: "map-11", goldSeconds: 7,
    room: {
      id: "tt-handoff", grammar: ["airborne-chain", "moving-endpoint"],
      spawn: eye(0, 24, 3), goal: ring(24, 0, -30), requiredKills: 3,
      platforms: [floor(0, 24, 2, 8, 8), floor(24, 0, -30, 8, 8)],
      enemies: [sentry("ho-1", [8, 21, -10]), drifter("ho-2", [16, 12, -20], "y", 1.5, 0.7), sentry("ho-3", eye(24, 0, -28), undefined, { axis: "x", min: 12 })]
    }
  },

  {
    label: "GALLERY SPRINT", inspiredBy: "map-39", goldSeconds: 10,
    room: {
      id: "tt-gallery-sprint", grammar: ["stop-short", "reorientation"],
      spawn: eye(-30, 0, 0), goal: ring(34, 0, -4), requiredKills: 4,
      platforms: [floor(-30, 0, 0, 8, 8), floor(-12, 2, -6, 5, 5), floor(4, 0, 4, 5, 5), floor(20, 3, -8, 5, 5), floor(34, 0, -4, 8, 8)],
      enemies: [sentry("gs-1", eye(-12, 2, -6)), sentry("gs-2", eye(4, 0, 4)), sentry("gs-3", eye(20, 3, -8)), sentry("gs-4", eye(33, 0, -4))]
    }
  },
  {
    label: "CRAWLWAY", inspiredBy: "map-34", goldSeconds: 11,
    room: {
      id: "tt-crawlway", grammar: ["low-profile", "stop-short"],
      spawn: eye(0, 0, 0), goal: ring(0, 6, -10), requiredKills: 3,
      platforms: [
        floor(0, 0, -20, 10, 44),
        crawl(-5, 5, -30, -2, 0),
        floor(0, 6, -16, 10, 28),
        floor(0, 6, -32, 10, 4)
      ],
      enemies: [sentry("cw-1", low(0, 0, -12)), sentry("cw-2", low(2, 0, -27)), sentry("cw-3", eye(0, 6, -33))]
    }
  },


  {
    label: "WHEEL", inspiredBy: "map-26", goldSeconds: 12,
    room: {
      id: "tt-wheel", grammar: ["moving-endpoint", "airborne-chain"],
      spawn: eye(-18, 0, -10), goal: ring(20, 12, -10), requiredKills: 3,
      platforms: [floor(-18, 0, -10, 8, 10), floor(20, 12, -10, 8, 8)],
      enemies: [
        orbit("wh-1", [0, 10, -10], "yz", 8, 8, 0.08, 0),
        orbit("wh-2", [0, 10, -10], "yz", 8, 8, 0.08, 3.1),
        sentry("wh-3", eye(18, 12, -10), undefined, { axis: "y", min: 14 })
      ]
    }
  },


  {
    label: "PISTONS", inspiredBy: "map-30", goldSeconds: 11,
    room: {
      id: "tt-pistons", grammar: ["moving-endpoint", "stop-short"],
      spawn: eye(0, 0, 3), goal: ring(0, 12, -40), requiredKills: 3,
      platforms: [
        floor(0, 0, 2, 8, 8),
        moving(floor(-6, 4, -14, 4, 4), "tt-piston-a", "y", 4, 0.15),
        moving(floor(6, 8, -26, 4, 4), "tt-piston-b", "y", 4, 0.13, false, 1.5),
        floor(0, 12, -40, 8, 6)
      ],
      enemies: [sentry("pi-1", eye(-6, 4, -14)), sentry("pi-2", eye(6, 8, -26)), shield("pi-3", eye(0, 12, -39), { axis: "y", min: 9 })]
    }
  },
  {
    label: "GAUNTLET", inspiredBy: "map-32", goldSeconds: 18,
    room: {
      id: "tt-gauntlet", grammar: ["low-profile", "airborne-chain", "stop-short", "reorientation"],
      spawn: eye(0, 0, 4), goal: ring(0, 10, -60), requiredKills: 6,
      platforms: [
        floor(0, 0, 0, 10, 12),
        solid(-12, -1.5, 0, 14, -8, -6.5), solid(1.5, 12, 0, 14, -8, -6.5), solid(-1.5, 1.5, 0, 0.8, -8, -6.5), solid(-1.5, 1.5, 1.35, 14, -8, -6.5),
        floor(0, 0, -16, 6, 6),
        floor(-10, 6, -28, 5, 5), floor(10, 6, -40, 5, 5),
        floor(0, 10, -60, 8, 8)
      ],
      enemies: [
        sentry("ga-1", low(0, 0, -16)), sentry("ga-2", eye(-10, 6, -28)), drifter("ga-3", [0, 9, -34], "x", 4, 0.6),
        sentry("ga-4", eye(10, 6, -40)), orbit("ga-5", [0, 13, -50], "xz", 3, 2, 0.1), sentry("ga-6", eye(0, 10, -58))
      ]
    }
  }
];
