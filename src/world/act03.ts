import type { CampaignMapDefinition } from "./campaign";
import type { RoomSpec } from "./stages";

type ModeMap = CampaignMapDefinition & {
  timeTrialRooms: RoomSpec[];
  challengeRooms: RoomSpec[];
};

const pad = (x: number, y: number, z: number, sx = 8, sz = 8): RoomSpec["platforms"][number] => ({ center: [x, y, z], size: [sx, 1, sz] });
const base = (): RoomSpec["platforms"] => [pad(0, 0, 9, 13, 12)];
const goal = (z: number): RoomSpec["platforms"][number] => pad(0, 0, z, 13, 11);

const s17: RoomSpec = {
  id: "sector-17-pulse", title: "PULSE", lesson: "The field is part of the timing equation. Move when the room is safe, not merely when the sphere is aligned.",
  grammar: ["moving-endpoint", "stop-short", "timing-chain"], spawn: [0, 2.2, 11], goal: [0, 1.1, -82], requiredKills: 4,
  platforms: [...base(), pad(-9, 1, -22), pad(9, 2, -47), goal(-82)],
  enemies: [
    { id: "a3-17-1", kind: "drifter", position: [0, 5, -21], drift: { axis: "x", amplitude: 11, speed: .86 } },
    { id: "a3-17-2", kind: "sentry", position: [-9, 4, -30] },
    { id: "a3-17-3", kind: "drifter", position: [0, 7, -59], drift: { axis: "y", amplitude: 4, speed: 1.12 } },
    { id: "a3-17-4", kind: "sentry", position: [0, 3, -84] }
  ],
  hazards: [
    { id: "a3-17-field-a", kind: "lethal-field", center: [0, 4, -37], size: [24, 9, 2], cycle: { period: 3.1, openFor: 1.15 } },
    { id: "a3-17-field-b", kind: "lethal-field", center: [0, 4, -68], size: [24, 9, 2], cycle: { period: 2.6, openFor: .85, phase: .8 } }
  ]
};

const s18: RoomSpec = {
  id: "sector-18-sweep", title: "SWEEP", lesson: "Warp above the sweep, reacquire in phase hang, then leave before gravity returns you to danger.",
  grammar: ["airborne-chain", "reorientation", "timing-chain"], spawn: [-7, 2.2, 10], goal: [0, 1.1, -86], requiredKills: 5,
  platforms: [...base(), pad(10, 2, -24, 7, 7), pad(-10, 3, -51, 7, 7), goal(-86)],
  enemies: [
    { id: "a3-18-1", kind: "sentry", position: [8, 8, -15] },
    { id: "a3-18-2", kind: "sentry", position: [10, 6, -24] },
    { id: "a3-18-3", kind: "drifter", position: [0, 10, -42], drift: { axis: "x", amplitude: 9, speed: .95 } },
    { id: "a3-18-4", kind: "sentry", position: [-10, 6, -51] },
    { id: "a3-18-5", kind: "sentry", position: [0, 3, -88] }
  ],
  hazards: [
    { id: "a3-18-sweep-a", kind: "sweep", center: [0, 4, -35], size: [.6, 9, 28], drift: { axis: "x", amplitude: 19, speed: .56 } },
    { id: "a3-18-sweep-b", kind: "sweep", center: [0, 6, -68], size: [28, .6, 2], drift: { axis: "y", amplitude: 5, speed: .48, phase: .6 } }
  ]
};

const s19: RoomSpec = {
  id: "sector-19-collapse", title: "COLLAPSE", lesson: "Cube commits the room to a new state. Solve from where the old state no longer helps you.",
  grammar: ["origin-matters", "reorientation", "route-fork"], spawn: [0, 2.2, 10], goal: [0, 1.1, -82], requiredKills: 4,
  platforms: [...base(), { id: "a3-19-left", group: "collapse-state", center: [-10, 1, -23], size: [8, 1, 8] }, pad(10, 3, -46), { id: "a3-19-wall", group: "collapse-state", center: [0, 4, -57], size: [1, 8, 16] }, goal(-82)],
  enemies: [
    { id: "a3-19-1", kind: "sentry", position: [-10, 4, -23] },
    { id: "a3-19-2", kind: "shield", position: [10, 6, -46], originConstraint: { axis: "x", max: -3 } },
    { id: "a3-19-3", kind: "sentry", position: [-8, 7, -65] },
    { id: "a3-19-4", kind: "sentry", position: [0, 3, -84] }
  ],
  actors: [{ id: "a3-19-cube", kind: "cube", position: [4, 3.2, -5], targetGroup: "collapse-state", moveOffset: [20, 2, -4] }]
};

