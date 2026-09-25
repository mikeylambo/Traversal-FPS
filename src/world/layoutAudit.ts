import { spatialActorDefinition } from "./spatialActors";
import type { PlatformSpec, RoomSpec } from "./stages";

/**
 * Layout-family audit. Describes each room by its spatial skeleton rather than its
 * actor list, then scores pairwise similarity so repetition can be caught at build
 * time instead of in a full playthrough.
 */

export type Skeleton =
  | "corridor" | "zig-zag" | "lateral" | "ascent" | "descent" | "hub"
  | "return" | "stacked" | "field";
export type GoalTopology = "far-end" | "beside-spawn" | "above" | "below" | "lateral" | "behind";
export type ActionClass = "RED" | "ORANGE" | "YELLOW" | "GREEN";

export interface LayoutDescriptor {
  id: string;
  title: string;
  skeleton: Skeleton;
  goal: GoalTopology;
  spanX: number;
  spanY: number;
  spanZ: number;
  floors: number;
  walls: number;
  lowCeilings: number;
  moving: number;
  spheres: number;
  required: number;
  fullClear: boolean;
  movingActors: number;
  originGated: number;
  utility: number;
  hazards: number;
  goalVisibleFromSpawn: boolean;
  grammar: string[];
  /** Normalised top-down floor occupancy (8x8) and side profile (8 bins). */
  plan: number[];
  profile: number[];
  geometryHash: string;
}

export interface SimilarityPair {
  a: string;
  b: string;
  score: number;
  identical: boolean;
}

const PLAN = 8;
const WALL_HEIGHT = 2.4;

export function describeLayout(room: RoomSpec): LayoutDescriptor {
  const floors = room.platforms.filter((p) => p.size[1] <= WALL_HEIGHT && p.size[0] * p.size[2] >= 3);
  const walls = room.platforms.filter((p) => p.size[1] > WALL_HEIGHT);
  const points = [room.spawn, room.goal, ...room.platforms.map((p) => p.center)];
  const xs = points.map((p) => p[0]);
  const ys = [room.spawn[1], room.goal[1], ...floors.map((p) => top(p) + 1.7)];
  const zs = points.map((p) => p[2]);
  const spanX = range(floors.flatMap((p) => [p.center[0] - p.size[0] / 2, p.center[0] + p.size[0] / 2]).concat(xs));
  const spanZ = range(floors.flatMap((p) => [p.center[2] - p.size[2] / 2, p.center[2] + p.size[2] / 2]).concat(zs));
  const spanY = range(ys);
  const spheres = room.enemies.filter((e) => spatialActorDefinition(e.kind)?.capabilities.includes("vector-endpoint"));

  const d = [room.goal[0] - room.spawn[0], room.goal[1] - room.spawn[1], room.goal[2] - room.spawn[2]];
  const horizontal = Math.hypot(d[0], d[2]);
  const goal: GoalTopology =
    Math.hypot(d[0], d[1], d[2]) < 9 ? "beside-spawn"
      : d[1] > Math.max(6, horizontal * 0.6) ? "above"
        : d[1] < -Math.max(6, horizontal * 0.6) ? "below"
          : d[2] > 6 ? "behind"
            : Math.abs(d[0]) > Math.abs(d[2]) ? "lateral" : "far-end";

  return {
    id: room.id,
    title: room.title,
    skeleton: classifySkeleton(room, floors, spanX, spanY, spanZ, goal),
    goal,
    spanX: round(spanX),
    spanY: round(spanY),
    spanZ: round(spanZ),
    floors: floors.length,
    walls: walls.length,
    lowCeilings: countLowCeilings(room.platforms),
    moving: room.platforms.filter((p) => p.motion).length,
    spheres: spheres.length,
    required: room.requiredKills,
    fullClear: spheres.length > 0 && room.requiredKills >= spheres.length,
    movingActors: room.enemies.filter((e) => e.drift || e.orbit).length,
    originGated: room.enemies.filter((e) => e.originConstraint || e.kind === "shield").length,
    utility: room.enemies.filter((e) => ["cube", "diamond", "prism"].includes(e.kind)).length,
    hazards: room.hazards?.length ?? 0,
    goalVisibleFromSpawn: lineClear([room.spawn[0], room.spawn[1], room.spawn[2]], room.goal, room.platforms),
    grammar: [...room.grammar],
    plan: planGrid(floors, room),
    profile: sideProfile(floors, room),
    geometryHash: JSON.stringify([
      room.platforms.map((p) => [p.center, p.size]),
      room.enemies.map((e) => [e.kind, e.position]),
      room.spawn,
      room.goal
    ])
  };
}

