import type { HazardSpec, PlatformSpec, RoomSpec } from "../stages";
import {
  apertureX, crawl, crouchSentry, cube, diamond, drifter, eye, field, floor, lockedGate, low, moving, orbit,
  prism, ring, sentry, hooded, slitWallX, slitWallZ, solid, sweep
} from "../authoring";

/**
 * Challenge: twenty-four bespoke constraint chambers. Exact Sphere count (an extra
 * kill fails the chamber), one spare miss. Decoys are there to be left alive;
 * crouch lanes, alcoves, maces and ring-at-start rooms carry the logic.
 */
export type ChallengeFamily = "PRECISION" | "LOGIC" | "FLOW" | "SYNTHESIS";

export interface ChallengeChamber {
  label: string;
  family: ChallengeFamily;
  inspiredBy?: string;
  room: Omit<RoomSpec, "title" | "lesson">;
}

/** A stepping stone that falls away once you leave it. */
const pad = (x: number, top: number, z: number, w = 2.5, d = 2.5): PlatformSpec => ({ ...floor(x, top, z, w, d), collapse: { delay: "leave" } });

/** A ladder rung: an alcove opening across the gap, answering only from close range. */
const rung = (id: string, x: number, top: number, z: number) =>
  ({ ...hooded(id, eye(x, top, z), x < 0 ? "+x" : "-x"), originConstraint: { within: 14 } });

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
    // Crouch under two roofs, thread a crawl slit across a void, then catch a
    // drifting Sphere over the ring's tiny pad. No pad survives being left.
    label: "UNDERCUT", family: "PRECISION", inspiredBy: "map-34",
    room: {
      id: "ch-undercut", grammar: ["low-profile", "stop-short", "moving-endpoint"],
      spawn: eye(-14, 4, 0), goal: ring(24, 3, 0), requiredKills: 3,
      platforms: [
        floor(-14, 4, 0, 5, 5),
        pad(4, 0, 0, 3, 3), crawl(2.5, 5.5, -1.5, 1.5, 0),
        ...slitWallZ(-5, 5, 9, 0, 10),
        pad(14, 0, 0, 3, 3), crawl(12.5, 14.6, -1.5, 1.5, 0),
        floor(24, 3, 0, 3, 3)
      ],
      enemies: [
        crouchSentry("uc-1", 4, 0, 0), crouchSentry("uc-2", 14, 0, 0),
        drifter("uc-3", [24, 4.7, 0], "x", 3, 0.55),
        sentry("uc-decoy", [-14, 8, -9])
      ]
    }
  },

  {
    label: "NEEDLE", family: "PRECISION", inspiredBy: "map-25",
    room: {
      id: "ch-needle", grammar: ["stop-short", "origin-matters"],
      spawn: eye(0, 0, 4), goal: ring(0, 14, -14), requiredKills: 2,
      platforms: [floor(0, 0, 4, 8, 8), floor(8, 6, -8, 1.4, 1.4), floor(0, 14, -14, 5, 5)],
      enemies: [sentry("nd-1", [11.2, 10.1, -12.8]), sentry("nd-2", eye(2, 14, -12), undefined, "+x"), sentry("nd-decoy", [-6, 9, -10])]
    }
  },

  {
    // Two walls of alcoves face each other across a void. Every rung is a mace
    // that answers only from the rung just below it on the far side: climb by
    // zig-zagging across the gap, on pads that fall away behind you.
    label: "LADDER", family: "PRECISION", inspiredBy: "map-33",
    room: {
      id: "ch-ladder", grammar: ["origin-matters", "reorientation", "airborne-chain"],
      spawn: eye(0, 0, 10), goal: ring(0, 20, -12), requiredKills: 7,
      platforms: [
        floor(0, 0, 10, 5, 5),
        pad(-6, 2, 0), pad(6, 5, -5), pad(-6, 8, -5), pad(6, 11, 0), pad(-6, 14, 0), pad(6, 17, -5),
        floor(0, 20, -12, 3, 3)
      ],
      enemies: [
        rung("ld-w1", -6, 2, 0), rung("ld-e1", 6, 5, -5), rung("ld-w2", -6, 8, -5),
        rung("ld-e2", 6, 11, 0), rung("ld-w3", -6, 14, 0), rung("ld-e3", 6, 17, -5),
        sentry("ld-top", [0, 23, -12], undefined, { within: 12 })
      ]
    }
  },

  {
    label: "CEILING", family: "PRECISION", inspiredBy: "map-38",
    room: {
      id: "ch-ceiling", grammar: ["low-profile", "stop-short"],
      spawn: eye(-9, 6, 9), goal: ring(1, 0, -25), requiredKills: 1,
      platforms: [
        floor(-9, 6, 8, 10, 8), floor(-4, 0, 0, 20, 10), floor(1, 0, -17.5, 10, 25),
        solid(-4, 6, 0, 0.8, -12.5, -12), solid(-4, 6, 1.35, 3, -20, -12),
        // Capped, walled chamber beyond the slit: the only way in is the crouched line.
        solid(-4, 6, 3, 3.6, -30.5, -20), solid(-4.5, -4, 0, 3.6, -30.5, -12), solid(6, 6.5, 0, 3.6, -30.5, -12)
      ],
      enemies: [sentry("ce-1", [1, 1.06, -40]), sentry("ce-decoy", [1, 1.8, -34])]
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
    // Four Spheres down a zig-zag, exactly three kills. Pad to pad costs four.
    // The saving is a keyhole in the wall that lines the first pad up with the third.
    label: "OVERSPEND", family: "LOGIC", inspiredBy: "map-19",
    room: {
      id: "ch-overspend", grammar: ["route-fork", "reorientation", "stop-short"],
      spawn: eye(0, 20, 0), goal: ring(10, 0, -32), requiredKills: 3,
      platforms: [
        floor(0, 20, 0, 4, 4), pad(-10, 15, -8, 3, 3), pad(10, 10, -16, 3, 3), pad(-10, 5, -24, 3, 3), floor(10, 0, -32, 4, 4),
        solid(-16, -11.5, 0, 22, -16.4, -15.6), solid(-8.5, -4, 0, 22, -16.4, -15.6),
        solid(-11.5, -8.5, 0, 11, -16.4, -15.6), solid(-11.5, -8.5, 11.5, 22, -16.4, -15.6),
        solid(1, 16, 8, 24, -6.4, -5.6), solid(2, 16, -2, 12, -26.4, -25.6)
      ],
      enemies: [
        sentry("os-1", eye(-10, 15, -8)), sentry("os-2", eye(10, 10, -16)),
        sentry("os-3", eye(-10, 5, -24)), sentry("os-4", eye(10, 0, -31))
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
        sentry("lo-final", eye(0, 10, -12), undefined, "+x")
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
      enemies: [cube("sw-cube", [0, 20, -12], ["sw-gate"]), sentry("sw-1", eye(0, 0, -16)), sentry("sw-2", eye(15, 3, -14), undefined, "-z"), sentry("sw-decoy", eye(-4, 0, -12))],
      hazards: [lockedGate("sw-gate", -1.5, 1.5, 1, 3.5, -6)]
    }
  },

  {
    label: "BEHIND YOU", family: "LOGIC", inspiredBy: "map-13",
    room: {
      id: "ch-behind-you", grammar: ["reorientation", "origin-matters"],
      spawn: eye(0, 4, -2), goal: ring(0, 4, 24), requiredKills: 2,
      platforms: [floor(0, 4, -2, 8, 8), solid(-8, 8, 4, 12, 3, 4.5), floor(-12, 8, -12, 5, 5), floor(0, 4, 24, 6, 6)],
      enemies: [sentry("by-1", eye(-12, 8, -12)), sentry("by-2", eye(0, 4, 23), undefined, "-z"), sentry("by-decoy", [10, 6, -14])]
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
        sentry("tl-1", eye(12, 6, -6), undefined, "-y"),
        sentry("tl-2", eye(-4, 0, -6), undefined, "+y"),
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
      enemies: [sentry("cn-1", [7, 16, -4]), sentry("cn-2", [0, 3, -12], undefined, "+x"), sentry("cn-decoy", [-6, 12, -8])]
    }
  },


  {
    // Three drifters down a void, each only in view from the pad before it, a
    // pulsing curtain across the last line. Every landing is a timing call.
    label: "DRIFT", family: "FLOW", inspiredBy: "map-02",
    room: {
      id: "ch-drift", grammar: ["moving-endpoint", "stop-short", "timing-chain"],
      spawn: eye(0, 14, 6), goal: ring(0, 0, -24), requiredKills: 3,
      platforms: [
        floor(0, 14, 6, 5, 5), pad(-10, 9, -6), pad(10, 4, -14), floor(0, 0, -24, 3, 3),
        solid(2, 16, 0, 14, -10.5, -9.5), solid(-14, 1.5, -2, 12, -20.5, -19.5)
      ],
      enemies: [
        drifter("dr-1", [-10, 10.7, -6], "y", 2.5, 0.5),
        drifter("dr-2", [10, 5.7, -14], "x", 3, 0.6),
        drifter("dr-3", [0, 2.4, -24], "x", 2.5, 0.7),
        drifter("dr-decoy-a", [-5, 12.5, 0], "x", 5, 0.7),
        drifter("dr-decoy-b", [0, 7, -10], "y", 3, 0.55)
      ],
      hazards: [field("dr-curtain", -4, 14, -1, 9, -19.5, -18.5, { period: 2.8, openFor: 1.1 })]
    }
  },

  {
    // Three orbits, three tiny pads. Each orbit lines up with its pad once a lap,
    // walls hide the next orbit until you stand on the pad before it, and the
    // wrong orbit spent early leaves you nowhere to go.
    label: "CAROUSEL", family: "FLOW", inspiredBy: "map-23",
    room: {
      id: "ch-carousel", grammar: ["moving-endpoint", "stop-short", "reorientation"],
      spawn: eye(0, 6, 0), goal: ring(-9, 12.3, -16), requiredKills: 3,
      platforms: [
        floor(0, 6, 0, 3, 3), pad(9, 6, 0, 2, 2), pad(9, 8.3, -16, 2, 2), floor(-9, 12.3, -16, 2.5, 2.5),
        solid(-14, 6, 0, 22, -6.5, -5.5), solid(-14, 5, 0, 26, -10.5, -9.5)
      ],
      enemies: [
        orbit("ca-1", [0, 7.7, 0], "xz", 9, 9, 0.07),
        orbit("ca-2", [9, 10, -10], "yz", 6, 6, 0.08),
        orbit("ca-3", [0, 14, -16], "xy", 9, 9, 0.06)
      ]
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
      enemies: [diamond("li-diamond", [3, 7, 14], ["ch-lift-deck"]), sentry("li-1", eye(0, 4, 0)), sentry("li-2", eye(0, 4, -17), undefined, "+z"), sentry("li-decoy", [3, 9, 0])],
      hazards: [field("li-floor", -4, 4, -1, 2, -22, 22)]
    }
  },


  {
    label: "SWEEP", family: "FLOW", inspiredBy: "map-18",
    room: {
      id: "ch-sweep", grammar: ["timing-chain", "airborne-chain"],
      spawn: eye(-10, 0, 10), goal: ring(0, 4, 0), requiredKills: 2,
      platforms: [floor(0, 0, 0, 24, 24), floor(0, 4, 0, 4, 4), solid(8, 10, 0, 7, -10, -8)],
      enemies: [sentry("se-1", eye(9, 7, -9)), sentry("se-2", eye(0, 4, 1), undefined, "+y"), sentry("se-decoy", [-8, 3, -8])],
      hazards: [sweep("se-blade", [0, 1.5, 0], [24, 3, 0.8], "z", 11, 0.12), sweep("se-blade-2", [0, 1.5, 0], [0.8, 3, 24], "x", 11, 0.17, 1)]
    }
  },

  // ---------------------------------------------------------------- SYNTHESIS
  {
    // Around a tower to its roof: an alcove opens the east pad, a Diamond wakes
    // the north lift, and two maces only answer near the top of its stroke and
    // from the hang above it. Every piece of the grammar, one sentence.
    label: "SPIRE", family: "SYNTHESIS", inspiredBy: "map-33",
    room: {
      id: "ch-spire", grammar: ["origin-matters", "moving-endpoint", "airborne-chain", "reorientation"],
      spawn: eye(0, 0, 10), goal: ring(0, 24, 0), requiredKills: 4,
      platforms: [
        floor(0, 0, 10, 6, 6),
        solid(-3, 3, 0, 24, -3, 3),
        pad(10, 3, 0, 3, 3),
        moving(floor(0, 4, -10, 3, 3), "sp-lift", "y", 8, 0.08, true)
      ],
      enemies: [
        diamond("sp-diamond", [-10, 8, 0], ["sp-lift"]),
        hooded("sp-1", eye(10, 3, 0), "+z"),
        sentry("sp-2", [0, 13.7, -10]),
        sentry("sp-3", [0, 21, -6], undefined, { within: 9 }),
        sentry("sp-4", [0, 25.7, -2.5], undefined, { within: 7 })
      ]
    }
  },
  {
    label: "UNDERPASS", family: "SYNTHESIS", inspiredBy: "map-34",
    room: {
      id: "ch-underpass", grammar: ["low-profile", "origin-matters"],
      spawn: eye(0, 8, 2), goal: ring(0, 0, -2), requiredKills: 2,
      platforms: [floor(0, 8, 0, 10, 10), floor(0, 0, -7, 12, 22), crawl(-6, 6, -6, 4, 0)],
      enemies: [sentry("up-1", eye(0, 0, -16)), crouchSentry("up-2", 3, 0, 2, "-y"), sentry("up-decoy", eye(-4, 0, -17))]
    }
  },

  {
    // A compass of alcoves, each opening toward the one before it, climbing as
    // it turns: home, north, east, south, west, home. Pads fall away behind you.
    label: "FOUR POINT", family: "SYNTHESIS", inspiredBy: "map-35",
    room: {
      id: "ch-four-point", grammar: ["route-fork", "reorientation", "origin-matters"],
      spawn: eye(0, 0, 0), goal: ring(0, 0, 0), requiredKills: 5,
      platforms: [floor(0, 0, 0, 8, 8), pad(0, 3, -16, 4, 4), pad(16, 7, 0, 4, 4), pad(0, 11, 16, 4, 4), pad(-16, 15, 0, 4, 4)],
      enemies: [
        hooded("fp-n", eye(0, 3, -16), "+z"), hooded("fp-e", eye(16, 7, 0), "-z"),
        hooded("fp-s", eye(0, 11, 16), "+x"), hooded("fp-w", eye(-16, 15, 0), "+z"),
        hooded("fp-home", eye(-2, 0, -2), "-x")
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
        sentry("px-1", eye(6, 5, 2)), hooded("px-2", eye(2, 10, -6), "+y"),
        sentry("px-3", eye(6, 10, -7), undefined, "-x"), crouchSentry("px-decoy", -4, 0, -4)
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
        crouchSentry("cv-1", 12, 0, 3), sentry("cv-2", eye(-10, 6, -16)), sentry("cv-3", eye(10, 6, -16)),
        sentry("cv-4", eye(0, 12, -19), undefined, "-x"), sentry("cv-decoy", eye(-12, 0, -2))
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
        sentry("mc-1", eye(4, 0, -3)), sentry("mc-2", eye(-4, 0, -11)), sentry("mc-3", eye(0, 20, -8), undefined, "-x"),
        sentry("mc-decoy", [0, 10, -2])
      ],
      hazards: [xGate("mc-gate", 0, 0, 6, -9, 5), apertureX("mc-wall", -7, 7, -2, 6, -9, 12, 3)]
    }
  }

];
