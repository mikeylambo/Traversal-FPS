import type { RoomSpec } from "./stages";

export const SPATIAL_ACTOR_TRAINING: RoomSpec[] = [
  {
    id: "training-cube",
    title: "CUBE // STATE",
    lesson: "Cubes alter geometry state. Shoot the Cube, then use the Sphere that its new state exposes.",
    grammar: ["origin-matters", "reorientation"],
    spawn: [0, 2.2, 7],
    goal: [0, 1.1, -27],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 5], size: [11, 1, 10] },
      { id: "training-cube-wall", group: "training-cube-state", center: [0, 4, -8], size: [9, 8, 1] },
      { center: [0, 0, -25], size: [11, 1, 10] }
    ],
    enemies: [{ id: "training-cube-sphere", kind: "sentry", position: [0, 3, -24] }],
    actors: [{ id: "training-cube-device", kind: "cube", position: [-3.8, 3.1, -1], targetGroup: "training-cube-state", moveOffset: [11, 0, 0] }]
  },
  {
    id: "training-diamond",
    title: "DIAMOND // MOTION",
    lesson: "Diamonds move geometry. The moving platform is solid throughout its travel; use its new position to establish the next vector.",
    grammar: ["moving-endpoint", "stop-short"],
    spawn: [0, 2.2, 7],
    goal: [9, 1.1, -31],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 5], size: [11, 1, 10] },
      { id: "training-diamond-platform", group: "training-diamond-motion", center: [-9, 0, -13], size: [7, 1, 7] },
      { center: [9, 0, -30], size: [10, 1, 10] }
    ],
    enemies: [{ id: "training-diamond-sphere", kind: "sentry", position: [9, 3, -30] }],
    actors: [{ id: "training-diamond-device", kind: "diamond", position: [3.8, 3.1, -1], targetGroup: "training-diamond-motion", moveOffset: [18, 2, -5], moveDuration: 1.25 }]
  },
  {
    id: "training-prism",
    title: "PRISM // ENERGY",
    lesson: "Prisms reroute energy. They never move you; they make a Sphere route readable and usable.",
    grammar: ["reorientation", "timing-chain"],
    spawn: [0, 2.2, 7],
    goal: [0, 1.1, -32],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 5], size: [11, 1, 10] },
      { center: [0, 0, -30], size: [11, 1, 10] }
    ],
    enemies: [{ id: "training-prism-sphere", kind: "sentry", position: [0, 3, -30] }],
    hazards: [{ id: "training-prism-gate", group: "training-prism-energy", kind: "sightline-gate", center: [0, 4, -15], size: [12, 8, 1], cycle: { period: 6, openFor: .2 } }],
    actors: [{ id: "training-prism-device", kind: "prism", position: [-3.5, 3.2, -2], targetGroup: "training-prism-energy" }]
  },
  {
    id: "training-spatial-sentence",
    title: "SHAPES // SENTENCE",
    lesson: "Cube changes state. Diamond changes motion. Prism changes energy. Sphere changes your position. Gravity Ring ends the sector.",
    grammar: ["stop-short", "moving-endpoint", "reorientation", "airborne-chain"],
    spawn: [0, 2.2, 8],
    goal: [0, 1.1, -56],
    requiredKills: 2,
    platforms: [
      { center: [0, 0, 6], size: [12, 1, 11] },
      { id: "training-sentence-platform", group: "sentence-motion", center: [-8, 0, -19], size: [7, 1, 7] },
      { id: "training-sentence-wall", group: "sentence-state", center: [0, 4, -31], size: [1, 8, 15] },
      { center: [0, 0, -54], size: [12, 1, 11] }
    ],
    enemies: [
      { id: "training-sentence-a", kind: "sentry", position: [8, 6, -23] },
      { id: "training-sentence-b", kind: "sentry", position: [0, 3, -56] }
    ],
    hazards: [{ id: "training-sentence-energy", group: "sentence-energy", kind: "sightline-gate", center: [0, 4, -43], size: [16, 8, 1], cycle: { period: 6, openFor: .2 } }],
    actors: [
      { id: "training-sentence-diamond", kind: "diamond", position: [3.7, 3.1, -2], targetGroup: "sentence-motion", moveOffset: [16, 3, -4], moveDuration: 1.1 },
      { id: "training-sentence-cube", kind: "cube", position: [8, 6.3, -23], targetGroup: "sentence-state", moveOffset: [11, 0, 0] },
      { id: "training-sentence-prism", kind: "prism", position: [-8, 5.2, -38], targetGroup: "sentence-energy" }
    ]
  }
];