import type { HazardSpec, RoomSpec } from "../stages";
import {
  apertureX, crawl, cube, diamond, drifter, eye, field, floor, lockedGate, low, moving, orbit,
  prism, ring, sentry, shield, slitWallX, slitWallZ, solid, sweep
} from "../authoring";

/**
 * Challenge: twenty-four bespoke constraint chambers. Exact Sphere count (an extra
 * kill fails the chamber), one spare miss. Decoys are there to be left alive;
 * crouch lanes, origin gates and ring-at-start rooms carry the logic.
 */
export type ChallengeFamily = "PRECISION" | "LOGIC" | "FLOW" | "SYNTHESIS";

export interface ChallengeChamber {
  label: string;
  family: ChallengeFamily;
  inspiredBy?: string;
  room: Omit<RoomSpec, "title" | "lesson">;
}

const xGate = (id: string, x: number, y0: number, y1: number, z0: number, z1: number): HazardSpec => ({
  id, kind: "sightline-gate", center: [x, (y0 + y1) / 2, (z0 + z1) / 2], size: [0.45, y1 - y0, z1 - z0],
  cycle: { period: 999, openFor: 0.05, phase: 1 }
});

export const CHALLENGE_CHAMBERS: ChallengeChamber[] = [
  // ---------------------------------------------------------------- PRECISION
  {
    label: "FIRST PRINCIPLE", family: "PRECISION", inspiredBy: "map-01",
    room: {
      id: "ch-first-principle", grammar: ["stop-short"],
      spawn: eye(0, 14, 0), goal: ring(6, 0, -14), requiredKills: 1,
      platforms: [floor(0, 14, 1, 6, 6), floor(6, 0, -14, 4, 4)],
      enemies: [sentry("fp-1", [8.1, -3.2, -18.5]), drifter("fp-decoy", [3, 9, -7], "x", 4, 0.4)]
    }
  },

  {
    label: "LOW LINE", family: "PRECISION", inspiredBy: "map-34",
    room: {
      id: "ch-low-line", grammar: ["low-profile", "origin-matters"],
      spawn: eye(-12, 0, 0), goal: ring(12, 0, 0), requiredKills: 1,
      platforms: [floor(0, 0, 0, 30, 8), ...slitWallZ(-4, 4, -4, 0, 6, 1.5), crawl(-3.25, 8, -4, 4, 0)],
      enemies: [sentry("ll-1", low(6, 0, 0)), sentry("ll-decoy", eye(6, 0, 1.5))]
    }
  },

  {
    label: "NEEDLE", family: "PRECISION", inspiredBy: "map-25",
    room: {
      id: "ch-needle", grammar: ["stop-short", "origin-matters"],
      spawn: eye(0, 0, 4), goal: ring(0, 14, -14), requiredKills: 2,
      platforms: [floor(0, 0, 4, 8, 8), floor(8, 6, -8, 1.4, 1.4), floor(0, 14, -14, 5, 5)],
      enemies: [sentry("nd-1", [11.2, 10.1, -12.8]), sentry("nd-2", eye(2, 14, -12), undefined, { axis: "x", min: 7 }), sentry("nd-decoy", [-6, 9, -10])]
    }
  },

  {
    label: "ANGLE", family: "PRECISION", inspiredBy: "map-03",
    room: {
      id: "ch-angle", grammar: ["origin-matters", "reorientation"],
      spawn: eye(0, 0, 2), goal: ring(3, 0, -1), requiredKills: 3,
      platforms: [floor(0, 0, 0, 24, 8), floor(-10, 4, -14, 4, 4), floor(10, 4, -14, 4, 4)],
      enemies: [
        shield("an-1", eye(-10, 4, -14), { axis: "x", min: 6 }),
        shield("an-2", eye(10, 4, -14), { axis: "x", max: -6 }),
        sentry("an-home", eye(-3, 0, -2), undefined, { axis: "y", min: 3 }),
        sentry("an-decoy", [0, 8, -14])
      ]
    }
  },

  {
    label: "CEILING", family: "PRECISION", inspiredBy: "map-38",
    room: {
      id: "ch-ceiling", grammar: ["low-profile", "stop-short"],
      spawn: eye(0, 6, -10), goal: ring(0, 0, 18), requiredKills: 1,
      platforms: [
        floor(0, 6, -6, 10, 12), floor(0, 0, 6, 12, 36),
        solid(-6, 6, 0, 0.8, 8, 8.5), solid(-6, 6, 1.35, 3, 8, 16),
        // Capped chamber beyond the slit: the only way in is the crouched line.
        solid(-6, 6, 3, 3.6, 16, 24.5)
      ],
      enemies: [sentry("ce-1", [0, 1.06, 40]), sentry("ce-decoy", [0, 1.8, 30])]
    }
  },


  {
    label: "APERTURE", family: "PRECISION", inspiredBy: "map-14",
    room: {
      id: "ch-aperture", grammar: ["origin-matters", "stop-short"],
      spawn: eye(0, 2, -3), goal: ring(-6, 2, 20), requiredKills: 1,
      platforms: [floor(0, 2, -2, 16, 6), floor(-6, 2, 20, 5, 5)],
      enemies: [prism("ap-prism", [6, 5, -10], ["ap-wall"], -14), sentry("ap-1", [-8, 3.7, 26]), sentry("ap-decoy", eye(6, 2, 20))],
      hazards: [apertureX("ap-wall", -10, 10, -2, 8, 8, 12, 2.5)]
    }
  },

  // -------------------------------------------------------------------- LOGIC
  {
    label: "ORDER", family: "LOGIC", inspiredBy: "map-19",
    room: {
      id: "ch-order", grammar: ["route-fork", "reorientation"],
      spawn: eye(0, 12, 4), goal: ring(12, 0, -24), requiredKills: 3,
      platforms: [floor(0, 12, 3, 6, 6), floor(-10, 8, -10, 5, 5), floor(4, 4, -18, 5, 5), floor(12, 0, -24, 6, 6)],
      enemies: [
        sentry("or-1", eye(-10, 8, -11.5)),
        sentry("or-2", eye(4, 4, -19.5), undefined, { axis: "y", max: 11 }),
        sentry("or-3", eye(12, 0, -23), undefined, { axis: "y", max: 7 }),
        drifter("or-decoy", [0, 10, -6], "x", 4, 0.5)
      ]
    }
  },
  {
    label: "LEAVE ONE", family: "LOGIC", inspiredBy: "map-13",
    room: {
      id: "ch-leave-one", grammar: ["route-fork", "stop-short"],
      spawn: eye(0, 0, 6), goal: ring(0, 10, -12), requiredKills: 2,
      platforms: [floor(0, 0, 6, 6, 6), solid(-1.5, 1.5, 0, 9.5, -13.5, -10.5), floor(0, 10, -12, 5, 5), floor(-10, 3, -12, 4, 4), floor(0, 5, -24, 4, 4), floor(10, 7, -12, 4, 4)],
      enemies: [
        sentry("lo-l", eye(-10, 3, -12)), sentry("lo-f", eye(0, 5, -24)), sentry("lo-r", eye(10, 7, -12)),
        sentry("lo-final", eye(0, 10, -12), undefined, { axis: "y", min: 8 })
      ]
    }
  },

  {
    label: "SWITCH", family: "LOGIC", inspiredBy: "map-12",
    room: {
      id: "ch-switch", grammar: ["origin-matters", "reorientation"],
      spawn: eye(0, 0, 4), goal: ring(17, 3, -14), requiredKills: 2,
      platforms: [
        floor(0, 0, 2, 12, 8), floor(0, 0, -14, 12, 12), floor(16, 3, -14, 6, 6),
        solid(-8, -1.5, 0, 10, -6.75, -5.25), solid(1.5, 8, 0, 10, -6.75, -5.25),
        solid(-1.5, 1.5, 0, 1, -6.75, -5.25), solid(-1.5, 1.5, 3.5, 10, -6.75, -5.25)
      ],
      enemies: [cube("sw-cube", [0, 20, -12], ["sw-gate"]), sentry("sw-1", eye(0, 0, -16)), sentry("sw-2", eye(15, 3, -14), undefined, { axis: "z", max: -8 }), sentry("sw-decoy", eye(-4, 0, -12))],
      hazards: [lockedGate("sw-gate", -1.5, 1.5, 1, 3.5, -6)]
    }
  },

  {
    label: "BEHIND YOU", family: "LOGIC", inspiredBy: "map-13",
    room: {
      id: "ch-behind-you", grammar: ["reorientation", "origin-matters"],
      spawn: eye(0, 4, -2), goal: ring(0, 4, 24), requiredKills: 2,
      platforms: [floor(0, 4, -2, 8, 8), solid(-8, 8, 4, 12, 3, 4.5), floor(-12, 8, -12, 5, 5), floor(0, 4, 24, 6, 6)],
      enemies: [sentry("by-1", eye(-12, 8, -12)), sentry("by-2", eye(0, 4, 23), undefined, { axis: "y", min: 8 }), sentry("by-decoy", [10, 6, -14])]
    }
  },
  {
    label: "TWIN LANES", family: "LOGIC", inspiredBy: "map-38",
    room: {
      id: "ch-twin-lanes", grammar: ["origin-matters", "route-fork"],
      spawn: eye(-13, 0, -6), goal: ring(13, 0, -6), requiredKills: 2,
      platforms: [
        floor(0, 0, -6, 30, 4),
        floor(-10.5, 6, -6, 9, 4), floor(2, 6, -6, 8, 4), floor(12.5, 6, -6, 5, 4)
      ],
      enemies: [
        sentry("tl-1", eye(12, 6, -6), undefined, { axis: "y", max: 3 }),
        sentry("tl-2", eye(-4, 0, -6), undefined, { axis: "y", min: 5 }),
        sentry("tl-decoy", eye(-12, 6, -6))
      ]
    }
  },

  {
    label: "TWO STATES", family: "LOGIC", inspiredBy: "map-28",
    room: {
      id: "ch-two-states", grammar: ["origin-matters", "reorientation"],
      spawn: eye(0, 0, 0), goal: ring(0, 0, -20), requiredKills: 2,
      platforms: [floor(0, 0, -10, 12, 26), solid(-6, 6, 0, 10, -8.75, -7.25), floor(-12, 4, -20, 5, 5), floor(12, 4, -20, 5, 5)],
      enemies: [
        cube("ts-cube-a", [-4, 2, -2], ["ts-gate-a"]), cube("ts-cube-b", [-12, 7, -22], ["ts-gate-b"]),
        sentry("ts-1", eye(-12, 4, -19)), sentry("ts-2", eye(0, 0, -20)), sentry("ts-decoy", eye(12, 4, -20))
      ],
      hazards: [lockedGate("ts-gate-a", -12, -6, 0, 10, -8), lockedGate("ts-gate-b", -6, 6, 0, 1.4, -8)]
    }
  },
  // --------------------------------------------------------------------- FLOW
  {
    label: "CHAIN", family: "FLOW", inspiredBy: "map-11",
    room: {
      id: "ch-chain", grammar: ["airborne-chain"],
      spawn: eye(0, 24, 2), goal: ring(0, 0, -12), requiredKills: 2,
      platforms: [floor(0, 24, 2, 5, 5), floor(0, 0, -12, 5, 5)],
      enemies: [sentry("cn-1", [7, 16, -4]), sentry("cn-2", [0, 3, -12], undefined, { axis: "x", min: 5 }), sentry("cn-decoy", [-6, 12, -8])]
    }
  },


  {
    label: "DRIFT", family: "FLOW", inspiredBy: "map-02",
    room: {
      id: "ch-drift", grammar: ["moving-endpoint", "stop-short"],
      spawn: eye(0, 12, 6), goal: ring(4, 0, -10), requiredKills: 2,
      platforms: [floor(0, 12, 6, 8, 6), floor(-6, 6, -4, 3, 3), floor(4, 0, -10, 5, 5)],
      enemies: [drifter("dr-1", eye(-6, 6, -4), "y", 2.5, 0.5), drifter("dr-2", eye(4, 0, -10), "x", 3, 0.6), drifter("dr-decoy", [6, 8, -2], "y", 3, 0.55)]
    }
  },

  {
    label: "ORBIT", family: "FLOW", inspiredBy: "map-23",
    room: {
      id: "ch-orbit", grammar: ["moving-endpoint", "stop-short"],
      spawn: eye(0, 8, 0), goal: ring(0, 8, 0), requiredKills: 2,
      platforms: [floor(0, 8, 0, 6, 6), floor(14, 4, 0, 4, 4)],
      enemies: [orbit("ob-1", [0, 5.7, 0], "xz", 14, 14, 0.06), sentry("ob-2", eye(-1, 8, -1.5), undefined, { axis: "y", max: 7 }), orbit("ob-decoy", [0, 12, 0], "xz", 10, 10, 0.05, 2)]
    }
  },
  {
    label: "CURRENT", family: "FLOW", inspiredBy: "map-20",
    room: {
      id: "ch-current", grammar: ["stop-short", "timing-chain"],
      spawn: eye(0, 3, 6), goal: ring(0, 3, -34), requiredKills: 3,
      platforms: [floor(0, 3, 6, 10, 4), floor(-6, 3, -8, 2, 2), floor(6, 3, -20, 2, 2), floor(0, 3, -34, 10, 4)],
      enemies: [sentry("cu-1", [-9, 4.7, -14]), sentry("cu-2", [9, 4.7, -26]), sentry("cu-3", eye(0, 3, -33)), sentry("cu-decoy", [0, 10, -14])],
      hazards: [field("cu-river", -12, 12, -1, 2, -32, 4)]
    }
  },


  {
    label: "LIFT", family: "FLOW", inspiredBy: "map-21",
    room: {
      id: "ch-lift", grammar: ["moving-endpoint", "origin-matters"],
      spawn: eye(0, 4, 18), goal: ring(0, 4, -20), requiredKills: 2,
      platforms: [floor(0, 4, 18, 6, 6), moving(floor(0, 4, 0, 4, 4), "ch-lift-deck", "z", 11, 0.07, true), floor(0, 4, -18, 6, 6)],
      enemies: [diamond("li-diamond", [3, 7, 14], ["ch-lift-deck"]), sentry("li-1", eye(0, 4, 0)), sentry("li-2", eye(0, 4, -17), undefined, { axis: "z", max: 6 }), sentry("li-decoy", [3, 9, 0])],
      hazards: [field("li-floor", -4, 4, -1, 2, -22, 22)]
    }
  },


  {
    label: "SWEEP", family: "FLOW", inspiredBy: "map-18",
    room: {
      id: "ch-sweep", grammar: ["timing-chain", "airborne-chain"],
      spawn: eye(-10, 0, 10), goal: ring(0, 4, 0), requiredKills: 2,
      platforms: [floor(0, 0, 0, 24, 24), floor(0, 4, 0, 4, 4), solid(8, 10, 0, 7, -10, -8)],
      enemies: [sentry("se-1", eye(9, 7, -9)), sentry("se-2", eye(0, 4, 1), undefined, { axis: "y", min: 6 }), sentry("se-decoy", [-8, 3, -8])],
      hazards: [sweep("se-blade", [0, 1.5, 0], [24, 3, 0.8], "z", 11, 0.12), sweep("se-blade-2", [0, 1.5, 0], [0.8, 3, 24], "x", 11, 0.17, 1)]
    }
  },

  // ---------------------------------------------------------------- SYNTHESIS
  {
    label: "HOME", family: "SYNTHESIS", inspiredBy: "map-10",
    room: {
      id: "ch-home", grammar: ["route-fork", "reorientation", "origin-matters"],
      spawn: eye(0, 10, 2), goal: ring(3, 10, -1), requiredKills: 4,
      platforms: [floor(0, 10, 0, 8, 8), floor(-10, 4, -10, 4, 4), floor(0, 0, -20, 4, 4), floor(10, 4, -10, 4, 4)],
      enemies: [
        sentry("ho-1", eye(-10, 4, -10)), sentry("ho-2", eye(0, 0, -20)), sentry("ho-3", eye(10, 4, -10)),
        sentry("ho-home", eye(-3, 10, 2), undefined, { axis: "x", min: 6 }), sentry("ho-decoy", [0, 6, -10])
      ]
    }
  },
  {
    label: "UNDERPASS", family: "SYNTHESIS", inspiredBy: "map-34",
    room: {
      id: "ch-underpass", grammar: ["low-profile", "origin-matters"],
      spawn: eye(0, 8, 2), goal: ring(0, 0, -2), requiredKills: 2,
      platforms: [floor(0, 8, 0, 10, 10), floor(0, 0, -7, 12, 22), crawl(-6, 6, -6, 4, 0)],
      enemies: [sentry("up-1", eye(0, 0, -16)), sentry("up-2", low(3, 0, 2), undefined, { axis: "y", max: 2 }), sentry("up-decoy", eye(-4, 0, -17))]
    }
  },

  {
    label: "FOUR POINT", family: "SYNTHESIS", inspiredBy: "map-35",
    room: {
      id: "ch-four-point", grammar: ["route-fork", "reorientation"],
      spawn: eye(0, 0, 0), goal: ring(0, 0, 0), requiredKills: 4,
      platforms: [floor(0, 0, 0, 8, 8), floor(0, 3, -16, 4, 4), floor(16, 3, 0, 4, 4), floor(0, 3, 16, 4, 4), floor(-16, 3, 0, 4, 4)],
      enemies: [
        sentry("fp-n", eye(0, 3, -16)), sentry("fp-e", eye(16, 3, 0), undefined, { axis: "z", max: -8 }),
        sentry("fp-s", eye(0, 3, 16), undefined, { axis: "x", min: 8 }), sentry("fp-w", eye(-16, 3, 0), undefined, { axis: "z", min: 8 }),
        sentry("fp-home", eye(-2, 0, -2), undefined, { axis: "x", max: -8 }),
        drifter("fp-decoy", [8, 6, -8], "y", 2, 0.5)
      ]
    }
  },
  {
    label: "PARALLAX", family: "SYNTHESIS", inspiredBy: "map-40",
    room: {
      id: "ch-parallax", grammar: ["origin-matters", "reorientation", "stop-short"],
      spawn: eye(-4, 0, 6), goal: ring(4, 10, -6), requiredKills: 3,
      platforms: [floor(0, 0, 0, 16, 16), floor(4, 5, -2, 8, 12), floor(4, 10, -6, 6, 4)],
      enemies: [
        sentry("px-1", eye(6, 5, 2)), shield("px-2", eye(2, 10, -6), { axis: "y", min: 5 }),
        sentry("px-3", eye(6, 10, -7), undefined, { axis: "x", max: 1 }), sentry("px-decoy", low(-4, 0, -4))
      ]
    }
  },


  {
    label: "CONVERGENCE", family: "SYNTHESIS", inspiredBy: "map-42",
    room: {
      id: "ch-convergence", grammar: ["route-fork", "low-profile", "airborne-chain"],
      spawn: eye(-12, 0, 4), goal: ring(0, 12, -20), requiredKills: 4,
      platforms: [
        floor(-12, 0, 2, 6, 8), floor(12, 0, 2, 6, 8), crawl(9, 15, -2, 6, 0),
        floor(-10, 6, -16, 4, 4), floor(10, 6, -16, 4, 4), floor(0, 12, -20, 6, 6)
      ],
      enemies: [
        sentry("cv-1", low(12, 0, 3)), sentry("cv-2", eye(-10, 6, -16)), sentry("cv-3", eye(10, 6, -16)),
        sentry("cv-4", eye(0, 12, -19), undefined, { axis: "y", min: 6 }), sentry("cv-decoy", eye(-12, 0, -2))
      ]
    }
  },
  {
    label: "MACHINE", family: "SYNTHESIS", inspiredBy: "map-15",
    room: {
      id: "ch-machine", grammar: ["origin-matters", "moving-endpoint", "reorientation"],
      spawn: eye(0, 0, 4), goal: ring(0, 20, -8), requiredKills: 3,
      platforms: [
        floor(0, 0, -2, 14, 14),
        moving(floor(-4, 9, -12, 4, 4), "mc-lift", "y", 9, 0.08, true),
        floor(0, 20, -8, 6, 6)
      ],
      enemies: [
        cube("mc-cube", [5, 2, -6], ["mc-gate"]), prism("mc-prism", [-5, 3, -6], ["mc-wall"], -12),
        diamond("mc-diamond", [4, 3, -14], ["mc-lift"]),
        sentry("mc-1", eye(4, 0, -3)), sentry("mc-2", eye(-4, 0, -11)), sentry("mc-3", eye(0, 20, -8), undefined, { axis: "y", min: 16 }),
        sentry("mc-decoy", [0, 10, -2])
      ],
      hazards: [xGate("mc-gate", 0, 0, 6, -9, 5), apertureX("mc-wall", -7, 7, -2, 6, -9, 12, 3)]
    }
  }

];
