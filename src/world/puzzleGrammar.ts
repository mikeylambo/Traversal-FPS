export type PuzzleGrammarId =
  | "direct-anchor"
  | "stop-short"
  | "airborne-chain"
  | "origin-matters"
  | "route-fork"
  | "low-profile"
  | "moving-endpoint"
  | "reorientation";

export interface PuzzleGrammarEntry {
  id: PuzzleGrammarId;
  label: string;
  revelation: string;
  execution: "low" | "medium" | "high";
  combinesWith: PuzzleGrammarId[];
}

/**
 * Portal-method grammar: each entry teaches one new truth about the Warp Rifle,
 * then later maps combine already-understood truths rather than inventing new verbs.
 */
export const PUZZLE_GRAMMAR_V1: PuzzleGrammarEntry[] = [
  {
    id: "direct-anchor",
    label: "Direct Anchor",
    revelation: "A kill writes a traversable line from your firing origin to the death coordinate.",
    execution: "low",
    combinesWith: ["stop-short", "moving-endpoint", "route-fork"]
  },
  {
    id: "stop-short",
    label: "Stop Short",
    revelation: "The useful destination can be any point along the written line, not only the enemy endpoint.",
    execution: "low",
    combinesWith: ["airborne-chain", "moving-endpoint", "reorientation"]
  },
  {
    id: "airborne-chain",
    label: "Airborne Chain",
    revelation: "Warp can create an airborne firing state that exposes the next target before gravity takes over.",
    execution: "medium",
    combinesWith: ["stop-short", "moving-endpoint", "reorientation"]
  },
  {
    id: "origin-matters",
    label: "Origin Matters",
    revelation: "Where you stand when you fire is half of the vector, so positioning before the kill changes the route.",
    execution: "low",
    combinesWith: ["low-profile", "route-fork", "reorientation"]
  },
  {
    id: "route-fork",
    label: "Route Fork",
    revelation: "Multiple kills may work, but the cleanest sequence uses fewer vectors, shots, or detours.",
    execution: "medium",
    combinesWith: ["moving-endpoint", "origin-matters", "reorientation"]
  },
  {
    id: "low-profile",
    label: "Low Profile",
    revelation: "Crouch changes your body, eye height, and firing origin without competing with Warp for displacement.",
    execution: "low",
    combinesWith: ["origin-matters", "moving-endpoint", "reorientation"]
  },
  {
    id: "moving-endpoint",
    label: "Moving Endpoint",
    revelation: "A moving target is a moving destination; kill timing determines where the vector points.",
    execution: "medium",
    combinesWith: ["stop-short", "route-fork", "airborne-chain"]
  },
  {
    id: "reorientation",
    label: "Reorientation",
    revelation: "A warp destination can be valuable mainly because it gives you a new line of sight or firing angle.",
    execution: "medium",
    combinesWith: ["airborne-chain", "origin-matters", "low-profile"]
  }
];
