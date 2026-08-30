import type { PuzzleGrammarId } from "./puzzleGrammar";

export type CleanGeometryRouteId = "left-clean" | "right-clean" | "safe-long" | "greedy";

export interface CleanGeometryRoute {
  id: CleanGeometryRouteId;
  label: string;
  kills: number;
  spheres: string[];
  intent: string;
}

export interface CleanGeometryBeat {
  id: string;
  title: string;
  question: string;
  grammar: PuzzleGrammarId[];
  parKills: number;
  notes: string[];
}

/**
 * Sector 04 is intentionally authored as route logic before coordinates.
 * The player already understands how to make vectors; CLEAN GEOMETRY asks whether
 * they can recognize which valid vectors are unnecessary.
 *
 * This file is not registered as playable RoomSpec data yet. It is a production
 * contract for the eventual campaign field/course authoring pass.
 */
export const CLEAN_GEOMETRY_BLUEPRINT = {
  id: "map-04",
  title: "CLEAN GEOMETRY",
  thesis: "Several routes work. Mastery is visible in the spheres you leave alive.",
  centralQuestion: "Which valid target should I deliberately ignore?",
  targetMinKills: 4,
  targetSphereCount: 8,
  grammar: [
    "route-fork",
    "stop-short",
    "origin-matters",
    "moving-endpoint",
    "reorientation",
    "low-profile"
  ] satisfies PuzzleGrammarId[],

  // Actor IDs are stable design names. Geometry should preserve these roles even
  // if coordinates move repeatedly during desktop playtesting.
  actors: {
    entry: "cg-entry",
    leftWindow: "cg-left-window",
    rightDrift: "cg-right-drift",
    centerSafe: "cg-center-safe",
    highAngle: "cg-high-angle",
    midCut: "cg-mid-cut",
    greedyPerch: "cg-greedy-perch",
    final: "cg-final"
  },

  routes: [
    {
      id: "left-clean",
      label: "LEFT CLEAN",
      kills: 4,
      spheres: ["cg-entry", "cg-left-window", "cg-mid-cut", "cg-final"],
      intent: "Low/origin read into a Stop Short cut. Fastest to understand, not necessarily fastest to execute."
    },
    {
      id: "right-clean",
      label: "RIGHT CLEAN",
      kills: 4,
      spheres: ["cg-entry", "cg-right-drift", "cg-high-angle", "cg-final"],
      intent: "Moving endpoint into reorientation. Cleaner mechanically, harder temporally."
    },
    {
      id: "safe-long",
      label: "SAFE LONG",
      kills: 5,
      spheres: ["cg-entry", "cg-center-safe", "cg-left-window", "cg-mid-cut", "cg-final"],
      intent: "Obvious, forgiving, fully valid route that spends one unnecessary sphere."
    },
    {
      id: "greedy",
      label: "GREEDY",
      kills: 6,
      spheres: ["cg-entry", "cg-center-safe", "cg-greedy-perch", "cg-high-angle", "cg-mid-cut", "cg-final"],
      intent: "Every target looks useful. The route works, but demonstrates failure to read efficiency."
    }
  ] satisfies CleanGeometryRoute[],

  campaignRules: [
    "The exit requires four resolved spheres, never an exact route.",
    "Every optional sphere must create a genuinely usable landing or sightline; no fake decoys.",
    "Extra spheres trade execution difficulty for route inefficiency rather than simply punishing curiosity.",
    "At least two four-kill routes must remain viable on Standard difficulty.",
    "No route may depend on emergency forward drift after Warp arrival.",
    "Stop Short should skip geometry, not merely correct a misplaced endpoint.",
    "Existing hazards may pressure route choice but must not turn the sector into waiting for cycles."
  ],

  secrets: [
    {
      id: "cg-secret-short",
      rule: "A narrow non-critical landing is reachable only through an intentional mid-vector Stop Short window.",
      rewardIntent: "Discovery/achievement hook; never required for the clean route."
    },
    {
      id: "cg-secret-alive",
      rule: "A landmark/space becomes reachable while leaving the most tempting optional sphere alive.",
      rewardIntent: "Reinforces the sector thesis through exploration rather than score text."
    }
  ],

  courseBeats: [
    {
      id: "map-04-01",
      title: "BYPASS",
      question: "Can you recognize a useful-looking sphere that costs an unnecessary kill?",
      grammar: ["route-fork", "stop-short"],
      parKills: 1,
      notes: [
        "Two visible spheres both solve the room.",
        "The one-sphere line crosses the exit platform; the second sphere only makes the landing easier."
      ]
    },
    {
      id: "map-04-02",
      title: "EQUIVALENT",
      question: "Can two routes be equally clean but demand different skills?",
      grammar: ["route-fork", "origin-matters", "moving-endpoint"],
      parKills: 2,
      notes: [
        "Left solution emphasizes origin/LOS.",
        "Right solution emphasizes moving-endpoint timing.",
        "Both remain two kills."
      ]
    },
    {
      id: "map-04-03",
      title: "CLEAN CUT",
      question: "Can Stop Short replace an entire intermediate target?",
      grammar: ["stop-short", "reorientation"],
      parKills: 2,
      notes: [
        "The obvious route is three kills.",
        "A deliberate landing percentage creates the angle for a two-kill solution."
      ]
    },
    {
      id: "map-04-04",
      title: "ROUTE PROOF",
      question: "Can you preserve efficiency when timing and occlusion compete for attention?",
      grammar: ["route-fork", "moving-endpoint", "origin-matters", "reorientation"],
      parKills: 3,
      notes: [
        "Uses existing sightline/sweep vocabulary only.",
        "Optional fourth sphere is a safe recovery route, not a trap."
      ]
    },
    {
      id: "map-04-05",
      title: "CLEAN GEOMETRY",
      question: "Can you read the whole route before spending the first vector?",
      grammar: ["route-fork", "stop-short", "origin-matters", "moving-endpoint", "reorientation"],
      parKills: 4,
      notes: [
        "Compact synthesis of the campaign field's route graph.",
        "At least two four-kill solutions and one forgiving five-kill solution.",
        "Do not introduce a new verb or hazard here."
      ]
    }
  ] satisfies CleanGeometryBeat[]
} as const;
