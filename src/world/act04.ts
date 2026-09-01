import type { CampaignMapDefinition } from "./campaign";
import type { RoomSpec } from "./stages";

type ModeMap = CampaignMapDefinition & {
  timeTrialRooms: RoomSpec[];
  challengeRooms: RoomSpec[];
};

const p = (x: number, y: number, z: number, sx = 8, sz = 8): RoomSpec["platforms"][number] => ({ center: [x, y, z], size: [sx, 1, sz] });
const entry = (): RoomSpec["platforms"] => [p(0, 0, 10, 13, 12)];
const exit = (z: number): RoomSpec["platforms"][number] => p(0, 0, z, 13, 11);

const s25: RoomSpec = {
  id: "sector-25-minimal", title: "MINIMAL", lesson: "Nothing here is decorative. Several routes work; only some preserve the geometry you need later.",
  grammar: ["route-fork", "stop-short", "reorientation", "origin-matters"], spawn: [0, 2.2, 12], goal: [0, 1.1, -91], requiredKills: 3,
  platforms: [...entry(), p(-12, 1, -26), p(12, 3, -33), p(0, 1, -60, 9, 8), exit(-91)],
  enemies: [
    { id: "a4-25-left", kind: "sentry", position: [-12, 4, -26] },
    { id: "a4-25-right", kind: "shield", position: [12, 6, -33], originConstraint: { axis: "x", max: -3 } },
    { id: "a4-25-mid", kind: "sentry", position: [0, 5, -60] },
    { id: "a4-25-high", kind: "sentry", position: [11, 10, -65] },
    { id: "a4-25-final", kind: "sentry", position: [0, 3, -93] }
  ]
};

const s26: RoomSpec = {
  id: "sector-26-orbit", title: "ORBIT", lesson: "Everything has a phase. Diamond changes the frame; moving endpoints decide when that frame becomes useful.",
  grammar: ["moving-endpoint", "airborne-chain", "origin-matters", "reorientation"], spawn: [0, 2.2, 12], goal: [0, 1.1, -101], requiredKills: 5,
  platforms: [...entry(), { id: "a4-26-ring", group: "orbit-frame", center: [-12, 1, -26], size: [8, 1, 8] }, p(12, 4, -50), p(-10, 3, -75), exit(-101)],
  enemies: [
    { id: "a4-26-1", kind: "drifter", position: [0, 7, -22], drift: { axis: "x", amplitude: 11, speed: 1.06 } },
    { id: "a4-26-2", kind: "drifter", position: [6, 9, -43], drift: { axis: "x", amplitude: 9, speed: .86 } },
    { id: "a4-26-3", kind: "shield", position: [12, 7, -50], originConstraint: { axis: "x", max: -2 } },
    { id: "a4-26-4", kind: "drifter", position: [-10, 8, -75], drift: { axis: "y", amplitude: 4, speed: 1.16 } },
    { id: "a4-26-5", kind: "sentry", position: [0, 3, -103] }
  ],
  actors: [{ id: "a4-26-diamond", kind: "diamond", position: [4.5, 3.6, -5], targetGroup: "orbit-frame", moveOffset: [24, 5, -6], moveDuration: 1.25 }]
};

const s27: RoomSpec = {
  id: "sector-27-negative-space", title: "NEGATIVE SPACE", lesson: "The route is the safe absence between lethal volumes. Full warp is often the wrong answer.",
  grammar: ["stop-short", "reorientation", "timing-chain", "route-fork"], spawn: [0, 2.2, 12], goal: [0, 1.1, -98], requiredKills: 4,
  platforms: [...entry(), p(-10, 1, -24, 6, 6), p(9, 2, -49, 6, 6), p(-7, 1, -73, 6, 6), exit(-98)],
  enemies: [
    { id: "a4-27-1", kind: "sentry", position: [-10, 5, -31] },
    { id: "a4-27-2", kind: "drifter", position: [0, 8, -52], drift: { axis: "x", amplitude: 10, speed: .9 } },
    { id: "a4-27-3", kind: "sentry", position: [-7, 5, -73] },
    { id: "a4-27-4", kind: "sentry", position: [0, 3, -100] },
    { id: "a4-27-secret", kind: "sentry", position: [13, 9, -79] }
  ],
  hazards: [
    { id: "a4-27-field-a", kind: "lethal-field", center: [0, 3.5, -38], size: [25, 7, 5], cycle: { period: 3.2, openFor: .65 } },
    { id: "a4-27-field-b", kind: "lethal-field", center: [0, 4, -64], size: [25, 8, 5], cycle: { period: 2.9, openFor: .7, phase: .8 } },
    { id: "a4-27-field-c", kind: "lethal-field", center: [0, 4, -84], size: [25, 8, 4], cycle: { period: 2.6, openFor: .58, phase: .2 } }
  ]
};

