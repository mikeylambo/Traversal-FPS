import type { CampaignMapDefinition } from "./campaign";
import type { RoomSpec } from "./stages";
import { sanctum,
  apertureX, crawl, crouchSentry, cube, diamond, drifter, eye, field, floor, gated, lockedGate, low, moving, orbit,
  prism, ring, sentry, shield, slabWithHole, slitWallX, slitWallZ, solid, sweep
} from "./authoring";

/**
 * Act III, rebuilt: every sector combines two or more of crouch, verticality,
 * origin rules, moving geometry and Sphere count, each on its own skeleton.
 */

// COMMITMENT — a lateral cascade split by one spine wall. Shelves step down and
// apart; every drop is fatal and every lane is final. A shelf's Sphere sits at its
// back, hidden by its own slab from below: clear what the ledge can see first.
const S19: RoomSpec = {
  id: "sector-19-commitment",
  title: "COMMITMENT",
  lesson: "Every drop is final. Clear what the ledge can see before you leave it.",
  grammar: ["origin-matters", "reorientation", "route-fork", "stop-short"],
  spawn: eye(-24, 32, 0),
  goal: ring(24, 0, 0),
  requiredKills: 4,
  platforms: [
    floor(-22, 32, 0, 8, 20),
    floor(-11, 24, 0, 8, 20),
    floor(0, 16, 0, 8, 20),
    floor(11, 8, 0, 8, 20),
    floor(23, 0, 0, 10, 20),
    solid(-18, 17, -2, 38, -0.75, 0.75)
  ],
  enemies: [
    sentry("commit-n2", eye(-14, 24, 6)),
    shield("commit-s2", eye(-14, 24, -6), { axis: "z", max: -3 }),
    sentry("commit-n3", eye(-3, 16, 5)),
    drifter("commit-s3", [-3, 18.5, -6], "x", 1, 0.6),
    orbit("commit-n4", [8, 10.2, 6], "xz", 1, 0.8, 0.12),
    sentry("commit-s4", eye(8, 8, -5)),
    sentry("commit-final", eye(21, 0, 0))
  ]
};

// CURRENT — a lethal river in an L-shaped canyon. The only survivable points are
// canopied islands; each Sphere floats past the next one, so Stop Short picks the
// island and only a crouched line fits under its canopy. The Prism aligns the gate.
const S20: RoomSpec = {
  id: "sector-20-current",
  title: "CURRENT",
  lesson: "Prism creates the energy corridor. Stop Short chooses the survivable point inside it.",
  grammar: ["stop-short", "low-profile", "timing-chain", "reorientation"],
  spawn: eye(0, 6, 4),
  goal: ring(40, 4, -37),
  requiredKills: 6,
  platforms: [
    floor(0, 0, -19, 16, 50),
    floor(26, 0, -36, 36, 16),
    solid(-10, -8, 0, 14, -46, 8),
    solid(8, 10, 0, 14, -28, 8),
    solid(10, 46, 0, 14, -28, -26),
    solid(44, 46, 0, 14, -46, -26),
    solid(-10, 46, 0, 14, -46, -44),
    floor(0, 6, 2, 16, 8),
    floor(-4, 4, -10, 4, 4),
    floor(4, 4, -20, 3, 3),
    crawl(2.5, 5.5, -21.5, -18.5, 4),
    floor(-3, 4, -34, 3, 3),
    crawl(-4.5, -1.5, -35.5, -32.5, 4),
    floor(20, 4, -36, 3, 3),
    crawl(18.5, 21.5, -37.5, -34.5, 4),
    floor(40, 4, -36, 6, 6)
  ],
  enemies: [
    sentry("current-01", eye(-4, 4, -10)),
    sentry("current-02", [6.4, 5.06, -23]),
    prism("current-prism", [-5, 8, -22], ["current-gate"], -19),
    sentry("current-03", [-5.8, 5.06, -39.6]),
    sentry("current-04", [26.9, 5.06, -36.6]),
    drifter("current-05", [30, 7, -31], "y", 1, 0.7),
    sentry("current-06", eye(40, 4, -34))
  ],
  hazards: [
    field("current-river-a", -8, 8, -2, 3, -44, 6),
    field("current-river-b", 8, 44, -2, 3, -44, -28),
    apertureX("current-gate", -8, 8, 0, 10, -26, 20, 3)
  ]
};

