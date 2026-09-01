import type { RoomSpec } from "./stages";

function course(field: RoomSpec, index: number): RoomSpec {
  const room = structuredClone(field) as RoomSpec;
  room.id = `map-${index}-course`;
  room.title = `${field.title} // COURSE`;
  room.lesson = "Same language, tighter read. Time Trial optimizes it; Challenge demands the clean route.";
  return room;
}

const S11: RoomSpec = {
  id: "sector-11-relay",
  title: "RELAY",
  lesson: "The next vector becomes useful before the current one ends. Stay airborne and keep reading.",
  grammar: ["airborne-chain", "moving-endpoint", "reorientation"],
  spawn: [0, 2.2, 14], goal: [0, 1.1, -92], requiredKills: 6,
  platforms: [
    { center: [0,0,12], size: [14,1,12] },
    { center: [10,2,-20], size: [7,1,7] },
    { center: [-10,4,-43], size: [7,1,7] },
    { center: [9,1,-66], size: [7,1,7] },
    { center: [0,0,-92], size: [13,1,11] }
  ],
  enemies: [
    { id: "relay-01", kind: "sentry", position: [0,9,-10] },
    { id: "relay-02", kind: "drifter", position: [7,9,-28], drift: { axis: "x", amplitude: 8, speed: .72 } },
    { id: "relay-03", kind: "sentry", position: [-10,7,-43] },
    { id: "relay-04", kind: "orbit", position: [0,8,-58], orbit: { plane: "xy", radiusA: 8, radiusB: 4, speed: .11, phase: .4 } },
    { id: "relay-05", kind: "sentry", position: [9,4,-66] },
    { id: "relay-06", kind: "sentry", position: [0,3,-94] }
  ]
};

const S12: RoomSpec = {
  id: "sector-12-gates",
  title: "GATES",
  lesson: "Cube controls world state. Prism controls aperture. Solve the shared safe region, then spend the Sphere.",
  grammar: ["stop-short", "origin-matters", "reorientation", "moving-endpoint"],
  spawn: [0,2.2,14], goal: [0,1.1,-96], requiredKills: 5,
  platforms: [
    { center: [0,0,12], size: [14,1,12] },
    { center: [-10,1,-20], size: [8,1,8] },
    { center: [10,3,-48], size: [8,1,8] },
    { center: [-8,2,-72], size: [8,1,8] },
    { center: [0,0,-96], size: [13,1,11] }
  ],
  enemies: [
    { id: "gates-cube", kind: "cube", position: [4,3,3], effect: { type: "disable-hazard", targetIds: ["gates-entry"] } },
    { id: "gates-01", kind: "sentry", position: [-10,4,-20] },
    { id: "gates-02", kind: "shield", position: [10,6,-48], originConstraint: { axis: "x", max: -2, rejectMessage: "ORIGIN REJECT // CHANGE SIDE" } },
    { id: "gates-prism", kind: "prism", position: [5,7,-56], effect: { type: "shift-aperture", targetIds: ["gates-aperture"], offset: 12 } },
    { id: "gates-03", kind: "drifter", position: [0,7,-67], drift: { axis: "x", amplitude: 9, speed: .78 } },
    { id: "gates-04", kind: "sentry", position: [-8,5,-72] },
    { id: "gates-05", kind: "sentry", position: [0,3,-98] }
  ],
  hazards: [
    { id: "gates-entry", kind: "sightline-gate", center: [0,4,-5], size: [15,8,.45], cycle: { period: 999, openFor: .05, phase: 1 } },
    { id: "gates-aperture", kind: "aperture-wall", center: [0,5,-61], size: [24,11,.5], aperture: { axis: "x", center: -7, span: 4 } }
  ]
};

