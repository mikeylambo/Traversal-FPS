import type { CampaignMapDefinition } from "./campaign";
import type { HazardSpec, RoomSpec } from "./stages";
import {
  apertureX, crawl, crouchSentry, cube, diamond, drifter, eye, field, floor, gated, low, moving, orbit, prism,
  ring, sentry, shield, slabWithHole, slitWallX, solid, sweep
} from "./authoring";

/**
 * Act II, rebuilt. Every sector owns a different spatial skeleton; the actor
 * grammar each one teaches is unchanged from the original 11-18 run.
 */

// RELAY — void descent. Each stage's landing Sphere can only be fired from a
// coordinate with no floor under it: the previous Sphere's hang point. Decoys
// over the void teach that not every vector is a route.
const S11: RoomSpec = {
  id: "sector-11-relay",
  title: "RELAY",
  lesson: "The next warp becomes useful before the current one ends. Stay airborne and keep reading.",
  grammar: ["airborne-chain", "moving-endpoint", "reorientation"],
  spawn: eye(0, 24, 12),
  goal: ring(-10, 0, -72),
  requiredKills: 6,
  platforms: [
    floor(0, 24, 10, 12, 10),
    floor(-12, 12, -26, 7, 7),
    floor(-10, 0, -70, 14, 12)
  ],
  enemies: [
    sentry("relay-01", [-20, 22, -8]),
    drifter("relay-02", [-2, 20, -12], "x", 3, 0.7),
    sentry("relay-03", [-12, 15.5, -26], undefined, { axis: "x", max: -18 }),
    sentry("relay-04", [6, 9, -40]),
    orbit("relay-05", [-4, 6, -52], "xy", 2, 1.2, 0.14),
    sentry("relay-06", [-10, 3.5, -69], undefined, { axis: "z", max: -35 })
  ]
};

// GATES — lateral gallery. Bay A (Cube) -> window -> Bay B (Prism) -> lethal
// aperture -> Bay C -> Bay D (Shield from the left). Each tool opens one bay.
const S12_WINDOW: HazardSpec = {
  id: "gates-window",
  kind: "sightline-gate",
  center: [-13, 4, 0],
  size: [0.45, 4, 3],
  cycle: { period: 999, openFor: 0.05, phase: 1 }
};

const S12: RoomSpec = {
  id: "sector-12-gates",
  title: "GATES",
  lesson: "Cube controls world state. Prism controls aperture. Solve the shared safe region, then spend the Sphere.",
  grammar: ["stop-short", "origin-matters", "reorientation", "moving-endpoint"],
  spawn: eye(-26, 0, 3),
  goal: ring(20, 4, -22),
  requiredKills: 4,
  platforms: [
    floor(-22, 0, 0, 16, 12),
    solid(-13.5, -12.5, 0, 10, -26, -1.5),
    solid(-13.5, -12.5, 0, 10, 1.5, 6),
    solid(-13.5, -12.5, 0, 2, -1.5, 1.5),
    solid(-13.5, -12.5, 6, 10, -1.5, 1.5),
    floor(-4, 3, 0, 16, 12),
    floor(-4, 1, -18, 16, 12),
    floor(16, 4, -18, 12, 12)
  ],
  enemies: [
    cube("gates-cube", [-18, 3, -4], ["gates-window"]),
    sentry("gates-01", eye(-6, 3, 1)),
    prism("gates-prism", [0, 9, -3], ["gates-aperture"], -38),
    sentry("gates-02", eye(-8, 1, -18)),
    shield("gates-03", eye(16, 4, -18), { axis: "x", max: -2 }),
    drifter("gates-04", [19, 7.5, -15], "y", 1.2, 0.8)
  ],
  hazards: [
    S12_WINDOW,
    apertureX("gates-aperture", -12, 26, -2, 12, -9, 23, 3)
  ]
};

