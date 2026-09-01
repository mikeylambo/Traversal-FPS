import { spatialActorDefinition } from "./spatialActors";
import type { EnemySpec, HazardSpec, PlatformSpec, RoomSpec, Vec3Tuple } from "./stages";

export type ValidationSeverity = "error" | "warning";

export interface ContentValidationIssue {
  severity: ValidationSeverity;
  code: string;
  roomId: string;
  message: string;
  entityId?: string;
}

export interface VectorLandingCandidate {
  platformIndex: number;
  fraction: number;
  point: Vec3Tuple;
}

export interface RoomValidationReport {
  roomId: string;
  issues: ContentValidationIssue[];
  errors: number;
  warnings: number;
}

const PLAYER_EYE_HEIGHT = 1.7;
const LANDING_EDGE_INSET = 0.12;
const LANDING_VERTICAL_CUSHION = 0.72;
const MIN_WARP_FRACTION = 0.12;

export function validateRoom(room: RoomSpec): RoomValidationReport {
  const issues: ContentValidationIssue[] = [];
  const push = (
    severity: ValidationSeverity,
    code: string,
    message: string,
    entityId?: string
  ) => issues.push({ severity, code, roomId: room.id || "<missing>", message, entityId });

  if (!room.id?.trim()) push("error", "room.id", "Room id is required.");
  if (!room.title?.trim()) push("error", "room.title", "Room title is required.");
  if (!Array.isArray(room.platforms) || room.platforms.length === 0) {
    push("error", "room.platforms", "Room needs at least one platform.");
  }
  if (!Array.isArray(room.enemies)) push("error", "room.enemies", "Room actors must be an array.");
  if (!isFiniteVec3(room.spawn)) push("error", "room.spawn", "Spawn must contain three finite numbers.");
  if (!isFiniteVec3(room.goal)) push("error", "room.goal", "Goal must contain three finite numbers.");
  if (!Number.isInteger(room.requiredKills) || room.requiredKills < 0) {
    push("error", "room.requiredKills", "requiredKills must be a non-negative integer.");
  }

  const vectorEndpoints = room.enemies.filter(isVectorEndpoint).length;
  if (room.requiredKills > vectorEndpoints) {
    push(
      "error",
      "room.requiredKills.capacity",
      `requiredKills (${room.requiredKills}) exceeds Sphere/vector-endpoint count (${vectorEndpoints}).`
    );
  }

  room.platforms.forEach((platform, index) => validatePlatform(platform, index, push));

  const ids = new Set<string>();
  for (const enemy of room.enemies) {
    validateEnemy(enemy, push);
    if (ids.has(enemy.id)) push("error", "entity.id.duplicate", `Duplicate entity id: ${enemy.id}`, enemy.id);
    ids.add(enemy.id);
  }
  for (const hazard of room.hazards ?? []) {
    validateHazard(hazard, push);
    if (ids.has(hazard.id)) push("error", "entity.id.duplicate", `Duplicate entity id: ${hazard.id}`, hazard.id);
    ids.add(hazard.id);
  }

  if (isFiniteVec3(room.spawn) && !pointHasStandingSurface(room.spawn, room.platforms, 0.82)) {
    push("warning", "geometry.spawn-support", "Spawn has no obvious standing surface beneath it.");
  }
  if (isFiniteVec3(room.goal) && !goalHasSurface(room.goal, room.platforms)) {
    push("warning", "geometry.goal-support", "Gravity Ring has no obvious platform beneath its X/Z position.");
  }

  for (const enemy of room.enemies) {
    if (!isVectorEndpoint(enemy)) continue;
    if (!isFiniteVec3(enemy.position) || room.platforms.length === 0) continue;
    if (pointHasStandingSurface(enemy.position, room.platforms)) continue;

    const options = obviousLandingOptions(room, enemy);
    if (options > 0) continue;

    push(
      "warning",
      enemy.kind === "drifter" ? "geometry.moving-endpoint" : "geometry.vector-landing",
      enemy.kind === "drifter"
        ? "Moving Sphere base position has no obvious safe landing. Verify its drift path intentionally crosses a landing surface."
        : "Sphere has no obvious full-endpoint or Stop Short landing from spawn/platform-center origins.",
      enemy.id
    );
  }

  return {
    roomId: room.id,
    issues,
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length
  };
}

