import type { PlatformSpec, RoomSpec } from "../stages";
import {
  crawl, crouchSentry, cube, diamond, drifter, eye, field, floor, lockedGate, low, moving, orbit, ring, sanctum, sentry,
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

/** A stepping stone that falls away once you leave it. */
const pad = (x: number, top: number, z: number, w = 3, d = 3): PlatformSpec => ({ ...floor(x, top, z, w, d), collapse: { delay: "leave" } });

/** A lethal plane with one square hole, centred where a warp line crosses it. */
function holePlane(id: string, x: number, y: number, z: number) {
  const h = 2.4;
  return [field(`${id}-w`, x - 11, x - h, y, y + 0.4, z - 11, z + 11), field(`${id}-e`, x + h, x + 11, y, y + 0.4, z - 11, z + 11),
    field(`${id}-n`, x - h, x + h, y, y + 0.4, z - 11, z - h), field(`${id}-s`, x - h, x + h, y, y + 0.4, z + h, z + 11)];
}

/** FREEFALL's dive: the spawn eye, then each Sphere, with one plane between each pair. */
const FF: [number, number, number][] = [[0, 35.7, 3], [3, 22, -4], [9, 14, -12], [15, 7, -20]];
const FF_PLANES = [27, 18, 10];

function lockedWall(): PlatformSpec { return solid(-12, -8, 0, 20, -31, -29); }

export interface TimeTrialCourse {
  label: string;
  inspiredBy?: string;
  goldSeconds: number;
  room: Omit<RoomSpec, "title" | "lesson">;
}

export const TIME_TRIAL_COURSES: TimeTrialCourse[] = [
  {
    // 01 DOWNHILL: a descending zig-zag of maces, each in reach only from the pad
    // before it; the last hangs past the finish over the void, so the final warp
    // is a Stop Short onto the pad.
    label: "DOWNHILL", inspiredBy: "map-01", goldSeconds: 10,
    room: {
      id: "tt-downhill", grammar: ["direct-anchor", "stop-short", "reorientation"],
      spawn: eye(0, 16, 5), goal: ring(4, 0, -54), requiredKills: 4,
      platforms: [floor(0, 16, 4, 8, 8), floor(-8, 12, -12, 4, 4), floor(6, 8, -26, 4, 4), floor(-6, 4, -40, 4, 4), floor(4, 0, -54, 8, 8)],
      enemies: [sentry("dh-1", eye(-8, 12, -12), undefined, { within: 19 }), sentry("dh-2", eye(6, 8, -26), undefined, { within: 19 }),
        sentry("dh-3", eye(-6, 4, -40), undefined, { within: 19 }), sentry("dh-4", [10, 0.5, -60], undefined, { within: 27 })]
    }
  },
  {
    // 02 DRIFT WINDOW: around two blocks, each drifter only in view from the pad before it.
    label: "DRIFT WINDOW", inspiredBy: "map-02", goldSeconds: 12,
    room: {
      id: "tt-drift-window", grammar: ["moving-endpoint", "stop-short", "reorientation"],
      spawn: eye(-20, 0, 10), goal: ring(0, 6, -34), requiredKills: 3,
      platforms: [floor(-20, 0, 10, 8, 8), floor(-20, 3, -12, 4, 4), floor(0, 5, -12, 4, 4), floor(0, 6, -34, 8, 6),
        solid(-16, -4, 0, 20, -8, 4), solid(-16, -4, 0, 20, -30, -18)],
      enemies: [drifter("dw-1", eye(-20, 3, -12), "y", 2.5, 0.6), drifter("dw-2", eye(0, 5, -12), "x", 3, 0.7), drifter("dw-3", eye(0, 6, -32), "y", 2, 0.8)]
    }
  },


  {
    label: "BACK ANGLE", inspiredBy: "map-03", goldSeconds: 7,
    room: {
      id: "tt-back-angle", grammar: ["reorientation", "origin-matters"],
      spawn: eye(0, 0, 1), goal: ring(0, 4, -21), requiredKills: 2,
      platforms: [floor(0, 0, 0, 12, 8), solid(-14, 14, 0, 6, -8, -6.5), floor(0, 12, 26, 5, 5), floor(0, 4, -20, 10, 8)],
      enemies: [sentry("ba-1", eye(0, 12, 25), undefined, "-z"), sentry("ba-2", eye(0, 4, -19), undefined, "+z"), drifter("ba-decoy", [8, 7, -2], "y", 2, 0.6)]
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
      enemies: [sentry("cc-1", eye(0, 0, -24), undefined, "+z"), sentry("cc-2", eye(12, 2, -12), undefined, "-x"), sentry("cc-3", eye(28, 0, -28), undefined, "-x"), orbit("cc-4", [16, 6, -8], "xz", 3, 3, 0.1)]
    }
  },
  {
    // 07 SWITCHYARD: the Cube that opens the final gate sits behind the yard, so the
    // fast line is shoot it on the way out, not on the way back.
    label: "SWITCHYARD", inspiredBy: "map-09", goldSeconds: 11,
    room: {
      id: "tt-switchyard", grammar: ["origin-matters", "reorientation", "route-fork"],
      spawn: eye(0, 0, 3), goal: ring(0, 6, -38), requiredKills: 3,
      platforms: [floor(0, 0, 0, 10, 10), floor(-12, 3, -16, 5, 5), floor(12, 5, -22, 5, 5), floor(0, 6, -38, 8, 6),
        solid(-4, 4, 0, 14, -14, -10), lockedWall()],
      enemies: [cube("sy-cube", [-15, 6, -21], ["sy-gate"]), hooded("sy-1", eye(-12, 3, -16), "+x"), hooded("sy-2", eye(12, 5, -22), "-x"), hooded("sy-3", eye(0, 6, -37), "+z")],
      hazards: [{ id: "sy-gate", kind: "sightline-gate", center: [0, 10, -30], size: [16, 20, 0.45], cycle: { period: 999, openFor: 0.05, phase: 1 } }]
    }
  },
  {
    // 08 OUT AND BACK: out round the wall and home again on pads that fall away
    // behind you, with a blade sweeping the home stretch.
    label: "OUT AND BACK", inspiredBy: "map-10", goldSeconds: 15,
    room: {
      id: "tt-out-and-back", grammar: ["route-fork", "reorientation", "timing-chain"],
      spawn: eye(0, 8, 2), goal: ring(3, 8, -2), requiredKills: 4,
      platforms: [floor(0, 8, 0, 10, 8), pad(-14, 4, -14, 4, 4), pad(0, 0, -28, 4, 4), pad(14, 4, -14, 4, 4), solid(-4, 4, 0, 14, -18, -10)],
      enemies: [hooded("ob-1", eye(-14, 4, -14), "+z"), hooded("ob-2", eye(0, 0, -28), "-x"), hooded("ob-3", eye(14, 4, -14), "-z"), hooded("ob-home", eye(-3, 8, 1), "+x")],
      hazards: [sweep("ob-blade", [9, 7, -7], [0.6, 8, 10], "x", 5, 0.12)]
    }
  },
  {
    // 09 CORKSCREW: up a spiral of small pads round a core while a horizontal blade
    // rises and falls through every level: never wait on a pad.
    label: "CORKSCREW", inspiredBy: "map-33", goldSeconds: 13,
    room: {
      id: "tt-corkscrew", grammar: ["reorientation", "airborne-chain", "timing-chain"],
      spawn: eye(0, 0, 8), goal: ring(0, 21, -6), requiredKills: 4,
      platforms: [floor(0, 0, 8, 12, 8), solid(-1.5, 1.5, 0, 20, -7.5, -4.5), pad(10, 5, -6), pad(0, 10, -16), pad(-10, 15, -6), floor(0, 20.5, -6, 8, 8)],
      enemies: [sentry("cs-1", eye(10, 5, -6), undefined, { within: 18 }), sentry("cs-2", eye(0, 10, -16), undefined, { within: 16 }),
        sentry("cs-3", eye(-10, 15, -6), undefined, { within: 16 }), sentry("cs-4", eye(-3, 20.5, -6), undefined, { within: 10 })],
      hazards: [sweep("cs-rise", [0, 11, -6], [26, 0.5, 26], "y", 8.5, 0.08)]
    }
  },
  {
    // 10 FREEFALL: a dive through three lethal planes, each with one hole on the
    // line to the next Sphere: every warp threads the gap below it.
    label: "FREEFALL", inspiredBy: "map-36", goldSeconds: 9,
    room: {
      id: "tt-freefall", grammar: ["airborne-chain", "stop-short"],
      spawn: eye(0, 34, 3), goal: ring(16, 0, -24), requiredKills: 4,
      platforms: [floor(0, 34, 3, 8, 6), floor(16, 0, -24, 10, 10)],
      enemies: [sentry("ff-1", FF[1]!, undefined, { within: 16 }), sentry("ff-2", FF[2]!, undefined, { within: 13 }), sentry("ff-3", FF[3]!, undefined, { within: 13 }), sentry("ff-4", eye(16, 0, -22), undefined, { within: 7 })],
      hazards: FF_PLANES.flatMap((y, i) => {
        const a = FF[i]!, b = FF[i + 1]!, t = (a[1] - 0.72 - y) / (a[1] - b[1]);
        return holePlane(`ff-${i}`, a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t);
      })
    }
  },

  {
    // 11 RELAY (replaces HANDOFF): a horizontal relay across a wide void, two
    // drifters handing you off mid-air around a tall fin, then a stop-short landing.
    label: "RELAY RUN", inspiredBy: "map-11", goldSeconds: 10,
    room: {
      id: "tt-relay-run", grammar: ["airborne-chain", "moving-endpoint", "reorientation"],
      spawn: eye(-28, 6, 0), goal: ring(28, 6, 0), requiredKills: 4,
      platforms: [floor(-28, 6, 0, 6, 6), floor(28, 6, 0, 6, 6), pad(0, 10.3, 14), solid(-1, 1, 0, 24, -10, 10), solid(-16, -14, 0, 20, -4, 12), solid(14, 16, 0, 20, -12, 4)],
      enemies: [drifter("rr-1", [-15, 9, -9], "x", 3, 0.9), drifter("rr-2", [0, 12, 14], "y", 3, 1.0), drifter("rr-3", [15, 9, 9], "x", 3, 0.9), sentry("rr-4", [33, 7.2, 1], undefined, { within: 21 })]
    }
  },

  {
    // 12 GALLERY SPRINT: a sprint along a gallery of baffles. Every Sphere hangs over
    // the void just past its pad and behind the next baffle, so each warp is a Stop
    // Short you can only line up from the pad before.
    label: "GALLERY SPRINT", inspiredBy: "map-39", goldSeconds: 11,
    room: {
      id: "tt-gallery-sprint", grammar: ["stop-short", "reorientation"],
      spawn: eye(-30, 0, 0), goal: ring(34, 0, -4), requiredKills: 4,
      platforms: [floor(-30, 0, 0, 8, 8), floor(-12, 2, -6, 4, 4), floor(4, 0, 4, 4, 4), floor(20, 3, -8, 4, 4), floor(34, 0, -4, 6, 6),
        solid(-21, -20, 0, 14, -2, 10), solid(-4, -3, 0, 14, -14, -2), solid(12, 13, 0, 14, 0, 12), solid(27, 28, 0, 14, -16, -6)],
      enemies: [sentry("gs-1", [-6, 3.2, -9]), sentry("gs-2", [10, 1.2, 7]), sentry("gs-3", [26, 4.2, -11]), sentry("gs-4", [40, 1.2, -5])]
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
    // 14 WHEEL: a fast wheel of two Spheres in front of a wall; the far pad is only in
    // view through the wheel's hub window, so the shot is timed to the wheel.
    label: "WHEEL", inspiredBy: "map-26", goldSeconds: 11,
    room: {
      id: "tt-wheel", grammar: ["moving-endpoint", "airborne-chain", "reorientation"],
      spawn: eye(-18, 0, -10), goal: ring(20, 12, -10), requiredKills: 3,
      platforms: [floor(-18, 0, -10, 8, 10), floor(20, 12, -10, 6, 6),
        solid(4, 5, 0, 24, -20, -12), solid(4, 5, 0, 24, -8, 0), solid(4, 5, 0, 8, -12, -8), solid(4, 5, 12, 24, -12, -8)],
      enemies: [orbit("wh-1", [0, 10, -10], "yz", 7, 7, 0.14, 0), orbit("wh-2", [0, 10, -10], "yz", 7, 7, 0.14, 3.1), hooded("wh-3", eye(19, 12, -10), "-x")]
    }
  },


  {
    // 15 SHUTTLE (replaces PISTONS): board a sideways shuttle and ride it. The two
    // maces beside the ends of its run only fold in reach as you pass, and the
    // finish mace only answers from the east end of the ride.
    label: "SHUTTLE", inspiredBy: "map-30", goldSeconds: 14,
    room: {
      id: "tt-shuttle", grammar: ["moving-endpoint", "origin-matters", "timing-chain"],
      spawn: eye(0, 0, 8), goal: ring(14, 10, -24), requiredKills: 4,
      platforms: [floor(0, 0, 8, 8, 6), moving(floor(0, 3, -6, 5, 4), "tt-shuttle-car", "x", 14, 0.09), floor(14, 10, -24, 6, 6)],
      enemies: [sentry("sh-0", eye(0, 3, -6)), sentry("sh-1", [-14, 6.7, -12], undefined, { within: 8 }),
        sentry("sh-2", [14, 6.7, -12], undefined, { within: 8 }), sentry("sh-3", eye(14, 10, -23), undefined, { within: 19 })]
    }
  },
  {
    // 16 GAUNTLET: crawl, climb, chain and finish, on pads that fall away, through a
    // blade band, to a finish that answers only from the orbit's reach.
    label: "GAUNTLET", inspiredBy: "map-32", goldSeconds: 20,
    room: {
      id: "tt-gauntlet", grammar: ["low-profile", "airborne-chain", "stop-short", "reorientation"],
      spawn: eye(0, 0, 4), goal: ring(0, 10, -60), requiredKills: 6,
      platforms: [
        floor(0, 0, 0, 10, 12),
        solid(-12, -1.5, 0, 14, -8, -6.5), solid(1.5, 12, 0, 14, -8, -6.5), solid(-1.5, 1.5, 0, 0.8, -8, -6.5), solid(-1.5, 1.5, 1.35, 14, -8, -6.5),
        pad(0, 0, -16, 5, 5), pad(-10, 6, -28, 4, 4), pad(10, 6, -40, 4, 4), floor(0, 10, -60, 8, 8)
      ],
      enemies: [
        crouchSentry("ga-1", 0, 0, -16), hooded("ga-2", eye(-10, 6, -28), "+z"), drifter("ga-3", [0, 9, -34], "x", 4, 0.9),
        hooded("ga-4", eye(10, 6, -40), "-x"), orbit("ga-5", [0, 13, -50], "xz", 3, 2, 0.12), sentry("ga-6", eye(0, 10, -58), undefined, { within: 12 })
      ],
      hazards: [sweep("ga-band", [0, 9, -34], [26, 6, 0.8], "z", 7, 0.11)]
    }
  },

  // ------------------------------------------------------------ v0.16 courses
  {
    // 17 BLADE RUN: pylons over the void; two blades sweep the length of the warp
    // band and a third cuts across it. Every Sphere answers only from the pylon before.
    label: "BLADE RUN", inspiredBy: "map-18", goldSeconds: 12,
    room: {
      id: "tt-blade-run", grammar: ["airborne-chain", "timing-chain"],
      spawn: eye(0, 2, 8), goal: ring(0, 9, -46), requiredKills: 4,
      platforms: [floor(0, 2, 8, 8, 6), solid(-8, -5, -20, 6, -9, -6), solid(5, 8, -20, 8, -21, -18), solid(-8, -5, -20, 7, -33, -30), floor(0, 9, -46, 8, 6)],
      enemies: [sentry("br-1", eye(-6.5, 6, -7.5), undefined, { within: 18 }), sentry("br-2", eye(6.5, 8, -19.5), undefined, { within: 18 }),
        sentry("br-3", eye(-6.5, 7, -31.5), undefined, { within: 18 }), sentry("br-4", eye(0, 9, -45), undefined, { within: 16 })],
      hazards: [
        sweep("br-a", [0, 8.5, -18], [22, 6, 0.8], "z", 19, 0.1),
        sweep("br-b", [0, 8.5, -18], [22, 6, 0.8], "z", 19, 0.1, Math.PI),
        sweep("br-c", [0, 8.5, -20], [0.8, 6, 30], "x", 9, 0.13, 1.2)
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
        sentry("st-1", eye(-8, 10, -12), undefined, "-x"), sentry("st-2", eye(2, 16, -2), undefined, "-x"),
        sentry("st-3", eye(10, 7, -16), undefined, "+z"), hooded("st-4", eye(22, 4, -22), "-x")
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
        sentry("wv-1", eye(-18, 2, 0), undefined, "-x"), sentry("wv-2", eye(-12, 11, -9), undefined, "-y"), sentry("wv-3", eye(-2, 4, 0), undefined, "-x"),
        sentry("wv-4", eye(4, 13, 9), undefined, "-y"), sentry("wv-5", eye(12, 6, 0), undefined, "+z"),
        sentry("wv-6", eye(29, 16, 0), undefined, "-x")
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
        sentry("rt-1", eye(-18, 5, -18), undefined, "+z"), sentry("rt-2", eye(18, 8, -18), undefined, "-x"), sentry("rt-3", eye(18, 3, 18), undefined, "-z"),
        sentry("rt-4", eye(3, 0, 2), undefined, "+z")
      ]
    }
  },
  {
    // 23 CROSSFIRE: you start shut in a hub with one west doorway; three spokes, each
    // alcove opening toward the spoke before it, so the only order is a loop:
    // west, south, east, then out.
    label: "CROSSFIRE", inspiredBy: "map-37", goldSeconds: 13,
    room: {
      id: "tt-crossfire", grammar: ["route-fork", "origin-matters", "reorientation"],
      spawn: eye(0, 0, 0), goal: ring(0, 12, -22), requiredKills: 4,
      platforms: [...sanctum(0, 0, 0, 10, 10, "w"), pad(-20, 4, 0, 5, 5), pad(20, 6, 0, 5, 5), pad(0, 2, 20, 5, 5), floor(0, 12, -22, 8, 6)],
      enemies: [hooded("cf-w", eye(-20, 4, 0), "+x"), hooded("cf-s", eye(0, 2, 20), "-x"), hooded("cf-e", eye(20, 6, 0), "+z"), hooded("cf-out", eye(0, 12, -21), "+x")]
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