const S13: RoomSpec = {
  id: "sector-13-fork",
  title: "FORK",
  lesson: "Every Sphere is valid. The clean route is defined by the Spheres you leave alive.",
  grammar: ["route-fork", "stop-short", "reorientation"],
  spawn: [0,2.2,14], goal: [0,1.1,-92], requiredKills: 3,
  platforms: [
    { center: [0,0,12], size: [14,1,12] },
    { center: [-12,1,-22], size: [7,1,7] },
    { center: [12,3,-27], size: [7,1,7] },
    { center: [0,1,-52], size: [9,1,8] },
    { center: [0,0,-92], size: [13,1,11] }
  ],
  enemies: [
    { id: "fork-left", kind: "sentry", position: [-12,4,-22] },
    { id: "fork-right", kind: "sentry", position: [12,6,-27] },
    { id: "fork-center", kind: "orbit", position: [0,7,-40], orbit: { plane: "xz", radiusA: 9, radiusB: 6, speed: .09 } },
    { id: "fork-cut", kind: "sentry", position: [0,4,-52] },
    { id: "fork-safe", kind: "sentry", position: [-12,5,-69] },
    { id: "fork-final", kind: "sentry", position: [0,3,-94] }
  ]
};

const S14: RoomSpec = {
  id: "sector-14-refraction",
  title: "REFRACTION",
  lesson: "Prism moves the opening. The opening is not the route until your firing angle makes it one.",
  grammar: ["route-fork", "reorientation", "moving-endpoint", "stop-short"],
  spawn: [-7,2.2,14], goal: [7,1.1,-98], requiredKills: 5,
  platforms: [
    { center: [-7,0,12], size: [12,1,12] },
    { center: [9,2,-20], size: [7,1,7] },
    { center: [-9,2,-43], size: [7,1,7] },
    { center: [9,2,-69], size: [7,1,7] },
    { center: [7,0,-98], size: [12,1,11] }
  ],
  enemies: [
    { id: "refract-01", kind: "sentry", position: [9,5,-20] },
    { id: "refract-02", kind: "orbit", position: [0,8,-38], orbit: { plane: "xy", radiusA: 10, radiusB: 4, speed: .1, phase: .6 } },
    { id: "refract-prism", kind: "prism", position: [-8,6,-48], effect: { type: "shift-aperture", targetIds: ["refract-wall"], offset: 14 } },
    { id: "refract-03", kind: "shield", position: [9,5,-69], originConstraint: { axis: "x", max: -1 } },
    { id: "refract-secret", kind: "sentry", position: [-14,10,-77] },
    { id: "refract-final", kind: "sentry", position: [7,3,-100] }
  ],
  hazards: [
    { id: "refract-wall", kind: "aperture-wall", center: [0,5,-57], size: [25,11,.5], aperture: { axis: "x", center: -8, span: 3.5 } },
    { id: "refract-sweep", kind: "sweep", center: [0,4,-80], size: [.55,9,24], drift: { axis: "x", amplitude: 17, speed: .2 } }
  ]
};

const S15: RoomSpec = {
  id: "sector-15-machinery",
  title: "MACHINERY",
  lesson: "Cube changes access. Diamond wakes motion. Prism reroutes energy. Read all three before the first Sphere.",
  grammar: ["moving-endpoint", "origin-matters", "reorientation", "route-fork"],
  spawn: [0,2.2,14], goal: [0,1.1,-108], requiredKills: 5,
  platforms: [
    { center: [0,0,12], size: [14,1,12] },
    { id: "machinery-lift", center: [-10,-4,-25], size: [8,1,8], motion: { axis: "y", amplitude: 8, speed: .08, active: false } },
    { center: [10,4,-49], size: [8,1,8] },
    { center: [-10,2,-78], size: [8,1,8] },
    { center: [0,0,-108], size: [13,1,11] }
  ],
  enemies: [
    { id: "machinery-cube", kind: "cube", position: [4,3,3], effect: { type: "disable-hazard", targetIds: ["machinery-gate"] } },
    { id: "machinery-diamond", kind: "diamond", position: [-4,4,-10], effect: { type: "activate-platform", targetIds: ["machinery-lift"] } },
    { id: "machinery-01", kind: "drifter", position: [0,7,-25], drift: { axis: "x", amplitude: 10, speed: .66 } },
    { id: "machinery-02", kind: "shield", position: [10,7,-49], originConstraint: { axis: "x", max: -2 } },
    { id: "machinery-prism", kind: "prism", position: [6,8,-58], effect: { type: "shift-aperture", targetIds: ["machinery-aperture"], offset: 13 } },
    { id: "machinery-03", kind: "orbit", position: [0,9,-70], orbit: { plane: "yz", radiusA: 6, radiusB: 5, speed: .1 } },
    { id: "machinery-04", kind: "sentry", position: [-10,5,-78] },
    { id: "machinery-05", kind: "sentry", position: [0,3,-110] }
  ],
  hazards: [
    { id: "machinery-gate", kind: "sightline-gate", center: [0,4,-4], size: [15,8,.45], cycle: { period: 999, openFor: .05, phase: 1 } },
    { id: "machinery-aperture", kind: "aperture-wall", center: [0,5,-65], size: [24,11,.5], aperture: { axis: "x", center: -7, span: 3.5 } },
    { id: "machinery-sweep", kind: "sweep", center: [0,5,-88], size: [.55,10,25], drift: { axis: "x", amplitude: 18, speed: .21 } }
  ]
};

