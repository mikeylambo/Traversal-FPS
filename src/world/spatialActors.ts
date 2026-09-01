export type OriginAxis = "x" | "y" | "z";

export interface OriginConstraint {
  axis: OriginAxis;
  min?: number;
  max?: number;
  rejectMessage?: string;
}

export type SpatialActorSchemaId =
  | "sentry"
  | "drifter"
  | "shield"
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
    spatialRole: "Fixed vector endpoint",
    capabilities: ["sphere", "fixed-position", "vector-endpoint"]
  },
  {
    id: "drifter",
    label: "Sphere // Drift",
    implemented: true,
    spatialRole: "Moving vector endpoint",
    capabilities: ["sphere", "moving-position", "vector-endpoint", "timing-window"]
  },
  {
    id: "shield",
    label: "Sphere // Origin Gate",
    implemented: true,
    spatialRole: "Origin-gated vector endpoint",
    capabilities: ["sphere", "fixed-position", "vector-endpoint", "origin-gate"],
    defaultOriginConstraint: {
      axis: "x",
      min: 2.5,
      rejectMessage: "SPHERE REJECT // CHANGE YOUR FIRING ORIGIN"
    }
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

export function evaluateActorOrigin(
  kind: string,
  authored: OriginConstraint | undefined,
  origin: readonly [number, number, number]
): { allowed: boolean; message?: string } {
  const constraint = resolveOriginConstraint(kind, authored);
  if (!constraint) return { allowed: true };

  const axisIndex = constraint.axis === "x" ? 0 : constraint.axis === "y" ? 1 : 2;
  const value = origin[axisIndex];
  const belowMin = constraint.min !== undefined && value < constraint.min;
  const aboveMax = constraint.max !== undefined && value > constraint.max;
  if (!belowMin && !aboveMax) return { allowed: true };

  return {
    allowed: false,
    message: constraint.rejectMessage ?? "TARGET REJECT // CHANGE YOUR FIRING ORIGIN"
  };
}
