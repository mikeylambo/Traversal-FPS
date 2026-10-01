/**
 * The Sphere answers only shots fired from within `within` metres of its live
 * centre. Drawn as a mace whose spikes fold away once you are close enough, so
 * "get closer" reads from the silhouette before any text does.
 */
export interface ProximityConstraint {
  within: number;
}

/** The only firing-position rule left; "which side" is now alcove geometry. */
export type OriginConstraint = ProximityConstraint;

type Tuple3 = readonly [number, number, number];

export type SpatialActorSchemaId =
  | "sentry"
  | "drifter"
  | "orbit"
  | "cube"
  | "diamond"
  | "prism"
  | "phase"
  | "linked-pair";

export interface SpatialActorDefinition {
  id: SpatialActorSchemaId;
  label: string;
  implemented: boolean;
  spatialRole: string;
  capabilities: readonly string[];
  defaultOriginConstraint?: OriginConstraint;
}

/**
 * Sphere-family actors are the only vector endpoints. Utility geometry changes the
 * world but never writes Warp Rifle movement. Silhouette and motion carry meaning;
 * color remains presentation, never the sole semantic channel.
 */
export const SPATIAL_ACTORS: readonly SpatialActorDefinition[] = [
  {
    id: "sentry",
    label: "Sphere // Fixed",
    implemented: true,
    spatialRole: "Fixed warp endpoint",
    capabilities: ["sphere", "fixed-position", "vector-endpoint"]
  },
  {
    id: "drifter",
    label: "Sphere // Drift",
    implemented: true,
    spatialRole: "Moving warp endpoint",
    capabilities: ["sphere", "moving-position", "vector-endpoint", "timing-window"]
  },
  {
    id: "orbit",
    label: "Sphere // Orbit",
    implemented: true,
    spatialRole: "Endpoint moving around a locus",
    capabilities: ["sphere", "moving-position", "vector-endpoint", "cyclic-route", "arrival-angle"]
  },
  {
    id: "cube",
    label: "Cube",
    implemented: true,
    spatialRole: "World-state switch",
    capabilities: ["utility", "hazard-control", "no-vector"]
  },
  {
    id: "diamond",
    label: "Diamond",
    implemented: true,
    spatialRole: "Motion activator",
    capabilities: ["utility", "platform-control", "no-vector"]
  },
  {
    id: "prism",
    label: "Prism",
    implemented: true,
    spatialRole: "Energy-path router",
    capabilities: ["utility", "field-routing", "no-vector"]
  },
  {
    id: "phase",
    label: "Phase",
    implemented: false,
    spatialRole: "Periodically targetable endpoint",
    capabilities: ["planned", "sphere", "target-window", "vector-endpoint"]
  },
  {
    id: "linked-pair",
    label: "Linked Pair",
    implemented: false,
    spatialRole: "Two endpoints whose state changes together",
    capabilities: ["planned", "sphere", "linked-state", "route-choice"]
  }
] as const;

export function spatialActorDefinition(kind: string): SpatialActorDefinition | undefined {
  return SPATIAL_ACTORS.find((entry) => entry.id === kind);
}

export function resolveOriginConstraint(
  kind: string,
  authored?: OriginConstraint
): OriginConstraint | undefined {
  return authored ?? spatialActorDefinition(kind)?.defaultOriginConstraint;
}

/**
 * `at` is the Sphere's live centre (drifters and orbits move): a proximity gate
 * measures from it.
 */
export function evaluateActorOrigin(
  kind: string,
  authored: OriginConstraint | undefined,
  origin: Tuple3,
  at: Tuple3
): { allowed: boolean } {
  const constraint = resolveOriginConstraint(kind, authored);
  if (!constraint) return { allowed: true };
  const d = Math.hypot(origin[0] - at[0], origin[1] - at[1], origin[2] - at[2]);
  return { allowed: d <= constraint.within };
}