const s28: RoomSpec = {
  id: "sector-28-state", title: "STATE", lesson: "The same architecture means something different after each Cube shot. Track room state, not just destination.",
  grammar: ["origin-matters", "reorientation", "route-fork", "stop-short"], spawn: [-8, 2.2, 12], goal: [8, 1.1, -100], requiredKills: 5,
  platforms: [...entry(), { id: "a4-28-wall-a", group: "state-a", center: [0, 4, -20], size: [1, 8, 18] }, p(11, 2, -29), { id: "a4-28-wall-b", group: "state-b", center: [3, 5, -55], size: [1, 10, 18] }, p(-11, 3, -64), exit(-100)],
  enemies: [
    { id: "a4-28-1", kind: "sentry", position: [11, 5, -29] },
    { id: "a4-28-2", kind: "shield", position: [-11, 6, -64], originConstraint: { axis: "x", min: 3 } },
    { id: "a4-28-3", kind: "drifter", position: [0, 8, -77], drift: { axis: "x", amplitude: 9, speed: .86 } },
    { id: "a4-28-4", kind: "sentry", position: [8, 6, -87] },
    { id: "a4-28-5", kind: "sentry", position: [8, 3, -102] }
  ],
  actors: [
    { id: "a4-28-cube-a", kind: "cube", position: [-4, 3.2, -5], targetGroup: "state-a", moveOffset: [12, 0, 0] },
    { id: "a4-28-cube-b", kind: "cube", position: [11, 5.3, -29], targetGroup: "state-b", moveOffset: [-13, 0, 0] }
  ]
};

const s29: RoomSpec = {
  id: "sector-29-circuit", title: "CIRCUIT", lesson: "Prisms define which energy corridors exist. Route choice decides which corridor is worth creating.",
  grammar: ["route-fork", "reorientation", "moving-endpoint", "timing-chain"], spawn: [0, 2.2, 12], goal: [0, 1.1, -105], requiredKills: 5,
  platforms: [...entry(), p(-10, 1, -25), p(10, 3, -49), p(-9, 2, -76), exit(-105)],
  enemies: [
    { id: "a4-29-1", kind: "sentry", position: [-10, 4, -25] },
    { id: "a4-29-2", kind: "drifter", position: [0, 8, -43], drift: { axis: "x", amplitude: 11, speed: .94 } },
    { id: "a4-29-3", kind: "sentry", position: [10, 6, -49] },
    { id: "a4-29-4", kind: "shield", position: [-9, 5, -76], originConstraint: { axis: "x", min: 2 } },
    { id: "a4-29-5", kind: "sentry", position: [0, 3, -107] }
  ],
  hazards: [
    { id: "a4-29-energy-a", group: "circuit-a", kind: "sightline-gate", center: [0, 5, -58], size: [24, 10, 1], cycle: { period: 5, openFor: .2 } },
    { id: "a4-29-energy-b", group: "circuit-b", kind: "sightline-gate", center: [0, 5, -87], size: [24, 10, 1], cycle: { period: 5, openFor: .2 } }
  ],
  actors: [
    { id: "a4-29-prism-a", kind: "prism", position: [-10, 4.3, -25], targetGroup: "circuit-a" },
    { id: "a4-29-prism-b", kind: "prism", position: [10, 6.3, -49], targetGroup: "circuit-b" }
  ]
};