const s20: RoomSpec = {
  id: "sector-20-current", title: "CURRENT", lesson: "Prism creates the corridor. Stop Short decides where inside that corridor you survive.",
  grammar: ["stop-short", "moving-endpoint", "timing-chain", "reorientation"], spawn: [0, 2.2, 10], goal: [0, 1.1, -90], requiredKills: 5,
  platforms: [...base(), pad(-9, 1, -21), pad(10, 2, -47), pad(-7, 2, -69), goal(-90)],
  enemies: [
    { id: "a3-20-1", kind: "sentry", position: [-9, 4, -21] },
    { id: "a3-20-2", kind: "drifter", position: [0, 7, -42], drift: { axis: "x", amplitude: 11, speed: .82 } },
    { id: "a3-20-3", kind: "sentry", position: [10, 5, -47] },
    { id: "a3-20-4", kind: "drifter", position: [-7, 6, -69], drift: { axis: "y", amplitude: 3, speed: 1.2 } },
    { id: "a3-20-5", kind: "sentry", position: [0, 3, -92] }
  ],
  hazards: [
    { id: "a3-20-energy", group: "current-energy", kind: "sightline-gate", center: [0, 5, -57], size: [23, 10, 1], cycle: { period: 5, openFor: .25 } },
    { id: "a3-20-field", kind: "lethal-field", center: [0, 4, -76], size: [22, 8, 2], cycle: { period: 2.8, openFor: .9, phase: .4 } }
  ],
  actors: [{ id: "a3-20-prism", kind: "prism", position: [10, 5.3, -47], targetGroup: "current-energy" }]
};

const s21: RoomSpec = {
  id: "sector-21-counterweight", title: "COUNTERWEIGHT", lesson: "Diamond moves the useful geometry. The obvious activation is not always the clean route.",
  grammar: ["route-fork", "origin-matters", "moving-endpoint"], spawn: [0, 2.2, 11], goal: [0, 1.1, -88], requiredKills: 4,
  platforms: [...base(), { id: "a3-21-mobile", group: "counterweight", center: [-11, 0, -25], size: [9, 1, 9] }, pad(11, 3, -49), goal(-88)],
  enemies: [
    { id: "a3-21-left", kind: "sentry", position: [-11, 4, -25] },
    { id: "a3-21-drift", kind: "drifter", position: [0, 8, -40], drift: { axis: "x", amplitude: 10, speed: .78 } },
    { id: "a3-21-right", kind: "shield", position: [11, 6, -49], originConstraint: { axis: "x", max: -3 } },
    { id: "a3-21-final", kind: "sentry", position: [0, 3, -90] },
    { id: "a3-21-recovery", kind: "sentry", position: [-12, 5, -66] }
  ],
  actors: [{ id: "a3-21-diamond", kind: "diamond", position: [4, 3.2, -5], targetGroup: "counterweight", moveOffset: [22, 4, -5], moveDuration: 1.45 }]
};

const s22: RoomSpec = {
  id: "sector-22-blindside", title: "BLINDSIDE", lesson: "The next target only exists to you when geometry, motion and hazard phase briefly agree.",
  grammar: ["airborne-chain", "moving-endpoint", "reorientation", "timing-chain"], spawn: [-8, 2.2, 10], goal: [8, 1.1, -91], requiredKills: 5,
  platforms: [...base(), { id: "a3-22-wall", group: "blind-state", center: [0, 5, -18], size: [1, 10, 19] }, pad(10, 2, -27), pad(-10, 3, -57), goal(-91)],
  enemies: [
    { id: "a3-22-1", kind: "sentry", position: [10, 8, -18] },
    { id: "a3-22-2", kind: "drifter", position: [0, 9, -37], drift: { axis: "x", amplitude: 10, speed: 1.02 } },
    { id: "a3-22-3", kind: "sentry", position: [-10, 7, -57] },
    { id: "a3-22-4", kind: "drifter", position: [7, 9, -72], drift: { axis: "y", amplitude: 3, speed: 1.18 } },
    { id: "a3-22-5", kind: "sentry", position: [8, 3, -93] }
  ],
  hazards: [{ id: "a3-22-sweep", kind: "sweep", center: [0, 5, -49], size: [.6, 10, 26], drift: { axis: "x", amplitude: 18, speed: .54 } }],
  actors: [{ id: "a3-22-cube", kind: "cube", position: [-4, 3.2, -4], targetGroup: "blind-state", moveOffset: [12, 0, 0] }]
};

const s23: RoomSpec = {
  id: "sector-23-pursuit", title: "PURSUIT", lesson: "Routes expire. Choose the moving endpoint that leaves the next useful vector alive.",
  grammar: ["moving-endpoint", "route-fork", "timing-chain"], spawn: [0, 2.2, 10], goal: [0, 1.1, -94], requiredKills: 4,
  platforms: [...base(), pad(-12, 1, -27), pad(12, 2, -51), pad(0, 1, -73), goal(-94)],
  enemies: [
    { id: "a3-23-a", kind: "drifter", position: [-4, 6, -24], drift: { axis: "x", amplitude: 9, speed: 1.05 } },
    { id: "a3-23-b", kind: "drifter", position: [5, 8, -45], drift: { axis: "x", amplitude: 12, speed: .88 } },
    { id: "a3-23-c", kind: "drifter", position: [0, 7, -67], drift: { axis: "y", amplitude: 4, speed: 1.22 } },
    { id: "a3-23-final", kind: "sentry", position: [0, 3, -96] },
    { id: "a3-23-safe", kind: "sentry", position: [-12, 4, -51] },
    { id: "a3-23-greedy", kind: "sentry", position: [12, 5, -68] }
  ],
  hazards: [{ id: "a3-23-sweep", kind: "sweep", center: [0, 5, -58], size: [.6, 10, 28], drift: { axis: "x", amplitude: 20, speed: .5 } }]
};

