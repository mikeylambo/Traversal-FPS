import type { RoomSpec } from "./stages";
import type { CampaignMapDefinition } from "./campaign";

const start = (x = 0): RoomSpec["platforms"] => [
  { center: [x, 0, 8], size: [12, 1, 12] }
];
const finish = (x: number, z: number): RoomSpec["platforms"][number] => ({ center: [x, 0, z], size: [11, 1, 10] });

const field09: RoomSpec = {
  id: "sector-09-crossings", title: "CROSSINGS", lesson: "Diamond moves the crossing. Time the moving endpoint against moving geometry.",
  grammar: ["stop-short", "moving-endpoint", "route-fork"], spawn: [0, 2.2, 10], goal: [0, 1.1, -76], requiredKills: 4,
  platforms: [...start(), { id: "a2-09-mobile", group: "crossing", center: [-9, 0, -17], size: [8, 1, 8] }, { center: [10, 2, -36], size: [8, 1, 8] }, { center: [-7, 1, -55], size: [8, 1, 8] }, finish(0, -76)],
  enemies: [
    { id: "a2-09-a", kind: "drifter", position: [0, 4, -18], drift: { axis: "x", amplitude: 10, speed: .72 } },
    { id: "a2-09-b", kind: "sentry", position: [10, 4.2, -36] },
    { id: "a2-09-c", kind: "drifter", position: [0, 7, -55], drift: { axis: "x", amplitude: 11, speed: .92 } },
    { id: "a2-09-d", kind: "sentry", position: [0, 3, -78] },
    { id: "a2-09-recovery", kind: "sentry", position: [-12, 4, -43] }
  ],
  actors: [{ id: "a2-09-diamond", kind: "diamond", position: [3.5, 3.1, -3], targetGroup: "crossing", moveOffset: [18, 2, 0], moveDuration: 1.15 }]
};

const field10: RoomSpec = {
  id: "sector-10-sightlines", title: "SIGHTLINES", lesson: "Cube changes the room state. Use the new sightline, not the Cube itself, as your route.",
  grammar: ["origin-matters", "reorientation", "airborne-chain"], spawn: [-8, 2.2, 9], goal: [8, 1.1, -72], requiredKills: 4,
  platforms: [...start(-8), { id: "a2-10-wall", group: "sightline", center: [0, 4, -14], size: [1, 8, 18] }, { center: [10, 2, -18], size: [7, 1, 7] }, { center: [-8, 1, -39], size: [7, 1, 7] }, { center: [4, 4, -50], size: [1, 8, 18] }, finish(8, -72)],
  enemies: [
    { id: "a2-10-angle", kind: "sentry", position: [10, 4.2, -18] },
    { id: "a2-10-origin", kind: "shield", position: [-8, 4.2, -39], originConstraint: { axis: "x", min: 4, rejectMessage: "ORIGIN REJECT // FIND THE SIDE ANGLE" } },
    { id: "a2-10-high", kind: "sentry", position: [9, 8, -51] },
    { id: "a2-10-exit", kind: "sentry", position: [8, 3, -73] }
  ],
  actors: [{ id: "a2-10-cube", kind: "cube", position: [-4.5, 3.2, -3], targetGroup: "sightline", moveOffset: [11, 0, 0] }]
};

const field11: RoomSpec = {
  id: "sector-11-relay", title: "RELAY", lesson: "Stay airborne. Read the next endpoint before the current vector is finished.",
  grammar: ["airborne-chain", "moving-endpoint", "reorientation"], spawn: [0, 2.2, 9], goal: [0, 1.1, -82], requiredKills: 5,
  platforms: [...start(), { center: [11, 1, -25], size: [6, 1, 6] }, { center: [-11, 3, -48], size: [6, 1, 6] }, finish(0, -82)],
  enemies: [
    { id: "a2-11-1", kind: "sentry", position: [0, 9, -12] },
    { id: "a2-11-2", kind: "drifter", position: [7, 8, -29], drift: { axis: "x", amplitude: 7, speed: .9 } },
    { id: "a2-11-3", kind: "sentry", position: [-11, 7, -48] },
    { id: "a2-11-4", kind: "drifter", position: [0, 9, -64], drift: { axis: "y", amplitude: 3, speed: 1.1 } },
    { id: "a2-11-5", kind: "sentry", position: [0, 3, -83] }
  ]
};

const field12: RoomSpec = {
  id: "sector-12-gates", title: "GATES", lesson: "Prism routes energy. Create the safe opening, then solve the vector through it.",
  grammar: ["stop-short", "origin-matters", "moving-endpoint"], spawn: [0, 2.2, 9], goal: [0, 1.1, -74], requiredKills: 4,
  platforms: [...start(), { center: [-8, 0, -22], size: [7, 1, 7] }, { center: [8, 0, -44], size: [7, 1, 7] }, finish(0, -74)],
  enemies: [
    { id: "a2-12-1", kind: "sentry", position: [-8, 4, -22] },
    { id: "a2-12-2", kind: "shield", position: [8, 4, -44], originConstraint: { axis: "x", max: -2, rejectMessage: "GATE REJECT // CHANGE ORIGIN" } },
    { id: "a2-12-3", kind: "drifter", position: [0, 5, -61], drift: { axis: "x", amplitude: 8, speed: .85 } },
    { id: "a2-12-4", kind: "sentry", position: [0, 3, -76] }
  ],
  hazards: [{ id: "a2-12-pulse", group: "energy-12", kind: "sightline-gate", center: [0, 4, -55], size: [18, 8, 1], cycle: { period: 3.2, openFor: .55 } }],
  actors: [{ id: "a2-12-prism", kind: "prism", position: [-8, 4.3, -22], targetGroup: "energy-12" }]
};

