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
 * Actor vocabulary is data first. Only the first three actor kinds are runtime
 * enabled today; planned entries reserve their spatial role without making them
 * legal RoomSpec content before their behavior is play-tested.
 */
export const SPATIAL_ACTORS: readonly SpatialActorDefinition[] = [
  {
    id: "sentry",
    label: "Sentry",
    implemented: true,
    spatialRole: "Fixed endpoint",
    capabilities: ["fixed-position", "vector-endpoint"]
  },
  {
    id: "drifter",
    label: "Drifter",
    implemented: true,
    spatialRole: "Moving endpoint",
    capabilities: ["moving-position", "vector-endpoint", "timing-window"]
  },
  {
    id: "shield",
    label: "Shield",
    implemented: true,
    spatialRole: "Origin-gated endpoint",
    capabilities: ["fixed-position", "vector-endpoint", "origin-gate"],
    defaultOriginConstraint: {
      axis: "x",
      min: 2.5,
      rejectMessage: "SHIELD REJECT // CHANGE YOUR FIRING ORIGIN"
    }
  },
  {
    id: "orbit",
    label: "Orbit",
    implemented: true,
    spatialRole: "Endpoint moving around a locus",
    capabilities: ["moving-position", "vector-endpoint", "cyclic-route", "arrival-angle"]
  },
  {
    id: "phase",
    label: "Phase",
    implemented: false,
    spatialRole: "Periodically targetable endpoint",
    capabilities: ["planned", "target-window", "vector-endpoint"]
  },
  {
    id: "linked-pair",
    label: "Linked Pair",
    implemented: false,
    spatialRole: "Two endpoints whose state changes together",
    capabilities: ["planned", "linked-state", "route-choice"]
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
