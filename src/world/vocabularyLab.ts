import type { RoomSpec } from "./stages";

/**
 * v0.12 actor proving ground. These rooms are intentionally isolated from
 * Campaign so experimental vocabulary can be kept, changed, or deleted without
 * rewriting authored sectors.
 */
export const VOCABULARY_LAB_ROOMS: RoomSpec[] = [
  {
    id: "vocab-orbit",
    title: "ORBIT",
    lesson: "The endpoint circles a locus. Kill it when the landing cue reaches the right platform.",
    grammar: ["moving-endpoint"],
    spawn: [0, 2.2, 8],
    goal: [7, 1.1, -25],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 7], size: [12, 1, 12] },
      { center: [7, 0, -25], size: [7, 1, 8] }
    ],
    enemies: [
      {
        id: "vocab-orbit-a",
        kind: "orbit",
        position: [0, 2.2, -25],
        orbit: { plane: "xz", radius: 7, speed: 0.72 }
      }
    ]
  },
  {
    id: "vocab-phase",
    title: "PHASE",
    lesson: "Ghosted means closed. Fire while the core is solid, then Stop Short onto the platform.",
    grammar: ["stop-short"],
    spawn: [0, 2.2, 8],
    goal: [0, 1.1, -22],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 7], size: [12, 1, 12] },
      { center: [0, 0, -22], size: [9, 1, 9] }
    ],
    enemies: [
      {
        id: "vocab-phase-a",
        kind: "phase",
        position: [0, 2.2, -35],
        phase: { period: 3, openFor: 1.15, phase: 0.35 }
      }
    ]
  }
];