// COUNTERWEIGHT — twin towers too tall to warp onto from the ground. The Diamond
// wakes a lift between them: ride it, and step off by vector at the right height.
// A cleaner chain route exists for players who can read the floating Spheres.
const S21: RoomSpec = {
  id: "sector-21-counterweight",
  title: "COUNTERWEIGHT",
  lesson: "Diamond turns a static route into moving geometry. The safest activation is not always the cleanest route.",
  grammar: ["route-fork", "origin-matters", "moving-endpoint", "reorientation"],
  spawn: eye(0, 0, 10),
  goal: ring(12, 30, -8),
  requiredKills: 5,
  platforms: [
    floor(0, 0, 8, 30, 10),
    solid(-16, -8, 0, 20, -12, -4),
    solid(8, 16, 0, 30, -12, -4),
    moving(floor(0, 16, -8, 6, 6), "cw-lift", "y", 12, 0.06, true)
  ],
  enemies: [
    diamond("cw-diamond", [0, 3, 1], ["cw-lift"]),
    sentry("cw-lift-anchor", [0, 5.7, -8]),
    sentry("cw-west", eye(-12, 20, -8)),
    shield("cw-east", eye(12, 30, -8), { axis: "x", max: -8 }),
    drifter("cw-float-a", [-4, 14, -2], "y", 3, 0.5),
    orbit("cw-float-b", [2, 25, -6], "xz", 3, 2, 0.1)
  ]
};

// BLINDSIDE — stilts over a void. Pillar tops of mixed heights rise out of the
// dark; from any top you see the tops below you and the one line the forest
// leaves open. A locked gate hides the key crossing until the Cube is found.
const S22_GATE = {
  id: "blind-gate",
  kind: "sightline-gate" as const,
  center: [4, 15, -20] as [number, number, number],
  size: [0.45, 10, 8] as [number, number, number],
  cycle: { period: 999, openFor: 0.05, phase: 1 }
};

const pillar = (x: number, z: number, top: number) => solid(x - 2.5, x + 2.5, -20, top, z - 2.5, z + 2.5);

const S22: RoomSpec = {
  id: "sector-22-blindside",
  title: "BLINDSIDE",
  lesson: "The next target exists only when sightline, motion and hazard phase agree.",
  grammar: ["airborne-chain", "moving-endpoint", "reorientation", "origin-matters"],
  spawn: eye(0, 6, 4),
  goal: ring(-12, 22, -32),
  requiredKills: 6,
  platforms: [
    floor(0, 6, 4, 12, 6),
    pillar(-12, -10, 9),
    pillar(4, -8, 6),
    pillar(-4, -20, 12),
    pillar(12, -20, 15),
    pillar(-12, -32, 22),
    pillar(6, -33, 12)
  ],
  enemies: [
    cube("blind-cube", [16, 8, -36], ["blind-gate"]),
    sentry("blind-01", eye(4, 6, -8)),
    sentry("blind-02", eye(-12, 9, -10)),
    sentry("blind-03", eye(-4, 12, -20)),
    shield("blind-04", eye(12, 15, -20), { axis: "y", min: 13 }),
    sentry("blind-05", eye(6, 12, -33)),
    sentry("blind-06", eye(-12, 22, -33), undefined, { axis: "y", min: 15 }),
    drifter("blind-07", [0, 8, -26], "x", 5, 0.5)
  ],
  hazards: [S22_GATE]
};