const field13: RoomSpec = {
  id: "sector-13-fork", title: "FORK", lesson: "Every visible sphere may work. Mastery is knowing which ones not to spend.",
  grammar: ["route-fork", "stop-short", "reorientation"], spawn: [0, 2.2, 10], goal: [0, 1.1, -72], requiredKills: 3,
  platforms: [...start(), { center: [-11, 1, -22], size: [7, 1, 7] }, { center: [11, 3, -26], size: [7, 1, 7] }, { center: [0, 1, -48], size: [9, 1, 8] }, finish(0, -72)],
  enemies: [
    { id: "a2-13-left", kind: "sentry", position: [-11, 4, -22] }, { id: "a2-13-right", kind: "sentry", position: [11, 6, -26] },
    { id: "a2-13-center", kind: "drifter", position: [0, 7, -36], drift: { axis: "x", amplitude: 9, speed: .8 } },
    { id: "a2-13-cut", kind: "sentry", position: [0, 4, -49] }, { id: "a2-13-extra", kind: "sentry", position: [-12, 5, -57] },
    { id: "a2-13-final", kind: "sentry", position: [0, 3, -74] }
  ]
};

const field14: RoomSpec = {
  id: "sector-14-refraction", title: "REFRACTION", lesson: "Prism changes the safe line; reorientation determines whether that line is useful.",
  grammar: ["route-fork", "reorientation", "moving-endpoint"], spawn: [-7, 2.2, 9], goal: [7, 1.1, -75], requiredKills: 4,
  platforms: [...start(-7), { center: [8, 2, -18], size: [7, 1, 7] }, { center: [-8, 2, -39], size: [7, 1, 7] }, { center: [8, 2, -58], size: [7, 1, 7] }, finish(7, -75)],
  enemies: [
    { id: "a2-14-1", kind: "sentry", position: [8, 5, -18] }, { id: "a2-14-2", kind: "drifter", position: [0, 7, -38], drift: { axis: "x", amplitude: 10, speed: .8 } },
    { id: "a2-14-3", kind: "shield", position: [8, 5, -58], originConstraint: { axis: "x", max: -2 } }, { id: "a2-14-4", kind: "sentry", position: [7, 3, -77] },
    { id: "a2-14-secret", kind: "sentry", position: [-14, 9, -61] }
  ],
  hazards: [
    { id: "a2-14-energy", group: "energy-14", kind: "sightline-gate", center: [0, 5, -47], size: [19, 10, 1], cycle: { period: 4, openFor: .35 } },
    { id: "a2-14-sweep", kind: "sweep", center: [0, 4, -49], size: [.6, 8, 22], drift: { axis: "x", amplitude: 16, speed: .45 } }
  ],
  actors: [{ id: "a2-14-prism", kind: "prism", position: [8, 5.2, -18], targetGroup: "energy-14" }]
};

const field15: RoomSpec = {
  id: "sector-15-machinery", title: "MACHINERY", lesson: "Cube changes state. Diamond changes position. Solve both as one machine.",
  grammar: ["moving-endpoint", "origin-matters", "reorientation", "route-fork"], spawn: [0, 2.2, 10], goal: [0, 1.1, -84], requiredKills: 5,
  platforms: [...start(), { id: "a2-15-slide", group: "machinery-slide", center: [-10, 1, -20], size: [8, 1, 8] }, { center: [10, 4, -40], size: [8, 1, 8] }, { id: "a2-15-wall", group: "machinery-state", center: [0, 4, -51], size: [1, 8, 15] }, { center: [-10, 2, -61], size: [8, 1, 8] }, finish(0, -84)],
  enemies: [
    { id: "a2-15-1", kind: "drifter", position: [0, 5, -20], drift: { axis: "x", amplitude: 10, speed: .72 } },
    { id: "a2-15-2", kind: "shield", position: [10, 7, -40], originConstraint: { axis: "x", max: -3 } },
    { id: "a2-15-3", kind: "drifter", position: [0, 8, -52], drift: { axis: "y", amplitude: 4, speed: 1.05 } },
    { id: "a2-15-4", kind: "sentry", position: [-10, 5, -61] }, { id: "a2-15-5", kind: "sentry", position: [0, 3, -86] }
  ],
  hazards: [{ id: "a2-15-pulse", kind: "lethal-field", center: [0, 4, -70], size: [20, 8, 2], cycle: { period: 3.4, openFor: 1.5 } }],
  actors: [
    { id: "a2-15-diamond", kind: "diamond", position: [3.7, 3.2, -4], targetGroup: "machinery-slide", moveOffset: [20, 3, -5], moveDuration: 1.35 },
    { id: "a2-15-cube", kind: "cube", position: [10, 7.2, -40], targetGroup: "machinery-state", moveOffset: [12, 0, 0] }
  ]
};