// FORK — goal behind you. A wall hides the high ring pad behind the spawn; three
// routes (crawl-left, chain-right, over-the-monolith) each earn a high perch that
// can see it. Any three Spheres open the ring; the clean route is the one you pick.
const S13: RoomSpec = {
  id: "sector-13-fork",
  title: "FORK",
  lesson: "Every Sphere is valid. The clean route is defined by the Spheres you leave alive.",
  grammar: ["route-fork", "stop-short", "reorientation", "low-profile"],
  spawn: eye(0, 0, 1),
  goal: ring(0, 12, 28),
  requiredKills: 3,
  platforms: [
    floor(0, 0, 0, 12, 8),
    solid(-20, 20, 0, 7, 6, 7),
    floor(0, 12, 26, 10, 8),
    solid(-4, 4, 0, 16, -22, -12),
    // Left: crawl tunnel, then a perch that only answers from the tunnel side.
    floor(-14, 0, -10, 8, 20),
    crawl(-18, -10, -16, -2, 0),
    floor(-14, 9, -34, 6, 6),
    // Right: a perch whose Sphere is hidden under its own lip from the ground.
    floor(15, 11, -10, 6, 6)
  ],
  enemies: [
    sentry("fork-anchor", eye(0, 12, 24)),
    crouchSentry("fork-low", -14, 0, -4),
    sentry("fork-perch-left", eye(-14, 9, -32), undefined, { axis: "x", max: -10 }),
    sentry("fork-float-right", [18, 11, 4]),
    sentry("fork-perch-right", eye(15, 11, -10)),
    orbit("fork-high", [0, 21, -4], "xz", 1.5, 1, 0.12),
    sentry("fork-summit", eye(0, 16, -17))
  ]
};

// REFRACTION — firing range of lethal planes. A Sphere seen from one side of the
// deck must be spent from the other: only one origin threads both windows, and
// from there the pillar hides the target. The Prism then re-aims the third plane.
const S14: RoomSpec = {
  id: "sector-14-refraction",
  title: "REFRACTION",
  lesson: "Prism moves the opening. The opening is not the route until your firing angle makes it one.",
  grammar: ["route-fork", "reorientation", "origin-matters", "stop-short"],
  spawn: eye(0, 0, 8),
  goal: ring(6, 6, -68),
  requiredKills: 4,
  platforms: [
    floor(0, 0, 6, 40, 10),
    floor(12, 0, -31, 8, 10),
    solid(9, 12, 0, 4, -37.5, -36.5),
    floor(-12, 3, -52, 8, 8),
    floor(4, 6, -66, 10, 10)
  ],
  enemies: [
    sentry("refr-01", [12, 1.7, -40]),
    prism("refr-prism", [14, 3.5, -28], ["refr-w3"], -18),
    sentry("refr-02", eye(-12, 3, -50)),
    orbit("refr-orbit", [-2, 9, -58], "xz", 3, 2, 0.12),
    shield("refr-03", eye(4, 6, -66), { axis: "x", max: -1 })
  ],
  hazards: [
    apertureX("refr-w1", -22, 22, -4, 10, -8, -6, 3.5),
    apertureX("refr-w2", -22, 22, -4, 10, -18, -0.5, 3.5),
    apertureX("refr-w3", -22, 22, -4, 10, -42, 15, 3.5)
  ]
};

// MACHINERY — the ring is on the rim beside you, and the rim hides everything
// below it. The cave underneath is a dependency chain: Cube opens the chamber,
// the chamber's Prism moves the doorway, the back bay's Diamond wakes the lift,
// and the lift is the only way home.
const S15_SEAL: HazardSpec = {
  id: "mach-seal",
  kind: "sightline-gate",
  center: [-15, 4, -8],
  size: [0.45, 8, 12],
  cycle: { period: 999, openFor: 0.05, phase: 1 }
};