// PURSUIT — a descending ring of eight ledges around a void. Each ledge's Sphere
// orbits at ledge radius and only lines up with its ledge once a lap. Kill it
// early and that vector is gone: keep the next useful Sphere alive.
const RING_ANGLES = [90, 45, 0, -45, -90, -135, 180, 135];
const ringAt = (k: number): [number, number] => {
  const a = (RING_ANGLES[k]! * Math.PI) / 180;
  return [Math.round(Math.cos(a) * 16 * 10) / 10, Math.round((-20 + Math.sin(a) * 16) * 10) / 10];
};
const ringTop = (k: number) => 28 - k * 4;

const S23: RoomSpec = {
  id: "sector-23-pursuit",
  title: "PURSUIT",
  lesson: "Routes expire. Choose the moving Sphere that leaves the next useful warp available.",
  grammar: ["moving-endpoint", "route-fork", "timing-chain", "stop-short"],
  spawn: eye(0, 28, -2.5),
  goal: ring(ringAt(7)[0], 0, ringAt(7)[1]),
  requiredKills: 7,
  platforms: RING_ANGLES.map((_, k) => floor(ringAt(k)[0], ringTop(k), ringAt(k)[1], 6, 6)),
  enemies: RING_ANGLES.slice(1).map((_, i) => orbit(
    `pursuit-${String(i + 1).padStart(2, "0")}`,
    [0, ringTop(i + 1) + 1.7, -20],
    "xz", 16, 16, 0.05, i * 0.9
  ))
};

// MINIMAL — the room stops teaching. Tiny islands in open space and a sealed
// sanctum holding the ring, its one doorway facing the void. Any four Spheres
// open the ring, but the sanctum's own Sphere only lines up through the door
// from the lone island beyond it: the finish is a firing position, not a pad.
const S25: RoomSpec = {
  id: "sector-25-minimal",
  title: "MINIMAL",
  lesson: "The room stops teaching. Multiple routes work; mastery is visible in what you leave untouched.",
  grammar: ["route-fork", "stop-short", "reorientation", "origin-matters"],
  spawn: eye(0, 0, 0),
  goal: ring(30, 14, -30),
  requiredKills: 4,
  checkpoints: [eye(18, 8, -8)],
  platforms: [
    floor(0, 0, 0, 3, 3),
    floor(-10, 4, -12, 2.5, 2.5),
    { ...floor(8, 2, -16, 2.5, 2.5), collapse: { delay: "leave" } },
    floor(18, 8, -8, 2.5, 2.5),
    floor(-4, 10, -28, 2.5, 2.5),
    floor(14, 12, -36, 2.5, 2.5),
    floor(26, 6, -18, 2.5, 2.5),
    ...sanctum(30, 14, -30, 6, 6, "e", 2.4, 3.4),
    // The approach: a lone island beyond the sanctum, facing its doorway.
    floor(40, 14, -26, 4, 6)
  ],
  enemies: [
    sentry("min-01", eye(-10, 4, -12)),
    sentry("min-02", eye(8, 2, -16)),
    sentry("min-03", eye(18, 8, -8)),
    shield("min-04", eye(-4, 10, -28), { axis: "x", max: -6 }),
    sentry("min-05", eye(14, 12, -36)),
    sentry("min-06", eye(26, 6, -18)),
    sentry("min-07", eye(29, 14, -30)),
    sentry("min-09", eye(40, 14, -24)),
    orbit("min-08", [10, 9, -24], "xz", 4, 3, 0.1)
  ]
};

// ORBIT — a vertical wheel of Spheres turning in front of the summit pillar. The
// Diamond sets the side lift moving; the wheel decides when either is useful.
const S26: RoomSpec = {
  id: "sector-26-orbit",
  title: "ORBIT",
  lesson: "Motion is the frame of reference. Diamond changes the platform cycle; orbiting Spheres decide when it matters.",
  grammar: ["moving-endpoint", "airborne-chain", "origin-matters", "reorientation"],
  spawn: eye(0, 0, 2),
  goal: ring(0, 26, -33),
  requiredKills: 6,
  platforms: [
    floor(0, 0, 2, 12, 8),
    floor(-16, 10, -20, 5, 5),
    moving(floor(16, 16, -20, 5, 5), "orbit-lift", "y", 8, 0.07, true),
    solid(-3, 3, 0, 26, -36, -30)
  ],
  enemies: [
    orbit("wheel-a", [0, 14, -20], "xy", 10, 10, 0.06, 0),
    orbit("wheel-b", [0, 14, -20], "xy", 10, 10, 0.06, 2.1),
    orbit("wheel-c", [0, 14, -20], "xy", 10, 10, 0.06, 4.2),
    sentry("orbit-west", eye(-16, 10, -20)),
    diamond("orbit-diamond", [-16, 13, -23], ["orbit-lift"]),
    sentry("orbit-east", eye(16, 16, -20)),
    shield("orbit-summit", eye(0, 26, -31), { axis: "x", min: 8 })
  ]
};

