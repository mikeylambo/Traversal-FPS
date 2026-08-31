import type { PuzzleGrammarId } from "./puzzleGrammar";
import type { OriginConstraint } from "./spatialActors";

export type Vec3Tuple = [number, number, number];
export type EnemyKind = "sentry" | "drifter" | "shield" | "orbit" | "phase";
export type HazardKind = "lethal-field" | "sweep" | "sightline-gate";

export interface PlatformSpec {
  center: Vec3Tuple;
  size: Vec3Tuple;
}

export interface EnemySpec {
  id: string;
  kind: EnemyKind;
  position: Vec3Tuple;
  radius?: number;
  drift?: { axis: "x" | "y"; amplitude: number; speed: number };
  orbit?: { plane: "xy" | "xz"; radius: number; speed: number; phase?: number };
  phase?: { period: number; openFor: number; phase?: number };
  originConstraint?: OriginConstraint;
}

export interface HazardSpec {
  id: string;
  kind: HazardKind;
  center: Vec3Tuple;
  size: Vec3Tuple;
  drift?: { axis: "x" | "y" | "z"; amplitude: number; speed: number; phase?: number };
  cycle?: { period: number; openFor: number; phase?: number };
}

export interface RoomSpec {
  id: string;
  title: string;
  lesson: string;
  grammar: PuzzleGrammarId[];
  spawn: Vec3Tuple;
  goal: Vec3Tuple;
  requiredKills: number;
  platforms: PlatformSpec[];
  enemies: EnemySpec[];
  hazards?: HazardSpec[];
}

export const ROOMS: RoomSpec[] = [
  {
    id: "room-01",
    title: "WRITE THE LINE",
    lesson: "Kill the sphere. Hold RMB, then release to spend its vector.",
    grammar: ["direct-anchor"],
    spawn: [0, 2.2, 6],
    goal: [0, 1.1, -24],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 5], size: [12, 1, 10] },
      { center: [0, 0, -22], size: [12, 1, 10] }
    ],
    enemies: [{ id: "r1-sentry", kind: "sentry", position: [0, 2.2, -19] }]
  },
  {
    id: "room-02",
    title: "STOP SHORT",
    lesson: "The sphere is beyond the landing. Hold RMB + wheel, then release before 100%.",
    grammar: ["stop-short"],
    spawn: [0, 2.2, 6],
    goal: [0, 1.1, -16],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 5], size: [10, 1, 10] },
      { center: [0, 0, -16], size: [8, 1, 7] }
    ],
    enemies: [{ id: "r2-sentry", kind: "sentry", position: [0, 2.2, -28] }]
  },
  {
    id: "room-03",
    title: "CHAIN",
    lesson: "The wall hides target two from the floor. Warp high, use the brief phase hang to reacquire, then fire again.",
    grammar: ["airborne-chain"],
    spawn: [0, 2.2, 6],
    goal: [8, 1.1, -33],
    requiredKills: 2,
    platforms: [
      { center: [0, 0, 5], size: [10, 1, 10] },
      { center: [3, 2.75, -18], size: [18, 5.5, 1] },
      { center: [8, 0, -31], size: [10, 1, 10] }
    ],
    enemies: [
      { id: "r3-high", kind: "sentry", position: [0, 7.5, -11] },
      { id: "r3-far", kind: "sentry", position: [8, 4.2, -31], radius: 0.96 }
    ]
  },
  {
    id: "room-04",
    title: "ORIGIN MATTERS",
    lesson: "The shield rejects frontal shots. Move right before the kill so the written vector starts there.",
    grammar: ["origin-matters"],
    spawn: [-5, 2.2, 6],
    goal: [7, 1.1, -28],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 5], size: [18, 1, 11] },
      { center: [7, 0, -25], size: [9, 1, 11] }
    ],
    enemies: [{ id: "r4-shield", kind: "shield", position: [5, 2.2, -21] }]
  },
  {
    id: "room-05",
    title: "FIND THE FASTER ROUTE",
    lesson: "Reach the exit with at least two kills. Extra kills may help — but they lower route efficiency.",
    grammar: ["route-fork"],
    spawn: [0, 2.2, 8],
    goal: [0, 1.1, -43],
    requiredKills: 2,
    platforms: [
      { center: [0, 0, 7], size: [14, 1, 12] },
      { center: [-8, 1.5, -12], size: [8, 1, 8] },
      { center: [9, 3, -25], size: [8, 1, 8] },
      { center: [0, 0, -41], size: [14, 1, 12] }
    ],
    enemies: [
      { id: "r5-left", kind: "sentry", position: [-8, 4.2, -12] },
      { id: "r5-drift", kind: "drifter", position: [0, 7, -22], drift: { axis: "x", amplitude: 7, speed: 1.15 } },
      { id: "r5-right", kind: "sentry", position: [9, 5.7, -25] },
      { id: "r5-final", kind: "drifter", position: [0, 4, -36], drift: { axis: "y", amplitude: 2.5, speed: 1.4 } }
    ]
  },
  {
    id: "room-06",
    title: "LOW PROFILE",
    lesson: "There is no jump. Hold Ctrl or C to lower your body, pass under the structure, then write the vector from the low route.",
    grammar: ["low-profile", "origin-matters"],
    spawn: [0, 2.2, 8],
    goal: [0, 1.1, -20],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 4], size: [10, 1, 14] },
      { center: [0, 2.3, -1], size: [6, 0.8, 4] },
      { center: [-3.35, 1.4, -1], size: [0.7, 2.8, 4] },
      { center: [3.35, 1.4, -1], size: [0.7, 2.8, 4] },
      { center: [0, 0, -18], size: [10, 1, 9] }
    ],
    enemies: [{ id: "r6-low", kind: "sentry", position: [0, 2.2, -18] }]
  },
  {
    id: "room-07",
    title: "MOVING ENDPOINT",
    lesson: "The target is the destination. Time the kill when its coordinate passes over the landing zone.",
    grammar: ["moving-endpoint"],
    spawn: [0, 2.2, 7],
    goal: [8, 1.1, -20],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 6], size: [10, 1, 10] },
      { center: [8, 0, -20], size: [5, 1, 8] }
    ],
    enemies: [
      { id: "r7-drift", kind: "drifter", position: [0, 2.2, -20], drift: { axis: "x", amplitude: 12, speed: 0.82 } }
    ]
  },
  {
    id: "room-08",
    title: "REORIENT",
    lesson: "The first vector is valuable for the angle it gives you. Reach the side perch, then use the new line of sight to write the second.",
    grammar: ["reorientation", "airborne-chain"],
    spawn: [-6, 2.2, 6],
    goal: [8, 1.1, -30],
    requiredKills: 2,
    platforms: [
      { center: [-6, 0, 5], size: [10, 1, 10] },
      { center: [0, 3, -12], size: [14, 6, 1] },
      { center: [8, 2, -8], size: [5, 1, 5] },
      { center: [8, 0, -30], size: [10, 1, 10] }
    ],
    enemies: [
      { id: "r8-perch", kind: "sentry", position: [8, 4.2, -8] },
      { id: "r8-behind", kind: "sentry", position: [8, 4.2, -30], radius: 0.9 }
    ]
  }
];
