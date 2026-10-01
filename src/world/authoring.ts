import type { EnemySpec, HazardSpec, HoodSide, PlatformSpec, PuzzleEffect, RoomSpec, Vec3Tuple } from "./stages";
import type { ProximityConstraint } from "./spatialActors";

/** A Sphere's firing rule: a reach (mace) or the side its alcove opens to. */
export type Gate = ProximityConstraint | HoodSide;

const gate = (value?: Gate): Partial<EnemySpec> =>
  value === undefined ? {} : typeof value === "string" ? { hood: value } : { originConstraint: value };

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

/**
 * A Sphere that fits a crawl lane: centred 0.8m above the floor (inside the
 * crouched-arrival snap window) with a 0.45 radius so it clears a 1.3m roof.
 */
export function crouchSentry(id: string, x: number, top: number, z: number, rule?: Gate): EnemySpec {
  return sentry(id, [x, top + 0.8, z], 0.45, rule);
}

export function sentry(id: string, position: Vec3Tuple, radius?: number, rule?: Gate): EnemySpec {
  return { id, kind: "sentry", position, ...(radius ? { radius } : {}), ...gate(rule) };
}

export function drifter(id: string, position: Vec3Tuple, axis: "x" | "y", amplitude: number, speed: number): EnemySpec {
  return { id, kind: "drifter", position, drift: { axis, amplitude, speed } };
}

export function orbit(id: string, position: Vec3Tuple, plane: "xy" | "xz" | "yz", radiusA: number, radiusB: number, speed: number, phase = 0): EnemySpec {
  return { id, kind: "orbit", position, orbit: { plane, radiusA, radiusB, speed, phase } };
}

/** A Sphere in an alcove that opens toward `side`. */
export function hooded(id: string, position: Vec3Tuple, side: HoodSide): EnemySpec {
  return { id, kind: "sentry", position, hood: side };
}

/** A firing rule on any actor: a reach, or an alcove side. */
export function gated(enemy: EnemySpec, rule: Gate): EnemySpec {
  return { ...enemy, ...gate(rule) };
}

const HOOD_HALF = 1.25;
const HOOD_WALL = 0.3;
// Deeper than a Sphere radius (0.72), so no part of it peeks past the mouth.
const HOOD_MOUTH = 0.95;
const HOOD_BACK = 1.15;

/**
 * Builds the alcove for every hooded actor: a shell of walls around it, open on
 * one side, with the actor fully inside the mouth so it reads at a glance and is
 * hittable only through the opening. A side alcove over a floor uses that floor
 * (you can walk out of the mouth after warping in); otherwise it gets its own
 * sill. Idempotent, so rooms can pass through it more than once.
 */
export function withHoods(room: RoomSpec): RoomSpec {
  const hooded = (room.enemies ?? []).filter((enemy) => enemy.hood);
  if (!hooded.length || !Array.isArray(room.platforms) || room.platforms.some((p) => p.id?.startsWith("hood:"))) return room;
  const extra: PlatformSpec[] = [];
  for (const enemy of hooded) extra.push(...hoodShell(enemy, enemy.hood!, room.platforms));
  return { ...room, platforms: [...room.platforms, ...extra] };
}