// PRESSURE — Act III exam as a walled fortress. The way in is a crawl hole; the
// courtyard's Prism doorway leads to a crawl zone that hides the Diamond; the
// walkways hold the high Spheres; the ring crowns the keep, and only the lift
// climbs it.
const S24: RoomSpec = {
  id: "sector-24-pressure",
  title: "PRESSURE",
  lesson: "Act III exam. State, motion, aperture and hazards all compete for your attention. Keep the route sentence intact.",
  grammar: ["low-profile", "moving-endpoint", "reorientation", "timing-chain"],
  spawn: eye(0, 0, 6),
  goal: ring(0, 20, -18),
  requiredKills: 7,
  platforms: [
    floor(0, 0, -18, 40, 48),
    solid(-20, -2, 0, 16, -1.5, 0),
    solid(2, 20, 0, 16, -1.5, 0),
    solid(-2, 2, 1.3, 16, -1.5, 0),
    solid(20, 21.5, 0, 16, -43.5, 0),
    solid(-21.5, -20, 0, 16, -43.5, 0),
    solid(-21.5, 21.5, 0, 16, -43.5, -42),
    solid(-6, 6, 0, 20, -24, -12),
    floor(-17, 8, -22, 6, 36),
    floor(17, 8, -22, 6, 36),
    crawl(-14, -6, -40, -31, 0),
    moving(floor(0, 10, -10.5, 4, 3), "press-lift", "y", 10, 0.06, true)
  ],
  enemies: [
    crouchSentry("press-01", 0, 0, -4),
    sentry("press-02", eye(-17, 8, -8)),
    prism("press-prism", [10, 4, -20], ["press-door"], -40),
    shield("press-03", eye(17, 8, -30), { axis: "y", min: 8 }),
    crouchSentry("press-04", -10, 0, -36),
    diamond("press-diamond", [-17, 0.9, -38], ["press-lift"]),
    drifter("press-05", [0, 6, -35], "x", 6, 0.5),
    orbit("press-06", [0, 23, -18], "xz", 9, 8, 0.08),
    sentry("press-07", eye(17, 8, -38))
  ],
  hazards: [
    apertureX("press-door", -20, 20, -2, 8, -29, 30, 3),
    field("press-pulse", -20, 20, 0, 1.2, -24, -16, { period: 3.2, openFor: 1.4 })
  ]
};

// NEGATIVE SPACE — lethal layers stacked through the room, each with one hole.
// Every Sphere sits inside or beyond a layer, so a full Warp always ends in one:
// Stop Short is the whole language here, and the holes are the grammar.
const layer = (id: string, y0: number, y1: number, hx0: number, hx1: number, hz0: number, hz1: number) => [
  field(`${id}-s`, -15, 15, y0, y1, -30, hz0),
  field(`${id}-n`, -15, 15, y0, y1, hz1, 0),
  field(`${id}-w`, -15, hx0, y0, y1, hz0, hz1),
  field(`${id}-e`, hx1, 15, y0, y1, hz0, hz1)
];