export function validateRoomCatalog(label: string, rooms: readonly RoomSpec[]): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  const roomIds = new Set<string>();
  for (const room of rooms) {
    if (roomIds.has(room.id)) {
      issues.push({
        severity: "error",
        code: "room.id.duplicate",
        roomId: room.id,
        message: `Duplicate room id in ${label}: ${room.id}`
      });
    }
    roomIds.add(room.id);
    issues.push(...validateRoom(room).issues);
  }
  return issues;
}

/**
 * Finds places along a written vector where the camera can settle onto platform tops.
 * The result uses the same eye-height model as gameplay and intentionally ignores the
 * first 12% of a vector, matching the Warp Rifle's minimum selectable fraction.
 */
export function analyzeVectorLandings(
  origin: Vec3Tuple,
  target: Vec3Tuple,
  platforms: readonly PlatformSpec[]
): VectorLandingCandidate[] {
  if (!isFiniteVec3(origin) || !isFiniteVec3(target)) return [];
  const candidates: VectorLandingCandidate[] = [];
  const originPlatforms = new Set<number>();

  platforms.forEach((platform, index) => {
    if (pointHasStandingSurface(origin, [platform])) originPlatforms.add(index);
  });

  platforms.forEach((platform, platformIndex) => {
    if (originPlatforms.has(platformIndex)) return;
    const top = platform.center[1] + platform.size[1] * 0.5;
    const standingY = top + PLAYER_EYE_HEIGHT;
    const dy = target[1] - origin[1];
    let fraction: number | null = null;

    if (Math.abs(dy) > 0.0001) {
      const t = (standingY - origin[1]) / dy;
      if (t >= MIN_WARP_FRACTION && t <= 1) fraction = t;
    } else if (Math.abs(origin[1] - standingY) <= LANDING_VERTICAL_CUSHION) {
      fraction = segmentRectEntryFraction(origin, target, platform);
    }

    if (fraction === null || fraction < MIN_WARP_FRACTION || fraction > 1) return;
    const point = lerpVec3(origin, target, fraction);
    if (!insidePlatformFootprint(point, platform, LANDING_EDGE_INSET)) return;
    candidates.push({ platformIndex, fraction, point });
  });

  return candidates.sort((a, b) => a.fraction - b.fraction);
}

export function pointHasStandingSurface(
  point: Vec3Tuple,
  platforms: readonly PlatformSpec[],
  verticalCushion = LANDING_VERTICAL_CUSHION
): boolean {
  return platforms.some((platform) => {
    const standingY = platform.center[1] + platform.size[1] * 0.5 + PLAYER_EYE_HEIGHT;
    return Math.abs(point[1] - standingY) <= verticalCushion &&
      insidePlatformFootprint(point, platform, LANDING_EDGE_INSET);
  });
}

function obviousLandingOptions(room: RoomSpec, enemy: EnemySpec): number {
  const origins: Vec3Tuple[] = [room.spawn];
  for (const platform of room.platforms) {
    origins.push([
      platform.center[0],
      platform.center[1] + platform.size[1] * 0.5 + PLAYER_EYE_HEIGHT,
      platform.center[2]
    ]);
  }
  return origins.reduce(
    (count, origin) => count + analyzeVectorLandings(origin, enemy.position, room.platforms).length,
    0
  );
}

function validatePlatform(
  platform: PlatformSpec,
  index: number,
  push: (severity: ValidationSeverity, code: string, message: string, entityId?: string) => void
): void {
  if (!isFiniteVec3(platform.center)) push("error", "platform.center", `Platform ${index + 1} center is invalid.`);
  if (!isFiniteVec3(platform.size) || platform.size.some((value) => value <= 0)) {
    push("error", "platform.size", `Platform ${index + 1} size must contain positive finite values.`);
  }
  if (platform.motion) {
    const motion = platform.motion;
    if (!(["x", "y", "z"] as const).includes(motion.axis)) {
      push("error", "platform.motion.axis", `Platform ${index + 1} motion axis must be x, y, or z.`, platform.id);
    }
    if (!Number.isFinite(motion.amplitude) || motion.amplitude < 0 ||
      !Number.isFinite(motion.speed) || motion.speed <= 0) {
      push("error", "platform.motion.values", `Platform ${index + 1} motion amplitude/speed are invalid.`, platform.id);
    }
    if (!platform.id?.trim()) {
      push("warning", "platform.motion.id", `Moving platform ${index + 1} has no id and cannot be targeted by a Diamond.`);
    }
  }
}