export function layoutSimilarity(a: LayoutDescriptor, b: LayoutDescriptor): number {
  if (a.geometryHash === b.geometryHash) return 1;
  const plan = jaccard(a.plan, b.plan);
  const profile = 1 - a.profile.reduce((sum, v, i) => sum + Math.abs(v - b.profile[i]!), 0) / a.profile.length;
  const scale = 1 - (
    ratioGap(a.spanX, b.spanX) + ratioGap(a.spanZ, b.spanZ) + Math.min(1, Math.abs(a.spanY - b.spanY) / 20)
  ) / 3;
  const structure = 1 - (
    gap(a.floors, b.floors, 10) + gap(a.walls, b.walls, 6) + gap(a.lowCeilings, b.lowCeilings, 3) +
    gap(a.moving, b.moving, 3) + gap(a.spheres, b.spheres, 10) + gap(a.hazards, b.hazards, 4)
  ) / 6;
  const topology = (a.skeleton === b.skeleton ? 0.6 : 0) + (a.goal === b.goal ? 0.4 : 0);
  return clamp01(0.3 * plan + 0.15 * profile + 0.15 * scale + 0.2 * structure + 0.2 * topology);
}

export function classifyPair(score: number, identical: boolean): ActionClass {
  if (identical || score >= 0.88) return "RED";
  if (score >= 0.8) return "ORANGE";
  if (score >= 0.72) return "YELLOW";
  return "GREEN";
}