const S27: RoomSpec = {
  id: "sector-27-negative-space",
  title: "NEGATIVE SPACE",
  lesson: "The route is the safe absence between lethal volumes. Full Warp is usually the wrong answer.",
  grammar: ["stop-short", "reorientation", "timing-chain", "route-fork"],
  spawn: eye(4, 0, -4),
  goal: ring(-1, 14, -30),
  requiredKills: 4,
  platforms: [
    // The base floor stops short of the pockets above, so each layer is crossed
    // through its hole or not at all.
    floor(0, 0, -6, 24, 12),
    floor(-7, 6.5, -16, 6, 6),
    floor(-1, 14, -30, 6, 6)
  ],
  enemies: [
    sentry("neg-01", [-7, 11.25, -18.5]),
    sentry("neg-02", [0.6, 18.7, -33.2]),
    drifter("neg-03", [8, 9, -6], "x", 4, 0.5),
    orbit("neg-04", [-2, 3, -22], "xz", 4, 3, 0.1)
  ],
  hazards: [
    ...layer("neg-l1", 5, 5.5, -10, -4, -13, -7),
    ...layer("neg-l2", 11, 11.5, -4, 2, -27, -21)
  ]
};

// STATE — mirror halls either side of the hub, and the ring waits at home. Each
// hall's Cube opens the other hall's window; each return needs its own anchor.
// Remember the state you created, not just the Sphere you can see.
const hallWall = (x0: number, x1: number) => [
  solid(x0, x1, 0, 12, -34, -2),
  solid(x0, x1, 0, 12, 2, 6),
  solid(x0, x1, 0, 1, -2, 2),
  solid(x0, x1, 3.5, 12, -2, 2)
];
const hallGate = (id: string, x: number) => ({
  id,
  kind: "sightline-gate" as const,
  center: [x, 2.25, 0] as [number, number, number],
  size: [0.45, 2.5, 4] as [number, number, number],
  cycle: { period: 999, openFor: 0.05, phase: 1 }
});

const S28: RoomSpec = {
  id: "sector-28-state",
  title: "STATE",
  lesson: "Cube changes which version of the room exists. Remember the state you created, not just the Sphere you can see.",
  grammar: ["origin-matters", "reorientation", "route-fork", "low-profile"],
  spawn: eye(0, 0, 3),
  goal: ring(2, 0, -3),
  requiredKills: 6,
  platforms: [
    floor(0, 0, 0, 12, 12),
    ...hallWall(-7.5, -6),
    // East wall carries an always-open crouch slit onto the east Cube.
    solid(6, 7.5, 0, 12, -34, -5),
    ...slitWallZ(-5, -3, 6.75, 0, 12, 1.5),
    solid(6, 7.5, 0, 12, -3, -2),
    solid(6, 7.5, 0, 12, 2, 6),
    solid(6, 7.5, 0, 1, -2, 2),
    solid(6, 7.5, 3.5, 12, -2, 2),
    floor(-14, 0, -14, 12, 40),
    floor(14, 0, -14, 12, 40)
  ],
  enemies: [
    cube("state-cube-east", [18, 1.06, -4], ["state-gate-west"]),
    sentry("state-w1", eye(-12, 0, 0)),
    sentry("state-w2", eye(-14, 0, -28)),
    cube("state-cube-west", [-16, 3, -20], ["state-gate-east"]),
    sentry("state-home-a", eye(4, 0, -4)),
    sentry("state-e1", eye(12, 0, 1)),
    shield("state-e2", eye(14, 0, -28), { axis: "z", max: -20 }),
    sentry("state-home-b", eye(-4, 0, -5))
  ],
  hazards: [hallGate("state-gate-west", -6.75), hallGate("state-gate-east", 6.75)]
};

// CIRCUIT — a four-leg loop at changing heights around a void. The ring sits
// beside the spawn behind a sealed window: visible from the first second, reached
// only by completing the loop. Each Prism opens the next leg's plane.
const S29_SEAL = {
  id: "circ-seal",
  kind: "sightline-gate" as const,
  center: [-13, 2.25, 0] as [number, number, number],
  size: [0.45, 1.5, 4] as [number, number, number],
  cycle: { period: 999, openFor: 0.05, phase: 1 }
};

