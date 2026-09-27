export type OriginAxis = "x" | "y" | "z";

/** The Sphere answers only shots fired from one side of a world-axis plane. */
export interface AxisOriginConstraint {
  axis: OriginAxis;
  min?: number;
  max?: number;
  rejectMessage?: string;
}

/**
 * The Sphere answers only shots fired from within `within` metres of its live
 * centre. Drawn as a mace whose spikes fold away once you are close enough, so
 * "get closer" reads from the silhouette before any text does.
 */
export interface ProximityConstraint {
  within: number;
  rejectMessage?: string;
}

export type OriginConstraint = AxisOriginConstraint | ProximityConstraint;

export function isProximity(constraint: OriginConstraint): constraint is ProximityConstraint {
  return "within" in constraint;
}

type Tuple3 = readonly [number, number, number];

/** What stands between the player and a valid shot: which way to move, and how far. */
export interface OriginGuidance {
  kind: "axis" | "proximity";
  axis?: OriginAxis;
  /** Unit world-space direction that leads into the firing zone. */
  move: [number, number, number];
  /** Metres still to cover in that direction. */
  distance: number;
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
    id: "shield",
    label: "Sphere // Origin Gate",
    implemented: true,
    spatialRole: "Origin-gated warp endpoint",
    capabilities: ["sphere", "fixed-position", "vector-endpoint", "origin-gate"],
    defaultOriginConstraint: {
      axis: "x",
      min: 2.5,
      rejectMessage: "FIRE FROM THE RIGHT SIDE"
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

/**
 * `at` is the Sphere's live centre (drifters and orbits move), which proximity
 * gates measure against; axis gates ignore it.
 */
export function evaluateActorOrigin(
  kind: string,
  authored: OriginConstraint | undefined,
  origin: Tuple3,
  at: Tuple3
): { allowed: boolean; message?: string } {
  const constraint = resolveOriginConstraint(kind, authored);
  if (!constraint) return { allowed: true };

  if (isProximity(constraint)) {
    const d = Math.hypot(origin[0] - at[0], origin[1] - at[1], origin[2] - at[2]);
    return d <= constraint.within ? { allowed: true } : { allowed: false, message: "GET CLOSER" };
  }

  const axisIndex = constraint.axis === "x" ? 0 : constraint.axis === "y" ? 1 : 2;
  const value = origin[axisIndex];
  const belowMin = constraint.min !== undefined && value < constraint.min;
  const aboveMax = constraint.max !== undefined && value > constraint.max;
  if (!belowMin && !aboveMax) return { allowed: true };

  // Prefer a concrete direction over implementation language such as
  // "origin reject". These hints map directly to what the player should do next.
  return {
    allowed: false,
    message: directionalOriginHint(constraint, belowMin, aboveMax)
  };
}

export function originGuidance(
  kind: string,
  authored: OriginConstraint | undefined,
  origin: Tuple3,
  at: Tuple3
): OriginGuidance | null {
  const constraint = resolveOriginConstraint(kind, authored);
  if (!constraint || evaluateActorOrigin(kind, authored, origin, at).allowed) return null;
  if (isProximity(constraint)) {
    const d: [number, number, number] = [at[0] - origin[0], at[1] - origin[1], at[2] - origin[2]];
    const length = Math.hypot(d[0], d[1], d[2]) || 1;
    return { kind: "proximity", move: [d[0] / length, d[1] / length, d[2] / length], distance: length - constraint.within };
  }
  const index = constraint.axis === "x" ? 0 : constraint.axis === "y" ? 1 : 2;
  const value = origin[index];
  const up = constraint.min !== undefined && value < constraint.min;
  const target = up ? constraint.min! : constraint.max!;
  const move: [number, number, number] = [0, 0, 0];
  move[index] = up ? 1 : -1;
  return { kind: "axis", axis: constraint.axis, move, distance: Math.abs(target - value) };
}

function directionalOriginHint(
  constraint: AxisOriginConstraint,
  belowMin: boolean,
  aboveMax: boolean
): string {
  if (constraint.axis === "x") {
    if (belowMin) return "FIRE FROM THE RIGHT SIDE";
    if (aboveMax) return "FIRE FROM THE LEFT SIDE";
  }
  if (constraint.axis === "y") {
    // Relative to where the player stands, not the Sphere: the threshold can sit
    // below the target, so "above" read as "over the Sphere" and misled players.
    if (belowMin) return "FIRE FROM HIGHER UP";
    if (aboveMax) return "FIRE FROM LOWER DOWN";
  }
  if (constraint.axis === "z") {
    if (belowMin) return "FIRE FROM FURTHER BACK";
    if (aboveMax) return "FIRE FROM FURTHER AHEAD";
  }
  return constraint.rejectMessage ?? "FIRE FROM ANOTHER SIDE";
}