const field16: RoomSpec = {
  id: "sector-16-composition", title: "COMPOSITION", lesson: "Act II exam. Shapes alter the sentence; spheres move you through it.",
  grammar: ["stop-short", "airborne-chain", "moving-endpoint", "reorientation"], spawn: [0, 2.2, 11], goal: [0, 1.1, -104], requiredKills: 6,
  platforms: [...start(), { id: "a2-16-lift", group: "exam-motion", center: [-11, 2, -25], size: [7, 1, 7] }, { center: [11, 4, -48], size: [7, 1, 7] }, { id: "a2-16-wall", group: "exam-state", center: [0, 5, -68], size: [1, 10, 16] }, { center: [-8, 2, -72], size: [7, 1, 7] }, finish(0, -104)],
  enemies: [
    { id: "a2-16-1", kind: "drifter", position: [0, 6, -18], drift: { axis: "x", amplitude: 10, speed: .82 } }, { id: "a2-16-2", kind: "sentry", position: [-11, 7, -25] },
    { id: "a2-16-3", kind: "shield", position: [11, 7, -48], originConstraint: { axis: "x", max: -3 } }, { id: "a2-16-4", kind: "drifter", position: [0, 10, -63], drift: { axis: "y", amplitude: 4, speed: 1.1 } },
    { id: "a2-16-5", kind: "sentry", position: [-8, 5, -72] }, { id: "a2-16-6", kind: "sentry", position: [0, 3, -106] }, { id: "a2-16-recovery", kind: "sentry", position: [12, 4, -82] }
  ],
  hazards: [
    { id: "a2-16-sweep", kind: "sweep", center: [0, 5, -57], size: [.7, 10, 24], drift: { axis: "x", amplitude: 18, speed: .52 } },
    { id: "a2-16-gate", group: "exam-energy", kind: "sightline-gate", center: [0, 5, -88], size: [22, 10, 1], cycle: { period: 3, openFor: .2, phase: .4 } }
  ],
  actors: [
    { id: "a2-16-diamond", kind: "diamond", position: [4.5, 3.4, -4], targetGroup: "exam-motion", moveOffset: [22, 4, -5], moveDuration: 1.1 },
    { id: "a2-16-cube", kind: "cube", position: [11, 7.3, -48], targetGroup: "exam-state", moveOffset: [13, 0, 0] },
    { id: "a2-16-prism", kind: "prism", position: [-8, 6.1, -72], targetGroup: "exam-energy" }
  ]
};

function courseFrom(field: RoomSpec, suffix: string, grammar: RoomSpec["grammar"]): RoomSpec {
  return { ...structuredClone(field), id: `${field.id}-${suffix}`, title: `${field.title} // ${suffix.toUpperCase()}`, grammar };
}

export const ACT_II_MAPS: CampaignMapDefinition[] = [
  ["map-09", "SECTOR 09 // CROSSINGS", "Destinations become trajectories.", ["Diamond", "Stop Short", "Moving Endpoint"], field09],
  ["map-10", "SECTOR 10 // SIGHTLINES", "Position creates the shot.", ["Cube", "Origin", "Reorientation", "Occlusion"], field10],
  ["map-11", "SECTOR 11 // RELAY", "Aerial acquisition becomes continuous language.", ["Aerial Chain", "Moving Endpoint"], field11],
  ["map-12", "SECTOR 12 // GATES", "Physical and energy openings overlap.", ["Prism", "Origin", "Timing", "Stop Short"], field12],
  ["map-13", "SECTOR 13 // FORK", "Useful is not the same as necessary.", ["Route Fork", "Efficiency"], field13],
  ["map-14", "SECTOR 14 // REFRACTION", "Safe lines, fast lines and hidden lines diverge.", ["Prism", "Route Choice", "Reorientation", "Hazards"], field14],
  ["map-15", "SECTOR 15 // MACHINERY", "The room reads as one coupled machine.", ["Cube", "Diamond", "Moving Endpoint", "Origin"], field15],
  ["map-16", "SECTOR 16 // COMPOSITION", "Act II examination.", ["Cube", "Diamond", "Prism", "Four-System Composition"], field16]
].map(([id, label, subtitle, focus, field]) => ({
  id: id as string, label: label as string, subtitle: subtitle as string, focus: focus as string[], implemented: true,
  campaignRooms: [field as RoomSpec],
  courseRooms: [
    courseFrom(field as RoomSpec, "read", (field as RoomSpec).grammar.slice(0, 2)),
    courseFrom(field as RoomSpec, "combine", (field as RoomSpec).grammar.slice(0, 3)),
    courseFrom(field as RoomSpec, "master", (field as RoomSpec).grammar.slice(0, 4))
  ]
}));