const S29: RoomSpec = {
  id: "sector-29-circuit",
  title: "CIRCUIT",
  lesson: "Prisms define which energy corridors exist. Route choice decides which corridor is worth creating.",
  grammar: ["route-fork", "reorientation", "moving-endpoint", "origin-matters"],
  spawn: eye(4, 0, 1),
  goal: ring(-18, 0, 0),
  requiredKills: 6,
  platforms: [
    floor(0, 0, 0, 24, 8),
    floor(-18, 0, 0, 8, 8),
    solid(-14, -12, 0, 1.5, -4, 4),
    solid(-14, -12, 3, 10, -4, 4),
    solid(-14, -12, 1.5, 3, -4, -2),
    solid(-14, -12, 1.5, 3, 2, 4),
    floor(16, 3, -22, 8, 36),
    floor(0, 6, -44, 40, 8),
    floor(-18, 4, -22, 8, 36)
  ],
  enemies: [
    sentry("circ-01", eye(16, 3, -6)),
    prism("circ-prism-e", [8, 4, -8], ["circ-e"], -10),
    sentry("circ-02", eye(16, 3, -36)),
    sentry("circ-03", eye(8, 6, -43)),
    prism("circ-prism-w", [-8, 9, -44], ["circ-w"], -10),
    shield("circ-04", eye(-18, 4, -36), { axis: "y", min: 7 }),
    orbit("circ-05", [0, 5, -22], "xz", 6, 8, 0.07),
    sentry("circ-06", eye(-18, 4, -10))
  ],
  hazards: [
    S29_SEAL,
    apertureX("circ-e", 12, 20, 1, 13, -20, 10, 2.5),
    apertureX("circ-w", -22, -14, 2, 14, -20, 10, 2.5)
  ]
};

// KINETIC — a piston hall. Diamonds wake pairs of pistons; the gallery Sphere
// only answers from above, which only a raised piston can reach. Use the motion
// instead of waiting for it to finish.
const S30: RoomSpec = {
  id: "sector-30-kinetic",
  title: "KINETIC",
  lesson: "Diamonds make platforms into alignment events. Use their motion instead of waiting for it to finish.",
  grammar: ["moving-endpoint", "airborne-chain", "stop-short", "reorientation"],
  spawn: eye(0, 0, 2),
  goal: ring(0, 16, -50),
  requiredKills: 6,
  platforms: [
    floor(0, 0, -4, 30, 16),
    moving(floor(-9, 4, -18, 4, 4), "kin-a", "y", 4, 0.1, true),
    moving(floor(-3, 8, -26, 4, 4), "kin-b", "y", 4, 0.08, true),
    moving(floor(3, 8, -34, 4, 4), "kin-c", "y", 5, 0.07, true),
    moving(floor(9, 12, -42, 4, 4), "kin-d", "y", 4, 0.09, true),
    floor(0, 16, -50, 30, 6)
  ],
  enemies: [
    diamond("kin-diamond-1", [-6, 3, -10], ["kin-a", "kin-b"]),
    sentry("kin-01", eye(-9, 4, -18)),
    sentry("kin-02", eye(-3, 8, -26)),
    diamond("kin-diamond-2", [0, 12, -30], ["kin-c", "kin-d"]),
    drifter("kin-03", [6, 11, -30], "y", 3, 0.5),
    sentry("kin-04", eye(3, 8, -34)),
    sentry("kin-05", eye(9, 12, -42)),
    shield("kin-06", eye(0, 16, -49), { axis: "y", min: 14 })
  ]
};

export const ROOMS_19_TO_30: RoomSpec[] = [S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30];

export const MAPS_19_TO_30: CampaignMapDefinition[] = ROOMS_19_TO_30.map((room, i) => {
  const n = i + 19;
  return {
    id: `map-${n}`,
    label: `SECTOR ${String(n).padStart(2, "0")} // ${room.title}`,
    subtitle: room.lesson,
    focus: room.grammar,
    implemented: true,
    campaignRooms: [room],
    courseRooms: [structuredClone(room) as RoomSpec]
  };
});