function validateEnemy(
  enemy: EnemySpec,
  push: (severity: ValidationSeverity, code: string, message: string, entityId?: string) => void
): void {
  if (!enemy.id?.trim()) push("error", "enemy.id", "Actor id is required.");
  if (!isFiniteVec3(enemy.position)) push("error", "enemy.position", "Actor position is invalid.", enemy.id);
  if (enemy.radius !== undefined && (!Number.isFinite(enemy.radius) || enemy.radius <= 0)) {
    push("error", "enemy.radius", "Actor radius must be positive.", enemy.id);
  }

  const actor = spatialActorDefinition(enemy.kind);
  if (!actor || !actor.implemented) {
    push("error", "enemy.kind", `Unsupported spatial actor kind: ${String(enemy.kind)}`, enemy.id);
  }

  if (enemy.kind === "drifter") {
    if (!enemy.drift) {
      push("error", "enemy.drift", "Drifter requires drift settings.", enemy.id);
    } else if (!Number.isFinite(enemy.drift.amplitude) || enemy.drift.amplitude < 0 ||
      !Number.isFinite(enemy.drift.speed) || enemy.drift.speed <= 0) {
      push("error", "enemy.drift.values", "Drifter amplitude/speed are invalid.", enemy.id);
    }
  }

  if (enemy.kind === "orbit") {
    if (!enemy.orbit) {
      push("error", "enemy.orbit", "Orbit actor requires orbit settings.", enemy.id);
    } else if (
      !Number.isFinite(enemy.orbit.radiusA) || enemy.orbit.radiusA <= 0 ||
      !Number.isFinite(enemy.orbit.radiusB) || enemy.orbit.radiusB <= 0 ||
      !Number.isFinite(enemy.orbit.speed) || enemy.orbit.speed <= 0
    ) {
      push("error", "enemy.orbit.values", "Orbit radii and speed must be positive.", enemy.id);
    }
  }

  if (["cube", "diamond", "prism"].includes(enemy.kind)) {
    if (!enemy.effect) {
      push("error", "enemy.utility.effect", `${enemy.kind} requires a puzzle effect.`, enemy.id);
    } else if (!Array.isArray(enemy.effect.targetIds) || enemy.effect.targetIds.length === 0) {
      push("error", "enemy.utility.targets", `${enemy.kind} effect requires at least one target id.`, enemy.id);
    }
  }

  if (enemy.originConstraint) {
    const constraint = enemy.originConstraint;
    if (!(["x", "y", "z"] as const).includes(constraint.axis)) {
      push("error", "enemy.origin.axis", "Origin constraint axis must be x, y, or z.", enemy.id);
    }
    if (constraint.min === undefined && constraint.max === undefined) {
      push("error", "enemy.origin.range", "Origin constraint requires min and/or max.", enemy.id);
    }
    if (constraint.min !== undefined && !Number.isFinite(constraint.min)) {
      push("error", "enemy.origin.min", "Origin constraint min must be finite.", enemy.id);
    }
    if (constraint.max !== undefined && !Number.isFinite(constraint.max)) {
      push("error", "enemy.origin.max", "Origin constraint max must be finite.", enemy.id);
    }
    if (
      constraint.min !== undefined &&
      constraint.max !== undefined &&
      constraint.min > constraint.max
    ) {
      push("error", "enemy.origin.order", "Origin constraint min cannot exceed max.", enemy.id);
    }
  }
}