const s30: RoomSpec = {
  id: "sector-30-kinetic", title: "KINETIC", lesson: "Diamond turns platforms into alignment events. Use their motion instead of waiting for it to stop.",
  grammar: ["moving-endpoint", "airborne-chain", "stop-short", "reorientation"], spawn: [0, 2.2, 12], goal: [0, 1.1, -112], requiredKills: 6,
  platforms: [...entry(), { id: "a4-30-a", group: "kinetic-a", center: [-12, 1, -25], size: [7, 1, 7] }, { id: "a4-30-b", group: "kinetic-b", center: [12, 3, -53], size: [7, 1, 7] }, p(-10, 2, -81), exit(-112)],
  enemies: [
    { id: "a4-30-1", kind: "drifter", position: [0, 8, -20], drift: { axis: "x", amplitude: 11, speed: 1.04 } },
    { id: "a4-30-2", kind: "sentry", position: [-12, 6, -25] },
    { id: "a4-30-3", kind: "drifter", position: [0, 10, -47], drift: { axis: "x", amplitude: 12, speed: .92 } },
    { id: "a4-30-4", kind: "sentry", position: [12, 7, -53] },
    { id: "a4-30-5", kind: "drifter", position: [-10, 8, -81], drift: { axis: "y", amplitude: 4, speed: 1.15 } },
    { id: "a4-30-6", kind: "sentry", position: [0, 3, -114] }
  ],
  actors: [
    { id: "a4-30-diamond-a", kind: "diamond", position: [4, 3.4, -5], targetGroup: "kinetic-a", moveOffset: [24, 5, -6], moveDuration: 1.05 },
    { id: "a4-30-diamond-b", kind: "diamond", position: [-12, 6.3, -25], targetGroup: "kinetic-b", moveOffset: [-24, 4, -5], moveDuration: 1.1 }
  ]
};

const s31: RoomSpec = {
  id: "sector-31-synthesis", title: "SYNTHESIS", lesson: "No dominant actor. Read the relationship among shapes, hazards and spheres before choosing a route.",
  grammar: ["route-fork", "origin-matters", "moving-endpoint", "reorientation"], spawn: [0, 2.2, 12], goal: [0, 1.1, -120], requiredKills: 6,
  platforms: [...entry(), { id: "a4-31-motion", group: "syn-motion", center: [-11, 1, -26], size: [8, 1, 8] }, p(11, 4, -51), { id: "a4-31-state", group: "syn-state", center: [0, 5, -72], size: [1, 10, 18] }, p(-10, 2, -86), exit(-120)],
  enemies: [
    { id: "a4-31-1", kind: "drifter", position: [0, 7, -20], drift: { axis: "x", amplitude: 10, speed: .98 } },
    { id: "a4-31-2", kind: "sentry", position: [-11, 6, -26] },
    { id: "a4-31-3", kind: "shield", position: [11, 7, -51], originConstraint: { axis: "x", max: -3 } },
    { id: "a4-31-4", kind: "drifter", position: [0, 10, -72], drift: { axis: "y", amplitude: 4, speed: 1.14 } },
    { id: "a4-31-5", kind: "sentry", position: [-10, 5, -86] },
    { id: "a4-31-6", kind: "sentry", position: [0, 3, -122] },
    { id: "a4-31-alt", kind: "sentry", position: [13, 8, -91] }
  ],
  hazards: [
    { id: "a4-31-sweep", kind: "sweep", center: [0, 5, -62], size: [.65, 10, 28], drift: { axis: "x", amplitude: 19, speed: .56 } },
    { id: "a4-31-energy", group: "syn-energy", kind: "sightline-gate", center: [0, 5, -99], size: [24, 10, 1], cycle: { period: 5, openFor: .2 } }
  ],
  actors: [
    { id: "a4-31-diamond", kind: "diamond", position: [4.5, 3.4, -5], targetGroup: "syn-motion", moveOffset: [22, 4, -5], moveDuration: 1.1 },
    { id: "a4-31-cube", kind: "cube", position: [11, 7.3, -51], targetGroup: "syn-state", moveOffset: [14, 0, 0] },
    { id: "a4-31-prism", kind: "prism", position: [-10, 5.3, -86], targetGroup: "syn-energy" }
  ]
};

