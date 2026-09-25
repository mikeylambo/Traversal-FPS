import type { EnemySpec, HazardSpec, PlatformSpec, PuzzleEffect, Vec3Tuple } from "./stages";
import type { OriginConstraint } from "./spatialActors";

/**
 * Authoring vocabulary for hand-built rooms. Everything is expressed relative to
 * a floor's top surface so landings, crouch lanes and slits stay exact:
 *   standing eye = top + 1.7, crouched eye = top + 1.06, body (crouched) = 1.22.
 */

export const STAND = 1.7;
export const CROUCH = 1.06;

/** Walkable floor slab by centre and top height. */
export function floor(x: number, top: number, z: number, w: number, d: number, thickness = 1, id?: string): PlatformSpec {
  return { ...(id ? { id } : {}), center: [x, top - thickness / 2, z], size: [w, thickness, d] };
}

/** Any solid box by extents; walls, pillars, cores. */
export function solid(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): PlatformSpec {
  return { center: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], size: [x1 - x0, y1 - y0, z1 - z0] };
}

/** Low ceiling over a floor: crouch fits (1.22), standing (1.86) does not. */
export function crawl(x0: number, x1: number, z0: number, z1: number, floorTop: number, thickness = 0.6): PlatformSpec {
  return solid(x0, x1, floorTop + 1.3, floorTop + 1.3 + thickness, z0, z1);
}

/**
 * A wall across X (constant Z) with a horizontal firing slit that only a crouched
 * eye can use: solid below 0.8 (no step-over), open 0.8–1.35, solid above.
 */
export function slitWallX(x0: number, x1: number, z: number, floorTop: number, height: number, depth = 0.8): PlatformSpec[] {
  return [
    solid(x0, x1, floorTop, floorTop + 0.8, z - depth / 2, z + depth / 2),
    solid(x0, x1, floorTop + 1.35, floorTop + height, z - depth / 2, z + depth / 2)
  ];
}

/** Same as slitWallX but the wall runs along Z (constant X). */
export function slitWallZ(z0: number, z1: number, x: number, floorTop: number, height: number, depth = 0.8): PlatformSpec[] {
  return [
    solid(x - depth / 2, x + depth / 2, floorTop, floorTop + 0.8, z0, z1),
    solid(x - depth / 2, x + depth / 2, floorTop + 1.35, floorTop + height, z0, z1)
  ];
}

export function moving(platform: PlatformSpec, id: string, axis: "x" | "y" | "z", amplitude: number, speed: number, dormant = false, phase = 0): PlatformSpec {
  return { ...platform, id, motion: { axis, amplitude, speed, phase, ...(dormant ? { active: false } : {}) } };
}

/** Eye position standing on a floor top (spawns, standing-height Spheres). */
export const eye = (x: number, top: number, z: number): Vec3Tuple => [x, top + STAND, z];
/** Crouched eye position; a Sphere here lands a crouched (or standing) arrival. */
export const low = (x: number, top: number, z: number): Vec3Tuple => [x, top + CROUCH, z];
/** Gravity Ring resting on a floor top. */
export const ring = (x: number, top: number, z: number): Vec3Tuple => [x, top + 0.6, z];

export function sentry(id: string, position: Vec3Tuple, radius?: number, originConstraint?: OriginConstraint): EnemySpec {
  return { id, kind: "sentry", position, ...(radius ? { radius } : {}), ...(originConstraint ? { originConstraint } : {}) };
}

export function drifter(id: string, position: Vec3Tuple, axis: "x" | "y", amplitude: number, speed: number): EnemySpec {
  return { id, kind: "drifter", position, drift: { axis, amplitude, speed } };
}

export function orbit(id: string, position: Vec3Tuple, plane: "xy" | "xz" | "yz", radiusA: number, radiusB: number, speed: number, phase = 0): EnemySpec {
  return { id, kind: "orbit", position, orbit: { plane, radiusA, radiusB, speed, phase } };
}

export function shield(id: string, position: Vec3Tuple, constraint: OriginConstraint): EnemySpec {
  return { id, kind: "shield", position, originConstraint: constraint };
}

/** Origin gate on any Sphere, e.g. "fire from above" = { axis: "y", min }. */
export function gated(enemy: EnemySpec, constraint: OriginConstraint): EnemySpec {
  return { ...enemy, originConstraint: constraint };
}

function utility(kind: "cube" | "diamond" | "prism", id: string, position: Vec3Tuple, effect: PuzzleEffect): EnemySpec {
  return { id, kind, position, effect };
}

export const cube = (id: string, position: Vec3Tuple, targetIds: string[]) =>
  utility("cube", id, position, { type: "disable-hazard", targetIds });
export const diamond = (id: string, position: Vec3Tuple, targetIds: string[]) =>
  utility("diamond", id, position, { type: "activate-platform", targetIds });
export const prism = (id: string, position: Vec3Tuple, targetIds: string[], offset: number) =>
  utility("prism", id, position, { type: "shift-aperture", targetIds, offset });

/** A lethal volume by extents; optional cycle makes it pulse. */
export function field(id: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, cycle?: HazardSpec["cycle"]): HazardSpec {
  return { id, kind: "lethal-field", center: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], size: [x1 - x0, y1 - y0, z1 - z0], ...(cycle ? { cycle } : {}) };
}

/** A sightline gate that stays closed until a Cube disables it. */
export function lockedGate(id: string, x0: number, x1: number, y0: number, y1: number, z: number): HazardSpec {
  return { id, kind: "sightline-gate", center: [(x0 + x1) / 2, (y0 + y1) / 2, z], size: [x1 - x0, y1 - y0, 0.45], cycle: { period: 999, openFor: 0.05, phase: 1 } };
}

export function sweep(id: string, center: Vec3Tuple, size: Vec3Tuple, axis: "x" | "y" | "z", amplitude: number, speed: number, phase = 0): HazardSpec {
  return { id, kind: "sweep", center, size, drift: { axis, amplitude, speed, phase } };
}

/**
 * Lethal wall across X with a safe window a Prism can slide along X. The window's
 * vertical band is centred on the wall (±3.1m max), so a doorway you walk through
 * must extend ~2m below the floor or its band misses a walking body.
 */
export function apertureX(id: string, x0: number, x1: number, y0: number, y1: number, z: number, windowCenter: number, span: number): HazardSpec {
  return {
    id,
    kind: "aperture-wall",
    center: [(x0 + x1) / 2, (y0 + y1) / 2, z],
    size: [x1 - x0, y1 - y0, 0.5],
    aperture: { axis: "x", center: windowCenter, span }
  };
}

/** A storey slab with a rectangular hole, as up to four floors around it. */
export function slabWithHole(
  x0: number, x1: number, z0: number, z1: number, top: number,
  hx0: number, hx1: number, hz0: number, hz1: number, thickness = 1
): PlatformSpec[] {
  const out: PlatformSpec[] = [];
  const add = (a0: number, a1: number, b0: number, b1: number) => {
    if (a1 - a0 > 0.01 && b1 - b0 > 0.01) out.push(floor((a0 + a1) / 2, top, (b0 + b1) / 2, a1 - a0, b1 - b0, thickness));
  };
  add(x0, x1, z0, hz0);
  add(x0, x1, hz1, z1);
  add(x0, hx0, hz0, hz1);
  add(hx1, x1, hz0, hz1);
  return out;
}