const S15: RoomSpec = {
  id: "sector-15-machinery",
  title: "MACHINERY",
  lesson: "Cube changes access. Diamond wakes motion. Prism reroutes energy. Read all three before the first Sphere.",
  grammar: ["moving-endpoint", "origin-matters", "reorientation", "route-fork"],
  spawn: eye(0, 20, 2),
  goal: ring(4, 20, 3),
  requiredKills: 5,
  platforms: [
    floor(-6, 20, -4, 42, 20),
    // Cave floor under the rim, the forecourt in front, and the lift slot between.
    floor(0, 0, -4, 30, 20),
    floor(0, 0, -24, 30, 12),
    floor(-8.75, 0, -16, 12.5, 4),
    floor(8.75, 0, -16, 12.5, 4),
    moving(floor(0, 10, -16, 5, 4), "mach-lift", "y", 10, 0.07, true),
    // Sealed chamber on the left: roofed and walled so only the seal lets you in.
    floor(-21, 0, -4, 12, 20),
    solid(-27, -15, 0, 19, -14.6, -14),
    solid(-15.3, -14.7, 8, 19, -14, -2),
    solid(-16, -14.5, 0, 19, -2, 6),
    // Back-bay baffle hides the Diamond until you are through the doorway.
    solid(-6, 6, 0, 6, 2.5, 3)
  ],
  enemies: [
    sentry("mach-01", eye(0, 0, -26)),
    orbit("mach-02", [6, 12, -24], "xz", 2, 1.5, 0.1),
    cube("mach-cube", [8, 3, -8], ["mach-seal", "mach-curtain"]),
    drifter("mach-03", [0, 10, -6], "x", 4, 0.6),
    prism("mach-prism", [-24, 2.5, 2], ["mach-door"], -20),
    sentry("mach-04", eye(-21, 0, -10)),
    sentry("mach-05", eye(-8, 0, 4)),
    diamond("mach-diamond", [0, 2.2, 5], ["mach-lift"])
  ],
  hazards: [
    S15_SEAL,
    field("mach-curtain", -15.6, -14.4, 0, 7, -14, -2),
    apertureX("mach-door", -15, 15, -2, 8, -2, 30, 3.5)
  ]
};

// COMPOSITION — Act II exam as a three-storey stack. Each storey hides the one
// below and adds one tool: L3 a crouch slit to the Cube that opens its hole, L2 a
// Prism doorway to the next hole, L1 a Diamond that raises the ring pod.
const S16: RoomSpec = {
  id: "sector-16-composition",
  title: "COMPOSITION",
  lesson: "Act II exam. Shapes alter the machine. Spheres alone alter your position.",
  grammar: ["stop-short", "airborne-chain", "low-profile", "reorientation"],
  spawn: eye(-6, 16, 9.5),
  goal: ring(8.5, 5, -8),
  requiredKills: 7,
  platforms: [
    // L3 (top 16): hole NE, split by a crouch-slit partition.
    ...slabWithHole(-12, 12, -12, 12, 16, 4, 10, -10, -4),
    ...slitWallX(-12, 12, 6, 16, 5, 1.5),
    // L2 (top 8): hole SW.
    ...slabWithHole(-12, 12, -12, 12, 8, -10, -4, 4, 10),
    // L1 (top 0): the ring waits on a pedestal; a flush pod (dormant) rides to it.
    ...slabWithHole(-12, 12, -12, 12, 0, 1, 6, -10, -6),
    moving(floor(3.5, 0, -8, 5, 4), "comp-pod", "y", 5, 0.1, true),
    floor(8, 5, -8, 4, 4),
    // Pod stand: the Diamond sits behind this screen, seen only from the far side.
    solid(-12, -4, 0, 5, 7, 8.5),
    // Outer shell so no storey sees another except through its hole.
    solid(-13.5, -12, -1, 22, -13.5, 13.5),
    solid(12, 13.5, -1, 22, -13.5, 13.5),
    solid(-12, 12, -1, 22, -13.5, -12),
    solid(-12, 12, -1, 22, 12, 13.5)
  ],
  enemies: [
    cube("comp-cube", [-4, 17.5, -8], ["comp-hole-3"]),
    crouchSentry("comp-01", -7, 16, -7),
    drifter("comp-02", [-4, 12, -2], "x", 3, 0.7),
    prism("comp-prism", [8, 11, -10], ["comp-door"], -26),
    shield("comp-03", eye(-7, 8, 8), { axis: "x", min: 2 }),
    orbit("comp-04", [6, 4.5, 6], "xz", 2.5, 2, 0.12),
    diamond("comp-diamond", [-8, 2, 11], ["comp-pod"]),
    sentry("comp-05", eye(8, 0, 9)),
    crouchSentry("comp-06", -9, 0, -9),
    sentry("comp-07", eye(-6, 0, -2))
  ],
  hazards: [
    field("comp-hole-3", 4, 10, 15, 16.2, -10, -4),
    apertureX("comp-door", -12, 12, 6, 14, 0, 24, 3.5)
  ]
};

