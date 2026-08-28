export type Vec3Tuple = [number, number, number];
export type EnemyKind = "sentry" | "drifter" | "shield";

export interface PlatformSpec {
  center: Vec3Tuple;
  size: Vec3Tuple;
}

export interface EnemySpec {
  id: string;
  kind: EnemyKind;
  position: Vec3Tuple;
  drift?: { axis: "x" | "y"; amplitude: number; speed: number };
}

export interface RoomSpec {
  id: string;
  title: string;
  lesson: string;
  spawn: Vec3Tuple;
  goal: Vec3Tuple;
  requiredKills: number;
  platforms: PlatformSpec[];
  enemies: EnemySpec[];
}

export const ROOMS: RoomSpec[] = [
  {
    id: "room-01",
    title: "WRITE THE LINE",
    lesson: "Kill the sphere. Hold RMB, then release to spend its vector.",
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
    lesson: "The second sphere is occluded from below. Warp high, reacquire it in the air, then chain.",
    spawn: [0, 2.2, 6],
    goal: [8, 1.1, -33],
    requiredKills: 2,
    platforms: [
      { center: [0, 0, 5], size: [10, 1, 10] },
      { center: [4, 3, -18], size: [20, 6, 1] },
      { center: [8, 0, -31], size: [10, 1, 10] }
    ],
    enemies: [
      { id: "r3-high", kind: "sentry", position: [0, 7, -11] },
      { id: "r3-far", kind: "sentry", position: [8, 6, -28] }
    ]
  },
  {
    id: "room-04",
    title: "ORIGIN MATTERS",
    lesson: "The shield rejects frontal shots. Move right before the kill so the written vector starts there.",
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
      { id: "r5-final", kind: "drifter", position: [0, 4, -36], drift: { axis: "y", amplitude: 3, speed: 1.4 } }
    ]
  }
];