function hoodShell(enemy: EnemySpec, side: HoodSide, platforms: PlatformSpec[]): PlatformSpec[] {
  const c = enemy.position;
  const a = side[1] === "x" ? 0 : side[1] === "y" ? 1 : 2;
  const sign = side[0] === "+" ? 1 : -1;
  const h = HOOD_HALF, t = HOOD_WALL;
  // Extents per axis as [min, max]; the open axis runs from behind the back wall to the mouth.
  const along: [number, number] = sign > 0 ? [c[a] - HOOD_BACK - t, c[a] + HOOD_MOUTH] : [c[a] - HOOD_MOUTH, c[a] + HOOD_BACK + t];
  const box = (ext: [number, number][], n: number): PlatformSpec => ({
    id: `hood:${enemy.id}:${n}`,
    center: [(ext[0]![0] + ext[0]![1]) / 2, (ext[1]![0] + ext[1]![1]) / 2, (ext[2]![0] + ext[2]![1]) / 2],
    size: [ext[0]![1] - ext[0]![0], ext[1]![1] - ext[1]![0], ext[2]![1] - ext[2]![0]]
  });
  const span = (axis: number, inner = h): [number, number] => [c[axis]! - inner - t, c[axis]! + inner + t];
  const out: PlatformSpec[] = [];
  const set = (axis: number, value: [number, number], ext: [number, number][]) => { ext[axis] = value; return ext; };
  const backFace: [number, number] = sign > 0 ? [along[0], along[0] + t] : [along[1] - t, along[1]];

  if (a === 1) {
    // Cup (open up) or canopy (open down): four walls, and the closed end.
    const xs = span(0), zs = span(2);
    out.push(box(set(1, backFace, [xs, [0, 0], zs]), 0));
    out.push(box([[xs[0], xs[0] + t], along, zs], 1), box([[xs[1] - t, xs[1]], along, zs], 2));
    out.push(box([[xs[0] + t, xs[1] - t], along, [zs[0], zs[0] + t]], 3), box([[xs[0] + t, xs[1] - t], along, [zs[1] - t, zs[1]]], 4));
    return out;
  }

  // Side alcove: back wall, two cheeks, roof, and a sill unless a floor is already under it.
  const q = a === 0 ? 2 : 0;
  const under = platforms.find((p) => {
    const top = p.center[1] + p.size[1] / 2;
    return !p.motion && top <= c[1] - 0.4 && top >= c[1] - 2.4 &&
      Math.abs(c[0] - p.center[0]) <= p.size[0] / 2 && Math.abs(c[2] - p.center[2]) <= p.size[2] / 2;
  });
  const bottom = under ? under.center[1] + under.size[1] / 2 : c[1] - h;
  const ys: [number, number] = [bottom, c[1] + h];
  const qs = span(q);
  const ext = (alongAxis: [number, number], yRange: [number, number], qRange: [number, number]): [number, number][] => {
    const e: [number, number][] = [[0, 0], yRange, [0, 0]];
    e[a] = alongAxis;
    e[q] = qRange;
    return e;
  };
  out.push(box(ext(backFace, ys, [qs[0] + t, qs[1] - t]), 0));
  out.push(box(ext(along, ys, [qs[0], qs[0] + t]), 1), box(ext(along, ys, [qs[1] - t, qs[1]]), 2));
  out.push(box(ext(along, [ys[1], ys[1] + t], qs), 3));
  if (!under) out.push(box(ext(along, [ys[0] - t, ys[0]], qs), 4));
  return out;
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

/**
 * An enterable structure in open space: floor, walls, roof and one doorway.
 * Put a Gravity Ring inside and the goal platform only sees out through the
 * door, so "reach the end, then shoot everything" needs the right doorway line.
 * Walls sit outside the floor footprint; `door` names the open side.
 */
export function sanctum(
  x: number, top: number, z: number, w: number, d: number,
  door: "n" | "s" | "e" | "w" | "top", doorWidth = 2.4, height = 3.4, wall = 0.6
): PlatformSpec[] {
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  // Walls run down through the floor slab so no sightline slips under them at the seam.
  const y0 = top - 1, y1 = top + height, doorTop = top + Math.min(height - 0.4, 2.6);
  const out: PlatformSpec[] = [floor(x, top, z, w, d)];
  const side = (s: "n" | "s" | "e" | "w") => {
    const alongX = s === "n" || s === "s";
    const fixed0 = s === "n" ? z0 - wall : s === "s" ? z1 : s === "w" ? x0 - wall : x1;
    const fixed1 = fixed0 + wall;
    const a0 = alongX ? x0 - wall : z0, a1 = alongX ? x1 + wall : z1;
    const box = (b0: number, b1: number, h0: number, h1: number) => alongX
      ? solid(b0, b1, h0, h1, fixed0, fixed1)
      : solid(fixed0, fixed1, h0, h1, b0, b1);
    if (s !== door) return [box(a0, a1, y0, y1)];
    const mid = alongX ? x : z;
    return [
      box(a0, mid - doorWidth / 2, y0, y1),
      box(mid + doorWidth / 2, a1, y0, y1),
      box(mid - doorWidth / 2, mid + doorWidth / 2, doorTop, y1),
      // Sill below the door: flush with the floor so you can walk out.
      box(mid - doorWidth / 2, mid + doorWidth / 2, y0, top)
    ];
  };
  out.push(...side("n"), ...side("s"), ...side("e"), ...side("w"));
  // "top" is a skylight: the roof has a square hole over the middle.
  if (door === "top") out.push(...slabWithHole(x0 - wall, x1 + wall, z0 - wall, z1 + wall, y1 + wall, x - doorWidth / 2, x + doorWidth / 2, z - doorWidth / 2, z + doorWidth / 2, wall));
  else out.push(solid(x0 - wall, x1 + wall, y1, y1 + wall, z0 - wall, z1 + wall));
  return out;
}