// PULSE — stacked switchback. Terraces 3 and 4 sit directly beneath 1 and 2,
// so the route crosses the same pulsing membrane out, back and out again. Each
// upper storey hides the one below; the crawl roof leaves the last line to a
// crouched eye, and the final Sphere only answers from below.
const S17: RoomSpec = {
  id: "sector-17-pulse",
  title: "PULSE",
  lesson: "The field is part of the timing equation. A correct warp at the wrong phase is still wrong.",
  grammar: ["moving-endpoint", "stop-short", "timing-chain", "low-profile"],
  spawn: eye(-17, 12, -2),
  goal: ring(6, 0.5, -4),
  requiredKills: 5,
  platforms: [
    floor(-15, 12, -6, 10, 12),
    floor(-15, 4, -6, 10, 12),
    crawl(-15, -10, -12, 0, 4),
    floor(5, 8, -6, 10, 12),
    floor(5, 0.5, -6, 10, 12)
  ],
  enemies: [
    sentry("pulse-01", eye(5, 8, -4)),
    drifter("pulse-02", [-5, 10, 4], "y", 2, 0.8),
    sentry("pulse-03", eye(-18, 4, -6)),
    crouchSentry("pulse-04", -12, 4, -6),
    sentry("pulse-05", eye(5, 0.5, -8), undefined, { axis: "y", max: 7 })
  ],
  hazards: [
    field("pulse-membrane", -5.5, -4.5, -2, 16, -14, 2, { period: 2.6, openFor: 1.0 })
  ]
};

// SWEEP — open arena. Blades cross the floor on two axes; staggered pylons are
// the only ground they cannot reach. Leave the hazard plane, and keep leaving it.
const S18: RoomSpec = {
  id: "sector-18-sweep",
  title: "SWEEP",
  lesson: "Use Warp to leave the hazard plane. Reacquire before gravity puts you back into it.",
  grammar: ["airborne-chain", "reorientation", "timing-chain"],
  spawn: eye(0, 2, 16),
  goal: ring(0, 4, -37),
  requiredKills: 6,
  platforms: [
    floor(0, 2, 16, 10, 6),
    floor(0, 0, -11, 40, 40),
    solid(-13.25, -10.75, 0, 8, -3.25, -0.75),
    solid(8.75, 11.25, 0, 10, -9.25, -6.75),
    solid(-9.25, -6.75, 0, 12, -19.25, -16.75),
    solid(10.75, 13.25, 0, 9, -27.25, -24.75),
    floor(0, 4, -37, 10, 6)
  ],
  enemies: [
    sentry("sweep-01", eye(-12, 8, -2)),
    sentry("sweep-02", eye(10, 10, -8)),
    drifter("sweep-03", [0, 10, -12], "x", 4, 0.6),
    sentry("sweep-04", eye(-8, 12, -18)),
    sentry("sweep-05", eye(12, 9, -26)),
    orbit("sweep-06", [0, 7.5, -35], "xy", 2, 1, 0.12)
  ],
  hazards: [
    sweep("sweep-a", [0, 1.5, -11], [40, 3, 0.8], "z", 19, 0.1),
    sweep("sweep-b", [0, 1.5, -11], [0.8, 3, 40], "x", 19, 0.13, 1.2)
  ]
};

export const ROOMS_11_TO_18: RoomSpec[] = [S11, S12, S13, S14, S15, S16, S17, S18];

export const MAPS_11_TO_18: CampaignMapDefinition[] = ROOMS_11_TO_18.map((field, i) => {
  const n = i + 11;
  return {
    id: `map-${n}`,
    label: `SECTOR ${String(n).padStart(2, "0")} // ${field.title}`,
    subtitle: field.lesson,
    focus: field.grammar,
    implemented: true,
    campaignRooms: [field],
    courseRooms: [structuredClone(field) as RoomSpec]
  };
});
