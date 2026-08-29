import type { RoomSpec } from "./stages";

/**
 * Dedicated controls onboarding. It is not part of Puzzle Grammar v1; once cleared,
 * the runtime swaps directly into the eight grammar rooms.
 */
export const CONTROLS_ROOM: RoomSpec = {
  id: "controls-00",
  title: "CONTROLS",
  lesson: "Learn the rig, then enter Training.",
  grammar: [],
  spawn: [0, 2.2, 7],
  goal: [0, 1.1, -16],
  requiredKills: 1,
  platforms: [
    { center: [0, 0, 5], size: [12, 1, 11] },
    { center: [0, 0, -16], size: [8, 1, 7] }
  ],
  enemies: [
    { id: "controls-anchor", kind: "sentry", position: [0, 2.2, -29] }
  ]
};