const s24: RoomSpec = {
  id: "sector-24-pressure", title: "PRESSURE", lesson: "Act III exam. Read state, motion, energy and hazard timing without surrendering flow.",
  grammar: ["airborne-chain", "moving-endpoint", "reorientation", "timing-chain"], spawn: [0, 2.2, 12], goal: [0, 1.1, -118], requiredKills: 6,
  platforms: [...base(), { id: "a3-24-lift", group: "pressure-motion", center: [-11, 1, -25], size: [8, 1, 8] }, pad(11, 4, -50), { id: "a3-24-wall", group: "pressure-state", center: [0, 5, -72], size: [1, 10, 18] }, pad(-10, 2, -82), goal(-118)],
  enemies: [
    { id: "a3-24-1", kind: "drifter", position: [0, 7, -19], drift: { axis: "x", amplitude: 10, speed: .92 } },
    { id: "a3-24-2", kind: "sentry", position: [-11, 6, -25] },
    { id: "a3-24-3", kind: "shield", position: [11, 7, -50], originConstraint: { axis: "x", max: -3 } },
    { id: "a3-24-4", kind: "drifter", position: [0, 10, -69], drift: { axis: "y", amplitude: 4, speed: 1.12 } },
    { id: "a3-24-5", kind: "sentry", position: [-10, 5, -82] },
    { id: "a3-24-6", kind: "sentry", position: [0, 3, -120] }
  ],
  hazards: [
    { id: "a3-24-sweep", kind: "sweep", center: [0, 5, -61], size: [.65, 10, 28], drift: { axis: "x", amplitude: 19, speed: .58 } },
    { id: "a3-24-energy", group: "pressure-energy", kind: "sightline-gate", center: [0, 5, -96], size: [24, 10, 1], cycle: { period: 4, openFor: .2 } },
    { id: "a3-24-field", kind: "lethal-field", center: [0, 4, -105], size: [23, 8, 2], cycle: { period: 2.7, openFor: .8, phase: .5 } }
  ],
  actors: [
    { id: "a3-24-diamond", kind: "diamond", position: [4.5, 3.5, -4], targetGroup: "pressure-motion", moveOffset: [22, 4, -5], moveDuration: 1.05 },
    { id: "a3-24-cube", kind: "cube", position: [11, 7.2, -50], targetGroup: "pressure-state", moveOffset: [14, 0, 0] },
    { id: "a3-24-prism", kind: "prism", position: [-10, 5.4, -82], targetGroup: "pressure-energy" }
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
    courseRooms: [cloneCourse(field, "course", "Read the pressure pattern, then execute the clean route.")],
    timeTrialRooms: [
      cloneCourse(field, "sprint", "Time Trial: minimize waits and preserve airborne flow.", 1.08),
      cloneCourse(field, "redline", "Time Trial: faster moving endpoints; route efficiency is time.", 1.18)
    ],
    challengeRooms: [
      cloneCourse(field, "clean", "Challenge: exact sphere route. Spatial-device activations do not count as misses."),
      cloneCourse(field, "pressure", "Challenge: exact route under the full hazard pattern.", 1.1)
    ]
  };
}

export const ACT_III_MAPS: ModeMap[] = [
  map("map-17", "SECTOR 17 // PULSE", "Hazard phase joins endpoint timing.", ["Timed Fields", "Moving Endpoint", "Stop Short"], s17),
  map("map-18", "SECTOR 18 // SWEEP", "Airborne flow above moving danger.", ["Sweep", "Aerial Chain", "Reorientation"], s18),
  map("map-19", "SECTOR 19 // COLLAPSE", "Commitment changes the room behind you.", ["Cube", "Origin", "Commitment"], s19),
  map("map-20", "SECTOR 20 // CURRENT", "Energy routing and survival windows overlap.", ["Prism", "Stop Short", "Hazard Timing"], s20),
  map("map-21", "SECTOR 21 // COUNTERWEIGHT", "Moving geometry creates route choice.", ["Diamond", "Route Fork", "Origin"], s21),
  map("map-22", "SECTOR 22 // BLINDSIDE", "Sightlines exist only briefly.", ["Cube", "Occlusion", "Aerial Chain", "Timing"], s22),
  map("map-23", "SECTOR 23 // PURSUIT", "The useful route changes while you watch it.", ["Moving Endpoint", "Route Fork", "Sweep"], s23),
  map("map-24", "SECTOR 24 // PRESSURE", "Act III examination.", ["Cube", "Diamond", "Prism", "Hazard Synthesis"], s24)
];