const s32: RoomSpec = {
  id: "sector-32-vector", title: "VECTOR", lesson: "Final examination. The construct is the boss. Transform it, cross it, then write one final clean line.",
  grammar: ["stop-short", "airborne-chain", "moving-endpoint", "reorientation"], spawn: [0, 2.2, 14], goal: [0, 1.1, -150], requiredKills: 7,
  platforms: [...entry(), { id: "a4-32-motion", group: "final-motion", center: [-12, 1, -27], size: [8, 1, 8] }, p(12, 4, -55), { id: "a4-32-state", group: "final-state", center: [0, 6, -78], size: [1, 12, 20] }, p(-11, 3, -91), p(10, 2, -118), exit(-150)],
  enemies: [
    { id: "a4-32-1", kind: "drifter", position: [0, 8, -20], drift: { axis: "x", amplitude: 11, speed: 1.02 } },
    { id: "a4-32-2", kind: "sentry", position: [-12, 6, -27] },
    { id: "a4-32-3", kind: "shield", position: [12, 7, -55], originConstraint: { axis: "x", max: -3 } },
    { id: "a4-32-4", kind: "drifter", position: [0, 11, -76], drift: { axis: "y", amplitude: 4, speed: 1.16 } },
    { id: "a4-32-5", kind: "sentry", position: [-11, 6, -91] },
    { id: "a4-32-6", kind: "drifter", position: [10, 7, -118], drift: { axis: "x", amplitude: 7, speed: .96 } },
    { id: "a4-32-7", kind: "sentry", position: [0, 3, -152] }
  ],
  hazards: [
    { id: "a4-32-sweep-a", kind: "sweep", center: [0, 5, -64], size: [.65, 11, 30], drift: { axis: "x", amplitude: 20, speed: .58 } },
    { id: "a4-32-field", kind: "lethal-field", center: [0, 5, -105], size: [25, 10, 3], cycle: { period: 2.65, openFor: .74, phase: .35 } },
    { id: "a4-32-energy", group: "final-energy", kind: "sightline-gate", center: [0, 5, -133], size: [25, 10, 1], cycle: { period: 6, openFor: .2 } }
  ],
  actors: [
    { id: "a4-32-diamond", kind: "diamond", position: [4.5, 3.6, -5], targetGroup: "final-motion", moveOffset: [24, 5, -6], moveDuration: 1.05 },
    { id: "a4-32-cube", kind: "cube", position: [12, 7.4, -55], targetGroup: "final-state", moveOffset: [15, 0, 0] },
    { id: "a4-32-prism", kind: "prism", position: [-11, 6.4, -91], targetGroup: "final-energy" }
  ]
};

function cloneCourse(field: RoomSpec, id: string, lesson: string, speed = 1): RoomSpec {
  const room = structuredClone(field) as RoomSpec;
  room.id = `${field.id}-${id}`;
  room.title = `${field.title} // ${id.toUpperCase()}`;
  room.lesson = lesson;
  for (const enemy of room.enemies) if (enemy.drift) enemy.drift.speed *= speed;
  return room;
}

function map(id: string, label: string, subtitle: string, focus: string[], field: RoomSpec): ModeMap {
  return {
    id, label, subtitle, focus, implemented: true,
    campaignRooms: [field],
    courseRooms: [cloneCourse(field, "course", "Mastery course: solve without a new verb.")],
    timeTrialRooms: [
      cloneCourse(field, "line", "Time Trial: find the minimum-wait line.", 1.08),
      cloneCourse(field, "perfect", "Time Trial: expert endpoint cadence and no recovery route.", 1.2)
    ],
    challengeRooms: [
      cloneCourse(field, "clean", "Challenge: exact sphere route; unnecessary anchors fail the run."),
      cloneCourse(field, "perfect", "Challenge: preserve the intended high-skill route under pressure.", 1.12)
    ]
  };
}

export const ACT_IV_MAPS: ModeMap[] = [
  map("map-25", "SECTOR 25 // MINIMAL", "Ambiguity replaces instruction.", ["Route Fork", "Stop Short", "Origin", "Reorientation"], s25),
  map("map-26", "SECTOR 26 // ORBIT", "Motion becomes the frame of reference.", ["Diamond", "Moving Endpoint", "Aerial Chain"], s26),
  map("map-27", "SECTOR 27 // NEGATIVE SPACE", "Safe absence is the route.", ["Stop Short", "Timed Fields", "Secrets"], s27),
  map("map-28", "SECTOR 28 // STATE", "Room state is part of spatial memory.", ["Cube", "Origin", "Route Choice"], s28),
  map("map-29", "SECTOR 29 // CIRCUIT", "Energy routing creates competing corridors.", ["Prism", "Route Fork", "Timing"], s29),
  map("map-30", "SECTOR 30 // KINETIC", "Moving structures become alignment events.", ["Diamond", "Aerial Chain", "Moving Endpoint"], s30),
  map("map-31", "SECTOR 31 // SYNTHESIS", "Every actor participates; none dominates.", ["Cube", "Diamond", "Prism", "Route Synthesis"], s31),
  map("map-32", "SECTOR 32 // VECTOR", "The construct is the final opponent.", ["Final Exam", "Cube", "Diamond", "Prism"], s32)
];