const S16: RoomSpec = {
  id: "sector-16-composition",
  title: "COMPOSITION",
  lesson: "Act II exam. Shapes alter the machine. Spheres alone alter your position.",
  grammar: ["stop-short", "airborne-chain", "moving-endpoint", "reorientation"],
  spawn: [0,2.2,16], goal: [0,1.1,-126], requiredKills: 7,
  platforms: [
    { center: [0,0,14], size: [15,1,13] },
    { id: "composition-lift", center: [-12,-4,-25], size: [8,1,8], motion: { axis: "y", amplitude: 9, speed: .085, active: false } },
    { center: [12,4,-51], size: [8,1,8] },
    { center: [-10,2,-82], size: [8,1,8] },
    { center: [10,3,-104], size: [8,1,8] },
    { center: [0,0,-126], size: [14,1,11] }
  ],
  enemies: [
    { id: "composition-cube", kind: "cube", position: [4,3,4], effect: { type: "disable-hazard", targetIds: ["composition-gate"] } },
    { id: "composition-diamond", kind: "diamond", position: [-4,4,-9], effect: { type: "activate-platform", targetIds: ["composition-lift"] } },
    { id: "composition-01", kind: "drifter", position: [0,8,-22], drift: { axis: "x", amplitude: 11, speed: .72 } },
    { id: "composition-02", kind: "sentry", position: [-12,7,-25] },
    { id: "composition-03", kind: "shield", position: [12,7,-51], originConstraint: { axis: "x", max: -3 } },
    { id: "composition-prism", kind: "prism", position: [7,8,-59], effect: { type: "shift-aperture", targetIds: ["composition-aperture"], offset: 14 } },
    { id: "composition-04", kind: "orbit", position: [0,10,-74], orbit: { plane: "xy", radiusA: 9, radiusB: 4, speed: .11 } },
    { id: "composition-05", kind: "sentry", position: [-10,5,-82] },
    { id: "composition-06", kind: "drifter", position: [10,7,-104], drift: { axis: "y", amplitude: 3, speed: .8 } },
    { id: "composition-07", kind: "sentry", position: [0,3,-128] }
  ],
  hazards: [
    { id: "composition-gate", kind: "sightline-gate", center: [0,4,-4], size: [16,8,.45], cycle: { period: 999, openFor: .05, phase: 1 } },
    { id: "composition-sweep", kind: "sweep", center: [0,5,-62], size: [.6,10,28], drift: { axis: "x", amplitude: 19, speed: .23 } },
    { id: "composition-aperture", kind: "aperture-wall", center: [0,5,-94], size: [25,11,.5], aperture: { axis: "x", center: -8, span: 3.5 } }
  ]
};

export const MAPS_11_TO_16 = [S11,S12,S13,S14,S15,S16].map((field, i) => {
  const n = i + 11;
  return {
    id: `map-${n}`,
    label: `SECTOR ${String(n).padStart(2,"0")} // ${field.title}`,
    subtitle: field.lesson,
    focus: field.grammar,
    implemented: true,
    campaignRooms: [field],
    courseRooms: [course(field,n)]
  };
});