function validateHazard(
  hazard: HazardSpec,
  push: (severity: ValidationSeverity, code: string, message: string, entityId?: string) => void
): void {
  if (!hazard.id?.trim()) push("error", "hazard.id", "Hazard id is required.");
  if (!isFiniteVec3(hazard.center)) push("error", "hazard.center", "Hazard center is invalid.", hazard.id);
  if (!isFiniteVec3(hazard.size) || hazard.size.some((value) => value <= 0)) {
    push("error", "hazard.size", "Hazard size must contain positive finite values.", hazard.id);
  }
  if (hazard.kind === "sweep" && !hazard.drift) {
    push("error", "hazard.sweep.drift", "Sweep hazard requires drift settings.", hazard.id);
  }
  if (hazard.drift && (
    !Number.isFinite(hazard.drift.amplitude) || hazard.drift.amplitude < 0 ||
    !Number.isFinite(hazard.drift.speed) || hazard.drift.speed <= 0
  )) {
    push("error", "hazard.drift.values", "Hazard drift amplitude/speed are invalid.", hazard.id);
  }
  if (hazard.kind === "sightline-gate") {
    if (!hazard.cycle) {
      push("error", "hazard.gate.cycle", "Sightline gate requires cycle settings.", hazard.id);
    } else if (
      !Number.isFinite(hazard.cycle.period) || hazard.cycle.period <= 0 ||
      !Number.isFinite(hazard.cycle.openFor) || hazard.cycle.openFor <= 0 ||
      hazard.cycle.openFor >= hazard.cycle.period
    ) {
      push("error", "hazard.gate.cycle-values", "Sightline gate cycle must satisfy 0 < openFor < period.", hazard.id);
    }
  }
  if (hazard.kind === "aperture-wall") {
    if (!hazard.aperture) {
      push("error", "hazard.aperture", "Aperture wall requires a safe aperture definition.", hazard.id);
    } else if (!Number.isFinite(hazard.aperture.center) ||
      !Number.isFinite(hazard.aperture.span) || hazard.aperture.span <= 0) {
      push("error", "hazard.aperture.values", "Aperture center/span are invalid.", hazard.id);
    }
  }
}

function isVectorEndpoint(enemy: EnemySpec): boolean {
  return Boolean(spatialActorDefinition(enemy.kind)?.capabilities.includes("vector-endpoint"));
}

function goalHasSurface(goal: Vec3Tuple, platforms: readonly PlatformSpec[]): boolean {
  return platforms.some((platform) => insidePlatformFootprint(goal, platform, 0));
}

function insidePlatformFootprint(point: Vec3Tuple, platform: PlatformSpec, inset: number): boolean {
  const halfX = Math.max(0.02, platform.size[0] * 0.5 - inset);
  const halfZ = Math.max(0.02, platform.size[2] * 0.5 - inset);
  return Math.abs(point[0] - platform.center[0]) <= halfX &&
    Math.abs(point[2] - platform.center[2]) <= halfZ;
}

function segmentRectEntryFraction(origin: Vec3Tuple, target: Vec3Tuple, platform: PlatformSpec): number | null {
  const minX = platform.center[0] - platform.size[0] * 0.5 + LANDING_EDGE_INSET;
  const maxX = platform.center[0] + platform.size[0] * 0.5 - LANDING_EDGE_INSET;
  const minZ = platform.center[2] - platform.size[2] * 0.5 + LANDING_EDGE_INSET;
  const maxZ = platform.center[2] + platform.size[2] * 0.5 - LANDING_EDGE_INSET;
  let t0 = MIN_WARP_FRACTION;
  let t1 = 1;
  const dx = target[0] - origin[0];
  const dz = target[2] - origin[2];

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 0.000001) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  if (!clip(-dx, origin[0] - minX)) return null;
  if (!clip(dx, maxX - origin[0])) return null;
  if (!clip(-dz, origin[2] - minZ)) return null;
  if (!clip(dz, maxZ - origin[2])) return null;
  return t0 <= t1 ? t0 : null;
}

function lerpVec3(a: Vec3Tuple, b: Vec3Tuple, t: number): Vec3Tuple {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function isFiniteVec3(value: unknown): value is Vec3Tuple {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}
