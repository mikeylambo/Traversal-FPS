import type { RoomSpec } from "../stages";
import {
  crawl, crouchSentry, cube, diamond, drifter, eye, field, floor, lockedGate, low, moving, orbit, ring, sentry,
  hooded, slitWallX, solid, sweep
} from "../authoring";

/**
 * Time Trial: twenty-four bespoke race spaces. None reuses Campaign or Challenge
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
      enemies: [diamond("el-diamond", [4, 3, -2], ["tt-elevator-deck"]), sentry("el-1", eye(0, 1, -4)), sentry("el-2", eye(0, 20, -11), undefined, "-y")]
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
      enemies: [sentry("ff-1", [8, 24, -4]), sentry("ff-2", [14, 17, -12]), sentry("ff-3", [8, 10, -20]), sentry("ff-4", eye(16, 0, -22), undefined, "+y")]
    }
  },

  {
    label: "HANDOFF", inspiredBy: "map-11", goldSeconds: 7,
    room: {
      id: "tt-handoff", grammar: ["airborne-chain", "moving-endpoint"],
      spawn: eye(0, 24, 3), goal: ring(24, 0, -30), requiredKills: 3,
      platforms: [floor(0, 24, 2, 8, 8), floor(24, 0, -30, 8, 8)],
      enemies: [sentry("ho-1", [8, 21, -10]), drifter("ho-2", [16, 12, -20], "y", 1.5, 0.7), sentry("ho-3", eye(24, 0, -28), undefined, "+y")]
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
      enemies: [crouchSentry("cw-1", 0, 0, -12), crouchSentry("cw-2", 2, 0, -27), sentry("cw-3", eye(0, 6, -33))]
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
        sentry("wh-3", eye(18, 12, -10), undefined, "-x")
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
      enemies: [sentry("pi-1", eye(-6, 4, -14)), sentry("pi-2", eye(6, 8, -26)), hooded("pi-3", eye(0, 12, -39), "+z")]
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
        crouchSentry("ga-1", 0, 0, -16), sentry("ga-2", eye(-10, 6, -28)), drifter("ga-3", [0, 9, -34], "x", 4, 0.6),
        sentry("ga-4", eye(10, 6, -40)), orbit("ga-5", [0, 13, -50], "xz", 3, 2, 0.1), sentry("ga-6", eye(0, 10, -58))
      ]
    }
  },

  // ------------------------------------------------------------ v0.16 courses
  {
    label: "BLADE RUN", inspiredBy: "map-18", goldSeconds: 11,
    room: {
      id: "tt-blade-run", grammar: ["airborne-chain", "timing-chain"],
      spawn: eye(0, 2, 8), goal: ring(0, 9, -46), requiredKills: 4,
      platforms: [
        floor(0, 2, 8, 8, 6),
        floor(0, 0, -18, 22, 40),
        solid(-8, -5, 0, 6, -9, -6), solid(5, 8, 0, 8, -21, -18), solid(-8, -5, 0, 7, -33, -30),
        floor(0, 9, -46, 8, 6)
      ],
      enemies: [
        sentry("br-1", eye(-6.5, 6, -7.5)), sentry("br-2", eye(6.5, 8, -19.5)),
        sentry("br-3", eye(-6.5, 7, -31.5)), sentry("br-4", eye(0, 9, -45))
      ],
      hazards: [
        // Blades run through the warp band (5.5-11.5m), not the floor: they cross
        // every pylon top and every line between pylons, so each release is timed.
        sweep("br-a", [0, 8.5, -18], [22, 6, 0.8], "z", 19, 0.09),
        sweep("br-b", [0, 8.5, -18], [22, 6, 0.8], "z", 19, 0.09, Math.PI)
      ]
    }
  },
  {
    label: "STILTS", inspiredBy: "map-22", goldSeconds: 10,
    room: {
      id: "tt-stilts", grammar: ["airborne-chain", "reorientation"],
      spawn: eye(-20, 14, 0), goal: ring(22, 4, -24), requiredKills: 4,
      platforms: [
        solid(-23, -17, -20, 14, -3, 3),
        solid(-10, -6, -20, 10, -14, -10),
        solid(0, 4, -20, 16, -4, 0),
        solid(8, 12, -20, 7, -18, -14),
        solid(18, 26, -20, 4, -28, -20)
      ],
      enemies: [
        sentry("st-1", eye(-8, 10, -12)), sentry("st-2", eye(2, 16, -2)),
        sentry("st-3", eye(10, 7, -16)), hooded("st-4", eye(22, 4, -22), "+y")
      ]
    }
  },
  {
    label: "PINHOLE", inspiredBy: "map-27", goldSeconds: 9,
    room: {
      id: "tt-pinhole", grammar: ["stop-short", "reorientation"],
      spawn: eye(0, 0, 4), goal: ring(0, 13, -30), requiredKills: 3,
      platforms: [floor(0, 0, 0, 14, 10), floor(4, 6, -14, 5, 5), floor(0, 13, -30, 6, 6)],
      enemies: [sentry("ph-1", eye(4, 6, -14)), drifter("ph-2", [-3, 16, -24], "x", 2, 0.6), sentry("ph-3", eye(0, 13, -31))],
      hazards: [
        // Two lethal decks, one hole each: a full Warp always ends inside one.
        field("ph-l1-s", -10, 10, 3, 3.5, -26, -16.5), field("ph-l1-n", -10, 10, 3, 3.5, -11.5, -6),
        field("ph-l1-w", -10, 1.5, 3, 3.5, -16.5, -11.5), field("ph-l1-e", 6.5, 10, 3, 3.5, -16.5, -11.5),
        field("ph-l2-s", -10, 10, 9, 9.5, -38, -33.5), field("ph-l2-n", -10, 10, 9, 9.5, -26.5, -17),
        field("ph-l2-w", -10, -3.5, 9, 9.5, -33.5, -26.5), field("ph-l2-e", 3.5, 10, 9, 9.5, -33.5, -26.5)
      ]
    }
  },
  {
    label: "LOW ORIGIN", inspiredBy: "map-27", goldSeconds: 12,
    room: {
      // Each target is visible only through a knee-high slit: fire and warp from a crouch.
      id: "tt-low-origin", grammar: ["low-profile", "origin-matters"],
      spawn: eye(0, 0, 6), goal: ring(0, 0, -44), requiredKills: 3,
      platforms: [
        floor(0, 0, -19, 12, 54),
        ...slitWallX(-6, 6, -6, 0, 6),
        ...slitWallX(-6, 6, -20, 0, 6),
        ...slitWallX(-6, 6, -34, 0, 6)
      ],
      enemies: [crouchSentry("lo-1", 2, 0, -14), crouchSentry("lo-2", -2, 0, -28), crouchSentry("lo-3", 0, 0, -41)]
    }
  },
  {
    label: "WEAVE", inspiredBy: "map-31", goldSeconds: 13,
    room: {
      // Zig-zag over and under a spine: upper decks alternate sides and climb,
      // lower decks sit on the spine. The last lower Sphere answers only from below.
      id: "tt-weave", grammar: ["reorientation", "route-fork", "low-profile"],
      spawn: eye(-30, 10, 0), goal: ring(30, 16, 0), requiredKills: 6,
      platforms: [
        floor(-28, 10, 0, 8, 6),
        floor(-12, 11, -9, 7, 5), floor(4, 13, 9, 7, 5), floor(18, 15, -9, 7, 5),
        floor(-18, 2, 0, 7, 6), floor(-2, 4, 0, 7, 6), floor(12, 6, 0, 7, 6),
        floor(30, 16, 0, 8, 8)
      ],
      enemies: [
        sentry("wv-1", eye(-18, 2, 0)), sentry("wv-2", eye(-12, 11, -9)), sentry("wv-3", eye(-2, 4, 0)),
        sentry("wv-4", eye(4, 13, 9)), sentry("wv-5", eye(12, 6, 0), undefined, "-y"),
        sentry("wv-6", eye(29, 16, 0))
      ]
    }
  },
  {
    label: "RETURN", inspiredBy: "map-41", goldSeconds: 14,
    room: {
      // The ring is at the start: out through three quadrants and home again.
      id: "tt-return", grammar: ["reorientation", "airborne-chain", "origin-matters"],
      spawn: eye(0, 0, 3), goal: ring(0, 0, -1), requiredKills: 4,
      platforms: [
        floor(0, 0, 1, 10, 8),
        floor(-18, 5, -18, 6, 6), floor(18, 8, -18, 6, 6), floor(18, 3, 18, 6, 6)
      ],
      enemies: [
        sentry("rt-1", eye(-18, 5, -18)), sentry("rt-2", eye(18, 8, -18)), sentry("rt-3", eye(18, 3, 18)),
        sentry("rt-4", eye(3, 0, 2), undefined, "+z")
      ]
    }
  },
  {
    label: "CROSSFIRE", inspiredBy: "map-37", goldSeconds: 12,
    room: {
      id: "tt-crossfire", grammar: ["route-fork", "origin-matters"],
      spawn: eye(0, 0, 0), goal: ring(0, 12, -22), requiredKills: 4,
      platforms: [
        floor(0, 0, 0, 10, 10), floor(-20, 4, 0, 6, 6), floor(20, 6, 0, 6, 6), floor(0, 2, 20, 6, 6),
        floor(0, 12, -22, 8, 6)
      ],
      enemies: [
        sentry("cf-w", eye(-20, 4, 0)), sentry("cf-e", eye(20, 6, 0)), sentry("cf-s", eye(0, 2, 20)),
        hooded("cf-out", eye(0, 12, -21), "+z")
      ]
    }
  },
  {
    label: "UNDERTOW", inspiredBy: "map-38", goldSeconds: 13,
    room: {
      // Sideways over / under: a high deck, the crawl beneath it, and back up.
      id: "tt-undertow", grammar: ["low-profile", "reorientation", "stop-short"],
      spawn: eye(-26, 9, 0), goal: ring(28, 12, -2), requiredKills: 4,
      platforms: [
        floor(-26, 9, 0, 6, 8),
        floor(-2, 0, 0, 30, 14),
        floor(-2, 9, 0, 12, 14),
        crawl(4, 13, -7, 7, 0),
        floor(18, 5, 2, 6, 6),
        floor(28, 12, -2, 8, 8)
      ],
      enemies: [
        sentry("ut-1", eye(-4, 9, 3)), crouchSentry("ut-2", 9, 0, -2),
        drifter("ut-3", [18, 8, 2], "y", 1.5, 0.6), sentry("ut-4", eye(27, 12, -2))
      ]
    }
  },
];
