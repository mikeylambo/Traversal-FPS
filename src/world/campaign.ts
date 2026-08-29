import type { RoomSpec } from "./stages";

export interface CampaignMapDefinition {
  id: string;
  label: string;
  subtitle: string;
  focus: string[];
  implemented: boolean;
  rooms: RoomSpec[];
}

const MAP_01_ROOMS: RoomSpec[] = [
  {
    id: "map-01-01",
    title: "VECTOR ENTRY",
    lesson: "Campaign rules now. Write one clean vector and place the landing before the target.",
    grammar: ["direct-anchor", "stop-short"],
    spawn: [0, 2.2, 7],
    goal: [0, 1.1, -15],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 5], size: [12, 1, 11] },
      { center: [0, 0, -15], size: [9, 1, 7] }
    ],
    enemies: [{ id: "m1-1-anchor", kind: "sentry", position: [0, 2.2, -25] }]
  },
  {
    id: "map-01-02",
    title: "LOW LINE",
    lesson: "Use the low channel to change the shot you can take. Crouch is positioning; Warp is traversal.",
    grammar: ["low-profile", "origin-matters"],
    spawn: [-4.5, 2.2, 7],
    goal: [6, 1.1, -22],
    requiredKills: 1,
    platforms: [
      { center: [-4.5, 0, 5], size: [9, 1, 11] },
      { center: [0, 2.28, -2], size: [7.5, 0.78, 5] },
      { center: [-4.05, 1.45, -2], size: [0.7, 2.9, 5] },
      { center: [4.05, 1.45, -2], size: [0.7, 2.9, 5] },
      { center: [2.8, 2.4, -11], size: [1.2, 4.8, 8] },
      { center: [6, 0, -22], size: [9, 1, 9] }
    ],
    enemies: [{ id: "m1-2-low", kind: "sentry", position: [6, 2.2, -20] }]
  },
  {
    id: "map-01-03",
    title: "SIDE SOLUTION",
    lesson: "The first kill is useful because of where it lets you aim next. Reorient, then write the exit vector.",
    grammar: ["reorientation", "origin-matters", "airborne-chain"],
    spawn: [-7, 2.2, 6],
    goal: [8, 1.1, -31],
    requiredKills: 2,
    platforms: [
      { center: [-7, 0, 5], size: [10, 1, 10] },
      { center: [0, 3.2, -12], size: [15, 6.4, 1] },
      { center: [8, 2, -8], size: [5, 1, 5] },
      { center: [8, 0, -30], size: [10, 1, 10] }
    ],
    enemies: [
      { id: "m1-3-perch", kind: "sentry", position: [8, 4.2, -8] },
      { id: "m1-3-exit", kind: "sentry", position: [8, 4.5, -25], radius: 0.92 }
    ]
  },
  {
    id: "map-01-04",
    title: "DRIFT CUT",
    lesson: "Wait for the destination you want, then cut the vector short onto the landing.",
    grammar: ["moving-endpoint", "stop-short"],
    spawn: [0, 2.2, 7],
    goal: [8, 1.1, -20],
    requiredKills: 1,
    platforms: [
      { center: [0, 0, 6], size: [10, 1, 10] },
      { center: [8, 0, -20], size: [6, 1, 9] }
    ],
    enemies: [
      { id: "m1-4-drift", kind: "drifter", position: [0, 2.2, -29], drift: { axis: "x", amplitude: 13, speed: 0.78 } }
    ]
  },
  {
    id: "map-01-05",
    title: "CLEAN VECTOR",
    lesson: "There are several workable anchors. Find the clean two-kill route and commit to it.",
    grammar: ["route-fork", "stop-short", "reorientation"],
    spawn: [0, 2.2, 8],
    goal: [0, 1.1, -43],
    requiredKills: 2,
    platforms: [
      { center: [0, 0, 7], size: [14, 1, 12] },
      { center: [-9, 1.4, -12], size: [7, 1, 7] },
      { center: [8, 2.5, -24], size: [7, 1, 7] },
      { center: [0, 0, -41], size: [14, 1, 12] },
      { center: [0, 3.1, -17], size: [7, 6.2, 1] }
    ],
    enemies: [
      { id: "m1-5-left", kind: "sentry", position: [-9, 4.1, -12] },
      { id: "m1-5-drift", kind: "drifter", position: [0, 7, -23], drift: { axis: "x", amplitude: 8, speed: 1.02 } },
      { id: "m1-5-right", kind: "sentry", position: [8, 5.2, -24] },
      { id: "m1-5-final", kind: "sentry", position: [0, 3.1, -37] }
    ]
  }
];

export const CAMPAIGN_MAPS: CampaignMapDefinition[] = [
  {
    id: "map-01",
    label: "MAP 01 // VECTOR FOUNDATIONS",
    subtitle: "The grammar stops being a lesson and starts becoming a route.",
    focus: ["Direct Anchor", "Stop Short", "Low Profile", "Origin", "Reorientation", "Route Choice"],
    implemented: true,
    rooms: MAP_01_ROOMS
  },
  {
    id: "map-02",
    label: "MAP 02 // TIMING FIELD",
    subtitle: "Moving endpoints, sightline timing, and the first lethal world hazards.",
    focus: ["Moving Endpoint", "Timed Sightlines", "Timed Release"],
    implemented: false,
    rooms: []
  },
  {
    id: "map-03",
    label: "MAP 03 // OCCLUSION",
    subtitle: "Positioning and reorientation become the puzzle before the trigger is pulled.",
    focus: ["Origin", "Reorientation", "Shielding", "Low Profile"],
    implemented: false,
    rooms: []
  },
  {
    id: "map-04",
    label: "MAP 04 // CLEAN GEOMETRY",
    subtitle: "Several routes work. Only a few are elegant.",
    focus: ["Route Fork", "Efficiency", "Constraint Play"],
    implemented: false,
    rooms: []
  },
  {
    id: "map-05",
    label: "MAP 05 // TERMINAL VECTOR",
    subtitle: "The full traversal language under pressure.",
    focus: ["Synthesis", "Long Chains", "Mastery"],
    implemented: false,
    rooms: []
  }
];