export function similarityPairs(descriptors: LayoutDescriptor[]): SimilarityPair[] {
  const pairs: SimilarityPair[] = [];
  for (let i = 0; i < descriptors.length; i++) {
    for (let j = i + 1; j < descriptors.length; j++) {
      const a = descriptors[i]!;
      const b = descriptors[j]!;
      pairs.push({ a: a.id, b: b.id, score: layoutSimilarity(a, b), identical: a.geometryHash === b.geometryHash });
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

function classifySkeleton(
  room: RoomSpec,
  floors: PlatformSpec[],
  spanX: number,
  spanY: number,
  spanZ: number,
  goal: GoalTopology
): Skeleton {
  const horizontal = Math.max(spanX, spanZ);
  if (goal === "beside-spawn") {
    const around = floors.filter((p) => Math.abs(p.center[0] - room.spawn[0]) > 12 || Math.abs(p.center[2] - room.spawn[2]) > 12);
    const quadrants = new Set(around.map((p) => `${Math.sign(p.center[0] - room.spawn[0])}:${Math.sign(p.center[2] - room.spawn[2])}`));
    return quadrants.size >= 3 && spanX > 24 && spanZ > 24 ? "hub" : "return";
  }
  if (spanY > horizontal * 0.75 && spanY > 14) return goal === "below" ? "descent" : "ascent";
  if (stackedLevels(floors) >= 2) return "stacked";
  if (spanX > spanZ * 1.15) return "lateral";
  if (spanZ > spanX * 2.6) {
    const swings = floors.filter((p) => Math.abs(p.center[0]) > spanX * 0.22).length;
    return swings >= Math.max(2, floors.length * 0.5) ? "zig-zag" : "corridor";
  }
  return "field";
}

/** Count columns where a walkable floor sits under another floor with real headroom between. */
function stackedLevels(floors: PlatformSpec[]): number {
  let stacked = 0;
  for (const upper of floors) {
    const covers = floors.some((lower) => lower !== upper &&
      top(upper) - top(lower) > 3.2 && overlapXZ(upper, lower) > 12);
    if (covers) stacked += 1;
  }
  return stacked;
}

function countLowCeilings(platforms: PlatformSpec[]): number {
  let count = 0;
  for (const slab of platforms) {
    const bottom = slab.center[1] - slab.size[1] / 2;
    const over = platforms.some((floor) => floor !== slab && bottom - top(floor) > 1.15 && bottom - top(floor) < 1.8 && overlapXZ(slab, floor) > 1);
    if (over) count += 1;
  }
  return count;
}

function planGrid(floors: PlatformSpec[], room: RoomSpec): number[] {
  const xs = floors.flatMap((p) => [p.center[0] - p.size[0] / 2, p.center[0] + p.size[0] / 2]).concat(room.spawn[0], room.goal[0]);
  const zs = floors.flatMap((p) => [p.center[2] - p.size[2] / 2, p.center[2] + p.size[2] / 2]).concat(room.spawn[2], room.goal[2]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const sx = Math.max(1, x1 - x0), sz = Math.max(1, z1 - z0);
  const grid = new Array(PLAN * PLAN).fill(0);
  for (let i = 0; i < PLAN; i++) {
    for (let j = 0; j < PLAN; j++) {
      const cx = x0 + ((i + 0.5) / PLAN) * sx;
      // Spawn-relative orientation: row 0 is always the spawn end.
      const cz = room.spawn[2] >= room.goal[2] ? z1 - ((j + 0.5) / PLAN) * sz : z0 + ((j + 0.5) / PLAN) * sz;
      grid[i * PLAN + j] = floors.some((p) =>
        Math.abs(cx - p.center[0]) <= p.size[0] / 2 + sx / PLAN / 2 &&
        Math.abs(cz - p.center[2]) <= p.size[2] / 2 + sz / PLAN / 2) ? 1 : 0;
    }
  }
  return grid;
}

function sideProfile(floors: PlatformSpec[], room: RoomSpec): number[] {
  const zs = floors.map((p) => p.center[2]).concat(room.spawn[2], room.goal[2]);
  const z0 = Math.min(...zs), z1 = Math.max(...zs);
  const bins = new Array(PLAN).fill(0);
  const counts = new Array(PLAN).fill(0);
  for (const p of floors) {
    const t = (p.center[2] - z0) / Math.max(1, z1 - z0);
    const bin = Math.min(PLAN - 1, Math.floor((room.spawn[2] >= room.goal[2] ? 1 - t : t) * PLAN));
    bins[bin] += top(p) - (room.spawn[1] - 1.7);
    counts[bin] += 1;
  }
  return bins.map((v, i) => counts[i] ? clamp01(0.5 + v / counts[i] / 40) : 0.5);
}

function lineClear(a: number[], b: readonly number[], platforms: PlatformSpec[]): boolean {
  return !platforms.some((p) => {
    let t0 = 0, t1 = 1;
    for (let i = 0; i < 3; i++) {
      const lo = p.center[i]! - p.size[i]! / 2 + 0.01, hi = p.center[i]! + p.size[i]! / 2 - 0.01;
      const d = b[i]! - a[i]!;
      if (Math.abs(d) < 1e-9) { if (a[i]! < lo || a[i]! > hi) return false; continue; }
      let ta = (lo - a[i]!) / d, tb = (hi - a[i]!) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
    return true;
  });
}

const top = (p: PlatformSpec) => p.center[1] + p.size[1] / 2;
const range = (v: number[]) => Math.max(...v) - Math.min(...v);
const round = (v: number) => Math.round(v * 10) / 10;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const gap = (a: number, b: number, max: number) => Math.min(1, Math.abs(a - b) / max);
const ratioGap = (a: number, b: number) => Math.min(1, Math.abs(Math.log(Math.max(1, a) / Math.max(1, b))) / Math.log(3));

function overlapXZ(a: PlatformSpec, b: PlatformSpec): number {
  const ox = Math.min(a.center[0] + a.size[0] / 2, b.center[0] + b.size[0] / 2) - Math.max(a.center[0] - a.size[0] / 2, b.center[0] - b.size[0] / 2);
  const oz = Math.min(a.center[2] + a.size[2] / 2, b.center[2] + b.size[2] / 2) - Math.max(a.center[2] - a.size[2] / 2, b.center[2] - b.size[2] / 2);
  return Math.max(0, ox) * Math.max(0, oz);
}

function jaccard(a: number[], b: number[]): number {
  let inter = 0, union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) union += 1;
    if (a[i] && b[i]) inter += 1;
  }
  return union ? inter / union : 1;
}
