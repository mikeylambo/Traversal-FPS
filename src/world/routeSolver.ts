import { evaluateActorOrigin, spatialActorDefinition } from "./spatialActors";
import type { EnemySpec, HazardSpec, PlatformSpec, RoomSpec, Vec3Tuple } from "./stages";

/**
 * Offline route solver. Mirrors the runtime rules closely enough to prove that an
 * authored room can be cleared: walking (no jump, 0.38m auto-step, drops), crouch
 * (eye 1.06 under low ceilings), line-of-sight kills with origin constraints, live
 * warp origin (reposition after the kill), Stop Short fractions, solid-geometry
 * warp blocking, landing snap, fall-through landings and one-shot airborne chains.
 *
 * Deliberately conservative: no air control, sweeps and short-cycle gates are
 * treated as timeable. A room it proves solvable is solvable; a room it rejects
 * needs a human look (or uses a mechanic the model does not cover).
 */

type V = [number, number, number];
type Box = { min: V; max: V };

const STAND_EYE = 1.7;
const CROUCH_EYE = 1.06;
const HEAD_MARGIN = 0.16;
const PLAYER_RADIUS = 0.32;
const AUTO_STEP = 0.38;
const GRID = 0.5;
const GOAL_RADIUS = 2.3;
const LAND_EDGE = 0.26;
const LAND_VERTICAL = 0.72;
const MIN_FRACTION = 0.12;
const PHASES = 8;

export interface SolveOptions {
  exactKills?: boolean;
  allowCrouch?: boolean;
  allowReposition?: boolean;
  allowAirborneChain?: boolean;
  maxStates?: number;
  maxMillis?: number;
  /** Skip the search; only measure how much of the room is skippable from the goal. */
  goalFirstOnly?: boolean;
}

/**
 * "Warp to the end, then shoot": how early the player can stand where the goal is
 * walkable, and how many Spheres are shootable from there. A valid tactic, but a
 * room where it covers the whole requirement has no middle.
 */
export interface GoalFirst {
  /** Fewest Sphere kills before the player can stand on the goal's platform (-1: not within 3). */
  arrivalKills: number;
  /** Spheres shootable from the goal's platform. */
  finaleSpheres: number;
  required: number;
  verdict: "SKIPPABLE" | "EARLY FINISH" | "BALANCED";
}

export interface SolveStep {
  action: "kill" | "warp" | "chain";
  actor: string;
  from: V;
  to?: V;
  fraction?: number;
  crouched?: boolean;
}

export interface SolveResult {
  solved: boolean;
  states: number;
  steps: SolveStep[];
  /** Why the search stopped when unsolved. */
  reason?: string;
  /** Lowest and highest floor the witness route stands on. */
  yRange: [number, number];
  warps: number;
  goalFirst?: GoalFirst;
}

type Floor = { box: Box; top: number; source: number; ride?: boolean };
type Node = { floor: number; ix: number; iz: number; x: number; z: number; top: number; stand: boolean; crouch: boolean };
type Target = { index: number; spec: EnemySpec; sphere: boolean; phases: V[]; radius: number };
type Lethal = { spec: HazardSpec; box: Box; offset: number };

type World = {
  mask: number;
  floors: Floor[];
  solids: Box[];
  shotBlockers: Box[];
  lethal: Lethal[];
  nodes: Node[];
  byKey: Map<string, number>;
  byColumn: Map<string, number[]>;
  scc: Int32Array;
  sccNodes: number[][];
  sccReach: Map<number, number[]>;
  coarse: Uint8Array;
  adj: number[][];
  /** Nodes that share a spot on the same moving platform: riding connects them. */
  ride: Map<number, number[]>;
  vis: Map<string, Set<number>>;
  warp: Map<string, WarpOutcome[]>;
};

type WarpOutcome = { origin: number; eye: number; node: number; fraction: number; air?: V; passesGoal: boolean };

const box = (c: readonly number[], s: readonly number[], pad = 0): Box => ({
  min: [c[0]! - s[0]! / 2 - pad, c[1]! - s[1]! / 2 - pad, c[2]! - s[2]! / 2 - pad],
  max: [c[0]! + s[0]! / 2 + pad, c[1]! + s[1]! / 2 + pad, c[2]! + s[2]! / 2 + pad]
});

function segmentHitsBox(a: V, b: V, bx: Box, eps = 0.01): boolean {
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 3; i++) {
    const lo = bx.min[i]! + eps;
    const hi = bx.max[i]! - eps;
    const d = b[i]! - a[i]!;
    if (Math.abs(d) < 1e-9) {
      if (a[i]! < lo || a[i]! > hi) return false;
      continue;
    }
    let ta = (lo - a[i]!) / d;
    let tb = (hi - a[i]!) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return false;
  }
  return true;
}

const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]);

function segmentPointDistance(a: V, b: V, p: V): number {
  const ab = sub(b, a);
  const l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / l2));
  return len(sub(lerp(a, b, t), p));
}

function isSphere(enemy: EnemySpec): boolean {
  return Boolean(spatialActorDefinition(enemy.kind)?.capabilities.includes("vector-endpoint"));
}

function actorPhases(enemy: EnemySpec): V[] {
  const base = [...enemy.position] as V;
  if (enemy.drift) {
    const axis = enemy.drift.axis === "x" ? 0 : 1;
    return Array.from({ length: PHASES }, (_, k) => {
      const p = [...base] as V;
      p[axis] += Math.sin((k / PHASES) * Math.PI * 2) * enemy.drift!.amplitude;
      return p;
    });
  }
  if (enemy.orbit) {
    const o = enemy.orbit;
    return Array.from({ length: PHASES }, (_, k) => {
      const angle = (k / PHASES) * Math.PI * 2;
      const a = Math.cos(angle) * o.radiusA;
      const b = Math.sin(angle) * o.radiusB;
      const p = [...base] as V;
      if (o.plane === "xy") { p[0] += a; p[1] += b; }
      if (o.plane === "xz") { p[0] += a; p[2] += b; }
      if (o.plane === "yz") { p[1] += a; p[2] += b; }
      return p;
    });
  }
  return [base];
}

function timeable(hazard: HazardSpec): boolean {
  if (hazard.kind === "sweep") return true;
  if (!hazard.cycle) return false;
  return hazard.cycle.period < 50 && hazard.cycle.openFor >= 0.3;
}

function apertureSecondary(spec: HazardSpec): number {
  return spec.aperture!.axis === "x" ? Math.min(spec.size[1] * 0.62, 6.2) : Math.min(spec.size[0] * 0.5, 6.2);
}

function apertureSafeAt(h: Lethal, p: V): boolean {
  const a = h.spec.aperture;
  if (!a) return false;
  const c = h.spec.center;
  const primary = a.axis === "x" ? 0 : 1;
  const secondary = a.axis === "x" ? 1 : 0;
  return Math.abs(p[primary] - c[primary] - (a.center + h.offset)) <= a.span * 0.5 &&
    Math.abs(p[secondary] - c[secondary]) <= apertureSecondary(h.spec) * 0.5;
}

function pointUnsafe(h: Lethal, p: V): boolean {
  const inside = p.every((v, i) => v >= h.box.min[i]! && v <= h.box.max[i]!);
  if (!inside) return false;
  return !(h.spec.kind === "aperture-wall" && apertureSafeAt(h, p));
}

function pathHitsLethal(h: Lethal, from: V, to: V): boolean {
  const a: V = [from[0], from[1] - 0.72, from[2]];
  const b: V = [to[0], to[1] - 0.72, to[2]];
  if (h.spec.kind === "aperture-wall" && h.spec.aperture) {
    const s = h.spec.size;
    const thin = s[0] <= s[1] && s[0] <= s[2] ? 0 : s[1] <= s[2] ? 1 : 2;
    const d = b[thin] - a[thin];
    if (Math.abs(d) > 1e-9) {
      const t = (h.spec.center[thin] - a[thin]) / d;
      if (t >= 0 && t <= 1 && apertureSafeAt(h, lerp(a, b, t))) return false;
    }
  }
  return segmentHitsBox(a, b, h.box, 0);
}

export function solveRoom(room: RoomSpec, options: SolveOptions = {}): SolveResult {
  const allowCrouch = options.allowCrouch ?? true;
  const allowReposition = options.allowReposition ?? true;
  const allowChain = options.allowAirborneChain ?? true;
  const exact = options.exactKills ?? false;
  const maxStates = options.maxStates ?? 60000;
  const deadline = Date.now() + (options.maxMillis ?? 30000);

  const targets: Target[] = room.enemies.map((spec, index) => ({
    index,
    spec,
    sphere: isSphere(spec),
    phases: actorPhases(spec),
    radius: spec.radius ?? 0.72
  }));
  const utilityBits = targets.filter((t) => !t.sphere).map((t) => 1 << t.index).reduce((a, b) => a | b, 0);
  const sphereCount = (mask: number) => targets.filter((t) => t.sphere && (mask & (1 << t.index))).length;
  const worlds = new Map<number, World>();

  const world = (mask: number): World => {
    const key = mask & utilityBits;
    const cached = worlds.get(key);
    if (cached) return cached;
    const built = buildWorld(room, targets, key, allowCrouch);
    worlds.set(key, built);
    return built;
  };

  const eyeOf = (n: Node, eye: number) => n.top + (eye === 0 ? STAND_EYE : CROUCH_EYE);
  const eyesOf = (n: Node) => [n.stand ? 0 : -1, allowCrouch && n.crouch ? 1 : -1].filter((e) => e >= 0);
  const goal = [...room.goal] as V;
  const killsMet = (mask: number) => exact ? sphereCount(mask) === room.requiredKills : sphereCount(mask) >= room.requiredKills;

  const reach = (w: World, scc: number): number[] => {
    const cached = w.sccReach.get(scc);
    if (cached) return cached;
    const seen = new Set<number>([scc]);
    const stack = [scc];
    const out: number[] = [];
    while (stack.length) {
      const s = stack.pop()!;
      for (const n of w.sccNodes[s]!) {
        out.push(n);
        for (const m of w.adj[n]!) {
          const t = w.scc[m]!;
          if (!seen.has(t)) { seen.add(t); stack.push(t); }
        }
      }
    }
    w.sccReach.set(scc, out);
    return out;
  };

  const canSee = (w: World, eye: V, target: Target, p: V): boolean => {
    if (!evaluateActorOrigin(target.spec.kind, target.spec.originConstraint, eye).allowed) return false;
    const d = sub(p, eye);
    const dist = len(d);
    if (dist < 0.5) return true;
    const up: V = Math.abs(d[1]) / dist > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u: V = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]];
    const ul = len(u);
    const v: V = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    const vl = len(v);
    const r = target.radius * 0.6;
    const aims: V[] = [p,
      [p[0] + u[0] / ul * r, p[1] + u[1] / ul * r, p[2] + u[2] / ul * r],
      [p[0] - u[0] / ul * r, p[1] - u[1] / ul * r, p[2] - u[2] / ul * r],
      [p[0] + v[0] / vl * r, p[1] + v[1] / vl * r, p[2] + v[2] / vl * r],
      [p[0] - v[0] / vl * r, p[1] - v[1] / vl * r, p[2] - v[2] / vl * r]];
    return aims.some((aim) => {
      const ad = sub(aim, eye);
      const al = len(ad);
      const end = lerp(eye, aim, Math.max(0, (al - target.radius * 0.85) / al));
      return !w.shotBlockers.some((b) => segmentHitsBox(eye, end, b));
    });
  };

  const visibleFrom = (w: World, t: Target, ph: number): Set<number> => {
    const key = `${t.index}:${ph}`;
    const cached = w.vis.get(key);
    if (cached) return cached;
    const out = new Set<number>();
    const p = t.phases[ph]!;
    w.nodes.forEach((n, i) => {
      if (!w.coarse[i]) return;
      for (const e of eyesOf(n)) if (canSee(w, [n.x, eyeOf(n, e), n.z], t, p)) out.add(i * 2 + e);
    });
    w.vis.set(key, out);
    return out;
  };

  const warpFrom = (w: World, origin: V, eye: number, p: V): { node: number; fraction: number; air?: V; passesGoal: boolean }[] => {
    const d = sub(p, origin);
    const dist = len(d);
    if (dist < 0.3) return [];
    const eyeHeight = eye === 0 ? STAND_EYE : CROUCH_EYE;
    const fractions = new Set<number>([1, 0.25, 0.5, 0.75]);
    const onFloor = (f: Floor, t: number) => {
      const x = origin[0] + d[0] * t;
      const z = origin[2] + d[2] * t;
      return x >= f.box.min[0] - LAND_EDGE && x <= f.box.max[0] + LAND_EDGE && z >= f.box.min[2] - LAND_EDGE && z <= f.box.max[2] + LAND_EDGE;
    };
    for (const f of w.floors) {
      if (Math.abs(d[1]) > 1e-4) {
        for (const eh of [STAND_EYE, CROUCH_EYE]) {
          const t = (f.top + eh - origin[1]) / d[1];
          if (t >= MIN_FRACTION && t <= 1 && onFloor(f, t)) fractions.add(t);
        }
      } else if (Math.abs(origin[1] - (f.top + eyeHeight)) <= LAND_VERTICAL) {
        const entry = rectEntry(origin, p, f.box);
        if (entry) { fractions.add(Math.min(1, entry[0] + 0.4 / dist)); fractions.add((entry[0] + entry[1]) / 2); }
      }
    }
    const out: { node: number; fraction: number; air?: V; passesGoal: boolean }[] = [];
    for (const f of fractions) {
      if (!(f >= MIN_FRACTION && f <= 1)) continue;
      const land = lerp(origin, p, f);
      const far = f * dist - 0.48;
      if (far > 0.02) {
        const stop = lerp(origin, p, far / dist);
        if (w.shotBlockers.some((b) => segmentHitsBox(origin, stop, b))) continue;
      }
      if (w.lethal.some((h) => pathHitsLethal(h, origin, land))) continue;
      // The runtime rejects destinations inside solids; also never count an arrival
      // whose body would end inside one (thin-wall clip).
      const body: V = [land[0], land[1] - 0.8, land[2]];
      const inside = (q: V) => w.shotBlockers.some((b) => q.every((v, i) => v > b.min[i]! + 0.05 && v < b.max[i]! - 0.05));
      if (inside(land) || inside(body)) continue;
      const passesGoal = segmentPointDistance(origin, land, goal) <= GOAL_RADIUS;
      const node = arrival(w, land, eyeHeight);
      if (node >= 0) out.push({ node, fraction: f, passesGoal });
      else out.push({ node: -1, fraction: f, air: land, passesGoal });
    }
    return out;
  };

  const warpOutcomes = (w: World, t: Target, ph: number, originKey: number): WarpOutcome[] => {
    const key = `${t.index}:${ph}:${originKey}`;
    const cached = w.warp.get(key);
    if (cached) return cached;
    const n = w.nodes[originKey >> 1]!;
    const eye = originKey & 1;
    const origin: V = [n.x, eyeOf(n, eye), n.z];
    const out = warpFrom(w, origin, eye, t.phases[ph]!).map((o) => ({ ...o, origin: originKey >> 1, eye }));
    w.warp.set(key, out);
    return out;
  };

  // A fall from an airborne point lands on the highest floor below it (no air control).
  const fallFrom = (w: World, p: V): number => {
    let best = -1;
    let bestTop = -Infinity;
    for (let i = 0; i < w.floors.length; i++) {
      const f = w.floors[i]!;
      if (p[0] < f.box.min[0] - 0.08 || p[0] > f.box.max[0] + 0.08 || p[2] < f.box.min[2] - 0.08 || p[2] > f.box.max[2] + 0.08) continue;
      if (f.top + STAND_EYE > p[1] + 0.32 || f.top <= bestTop) continue;
      best = i; bestTop = f.top;
    }
    return best < 0 ? -1 : nearestNode(w, best, p[0], p[2]);
  };

  type State = { scc: number; mask: number; world: number; parent: number; step?: SolveStep[] };
  const start = spawnNode(world(0), room.spawn);
  if (start < 0) return { solved: false, states: 0, steps: [], reason: "spawn has no valid standing node", yRange: [0, 0], warps: 0 };

  const states: State[] = [{ scc: world(0).scc[start]!, mask: 0, world: 0, parent: -1 }];
  const seen = new Set<string>([`${states[0]!.scc}|0`]);
  // Best-first on kill count: deeper kill sets are expanded first, which finds
  // long full-clear routes quickly without changing what is reachable.
  const buckets: number[][] = [[0]];
  const push = (w: World, node: number, mask: number, parent: number, step: () => SolveStep[]) => {
    const kills = sphereCount(mask);
    if (exact && kills > room.requiredKills) return;
    const scc = w.scc[node]!;
    const key = `${scc}|${mask}`;
    if (seen.has(key)) return;
    seen.add(key);
    states.push({ scc, mask, world: w.mask, parent, step: step() });
    (buckets[kills] ??= []).push(states.length - 1);
  };
  const nextState = (): number => {
    for (let k = buckets.length - 1; k >= 0; k--) {
      const bucket = buckets[k];
      if (bucket?.length) return bucket.pop()!;
    }
    return -1;
  };

  const goalInReach = (w: World, nodes: number[]) => nodes.some((i) => {
    const n = w.nodes[i]!;
    return eyesOf(n).some((e) => len(sub([n.x, eyeOf(n, e), n.z], goal)) <= GOAL_RADIUS);
  });

  // Warp results depend on where the player can walk and the world, not on which
  // Spheres are dead. Kills are cached per region/target/phase; warps per firing
  // region, since the warp must start somewhere reachable from where you fired
  // (drops are one-way).
  type Landing = { node: number; out: WarpOutcome };
  type Kill = { killers: number[] };
  type Warps = { lands: Landing[]; airs: WarpOutcome[]; goalPass: WarpOutcome | null };
  type Chain = { targets: number; lands: { node: number; steps: SolveStep[] }[]; goalPass: SolveStep[] | null };
  const kills = new Map<string, Kill | null>();
  const warpsCache = new Map<string, Warps>();
  const chains = new Map<string, Chain[]>();

  const expand = (w: World, scc: number, t: Target, ph: number): Kill | null => {
    const key = `${w.mask}:${scc}:${t.index}:${ph}`;
    if (kills.has(key)) return kills.get(key)!;
    const reachSet = new Set(reach(w, scc));
    const byScc = new Map<number, number>();
    for (const k of visibleFrom(w, t, ph)) {
      if (!reachSet.has(k >> 1)) continue;
      const region = w.scc[k >> 1]!;
      if (!byScc.has(region)) byScc.set(region, k);
    }
    const result = byScc.size ? { killers: [...byScc.values()] } : null;
    kills.set(key, result);
    return result;
  };

  const warpsFrom = (w: World, firingScc: number, t: Target, ph: number): Warps => {
    const key = `${w.mask}:${firingScc}:${t.index}:${ph}`;
    const cached = warpsCache.get(key);
    if (cached) return cached;
    const reachable = reach(w, firingScc);
    const reachSet = new Set(reachable);
    const origins = allowReposition
      ? reachable.filter((i) => w.coarse[i] === 2).flatMap((i) => eyesOf(w.nodes[i]!).map((e) => i * 2 + e))
      : [...visibleFrom(w, t, ph)].filter((k) => reachSet.has(k >> 1));
    const result: Warps = { lands: [], airs: [], goalPass: null };
    const landed = new Set<number>();
    const airs = new Set<string>();
    for (const o of origins) {
      for (const out of warpOutcomes(w, t, ph, o)) {
        if (out.passesGoal && !result.goalPass) result.goalPass = out;
        const node = out.node >= 0 ? out.node : fallFrom(w, out.air!);
        if (node >= 0 && !landed.has(w.scc[node]!)) { landed.add(w.scc[node]!); result.lands.push({ node, out }); }
        if (out.air) {
          const airKey = out.air.map((v) => Math.round(v * 2)).join(",");
          if (!airs.has(airKey)) { airs.add(airKey); result.airs.push(out); }
        }
      }
    }
    warpsCache.set(key, result);
    return result;
  };

  // Up to `depth` consecutive mid-air kills, each warping from the hang point.
  const chainFrom = (w: World, air: V, depth: number): Chain[] => {
    const key = `${w.mask}:${depth}:${air.map((v) => Math.round(v * 2)).join(",")}`;
    const cached = chains.get(key);
    if (cached) return cached;
    const out: Chain[] = [];
    for (const t2 of targets) {
      if (!t2.sphere) continue;
      for (const p2 of t2.phases) {
        if (!canSee(w, air, t2, p2)) continue;
        const bit = 1 << t2.index;
        const chain: Chain = { targets: bit, lands: [], goalPass: null };
        const seenScc = new Set<number>();
        const seenAir = new Set<string>();
        for (const o2 of warpFrom(w, air, 0, p2)) {
          const step: SolveStep = { action: "chain", actor: t2.spec.id, from: air, to: o2.air ?? nodeEye(w, o2.node), fraction: Math.round(o2.fraction * 100) / 100 };
          if (o2.passesGoal && !chain.goalPass) chain.goalPass = [step];
          const n2 = o2.node >= 0 ? o2.node : fallFrom(w, o2.air!);
          if (n2 >= 0 && !seenScc.has(w.scc[n2]!)) { seenScc.add(w.scc[n2]!); chain.lands.push({ node: n2, steps: [step] }); }
          if (depth > 1 && o2.air) {
            const airKey = o2.air.map((v) => Math.round(v * 2)).join(",");
            if (seenAir.has(airKey)) continue;
            seenAir.add(airKey);
            for (const next of chainFrom(w, o2.air, depth - 1)) {
              if (next.targets & bit) continue;
              out.push({
                targets: next.targets | bit,
                lands: next.lands.map((land) => ({ node: land.node, steps: [step, ...land.steps] })),
                goalPass: next.goalPass ? [step, ...next.goalPass] : null
              });
            }
          }
        }
        out.push(chain);
        break;
      }
    }
    chains.set(key, out);
    return out;
  };

  if (options.goalFirstOnly) {
    return { solved: false, states: 0, steps: [], reason: "goal-first analysis only", yRange: [0, 0], warps: 0, goalFirst: goalFirstAnalysis() };
  }

  for (let s = nextState(); s >= 0; s = nextState()) {
    if (states.length > maxStates || Date.now() > deadline) {
      return { solved: false, states: states.length, steps: [], reason: "search budget exhausted", yRange: [0, 0], warps: 0 };
    }
    const state = states[s]!;
    const w = world(state.world);
    const reachable = reach(w, state.scc);
    if (killsMet(state.mask) && goalInReach(w, reachable)) return finish(s);

    for (const t of targets) {
      if (state.mask & (1 << t.index)) continue;
      const nextMask = state.mask | (1 << t.index);
      for (let ph = 0; ph < t.phases.length; ph++) {
        const e = expand(w, state.scc, t, ph);
        if (!e) continue;
        const killStepAt = (k: number): SolveStep => {
          const n = w.nodes[k >> 1]!;
          return { action: "kill", actor: t.spec.id, from: [n.x, eyeOf(n, k & 1), n.z], crouched: (k & 1) === 1 };
        };
        const warpStepOf = (out: WarpOutcome): SolveStep => {
          const on = w.nodes[out.origin]!;
          return { action: "warp", actor: t.spec.id, from: [on.x, eyeOf(on, out.eye), on.z], to: out.air ?? nodeEye(w, out.node), fraction: Math.round(out.fraction * 100) / 100, crouched: out.eye === 1 };
        };

        if (!t.sphere) {
          // Utility actors change world state; re-home the player where they fired from.
          const nw = world(nextMask);
          for (const k of e.killers) {
            const home = nw.byKey.get(nodeKey(w.nodes[k >> 1]!));
            if (home !== undefined) push(nw, home, nextMask, s, () => [killStepAt(k)]);
          }
          break;
        }

        for (const k of e.killers) {
          const killStep = killStepAt(k);
          // Without a warp the Sphere is still dead; the player stays where they fired.
          push(w, k >> 1, nextMask, s, () => [killStep]);
          const wr = warpsFrom(w, w.scc[k >> 1]!, t, ph);
          if (wr.goalPass && killsMet(nextMask)) {
            states.push({ scc: -1, mask: nextMask, world: w.mask, parent: s, step: [killStep, warpStepOf(wr.goalPass)] });
            return finish(states.length - 1);
          }
          for (const land of wr.lands) push(w, land.node, nextMask, s, () => [killStep, warpStepOf(land.out)]);
          if (!allowChain) continue;
          // Airborne chains: up to two more kills + warps from hang points.
          for (const air of wr.airs) {
            for (const chain of chainFrom(w, air.air!, 2)) {
              if (nextMask & chain.targets) continue;
              const chainMask = nextMask | chain.targets;
              if (chain.goalPass && killsMet(chainMask)) {
                states.push({ scc: -1, mask: chainMask, world: w.mask, parent: s, step: [killStep, warpStepOf(air), ...chain.goalPass] });
                return finish(states.length - 1);
              }
              for (const land of chain.lands) push(w, land.node, chainMask, s, () => [killStep, warpStepOf(air), ...land.steps]);
            }
          }
        }
      }
    }
  }
  const bestState = states.reduce((m, st) => sphereCount(st.mask) > sphereCount(m.mask) ? st : m, states[0]!);
  const best = sphereCount(bestState.mask);
  const missing = targets.filter((t) => t.sphere && !(bestState.mask & (1 << t.index))).map((t) => t.spec.id).join(",");
  return { solved: false, states: states.length, steps: [], reason: `no route reaches an active Gravity Ring (best ${best}/${room.requiredKills} Spheres; missing ${missing})`, yRange: [0, 0], warps: 0 };

  function goalFirstAnalysis(): GoalFirst {
    const w = world(0);
    const goalNodes = new Set(w.nodes.map((_, i) => i).filter((i) => goalInReach(w, [i])));
    // Finale: the end platform itself, i.e. regions the goal sits in. Perches
    // that merely drop onto it are part of the route, not the finish.
    const finaleScc = new Set([...goalNodes].map((i) => w.scc[i]!));
    const finale = new Set(w.nodes.map((_, i) => i).filter((i) => finaleScc.has(w.scc[i]!)));
    const spheres = targets.filter((t) => t.sphere);
    const finaleVisible = spheres.filter((t) => t.phases.some((_, ph) => [...visibleFrom(w, t, ph)].some((k) => finale.has(k >> 1))));
    const finaleSpheres = finaleVisible.length;

    // Breadth-first by kills: fire (optionally warp) from each region reached so far.
    // The best arrival is the one that leaves the most required Spheres still
    // shootable from the goal platform (kills spent getting there don't count twice).
    let arrivalKills = -1;
    let bestCover = 0;
    let frontier = new Map<string, { scc: number; mask: number }>([[`${w.scc[start]!}|0`, { scc: w.scc[start]!, mask: 0 }]]);
    const seenStates = new Set(frontier.keys());
    for (let depth = 0; depth <= 3 && frontier.size; depth++) {
      const arrived = [...frontier.values()].filter((f) => reach(w, f.scc).some((n) => finale.has(n)));
      if (arrived.length) {
        arrivalKills = depth;
        bestCover = Math.max(...arrived.map((f) => depth + finaleVisible.filter((t) => !(f.mask & (1 << t.index))).length));
        break;
      }
      if (depth === 3 || Date.now() > deadline) break;
      const next = new Map<string, { scc: number; mask: number }>();
      const add = (node: number, mask: number) => {
        const key = `${w.scc[node]!}|${mask}`;
        if (seenStates.has(key)) return;
        seenStates.add(key);
        next.set(key, { scc: w.scc[node]!, mask });
      };
      for (const f of frontier.values()) {
        for (const t of spheres) {
          if (f.mask & (1 << t.index)) continue;
          const mask = f.mask | (1 << t.index);
          for (let ph = 0; ph < t.phases.length; ph++) {
            const e = expand(w, f.scc, t, ph);
            if (!e) continue;
            for (const k of e.killers) {
              add(k >> 1, mask);
              for (const land of warpsFrom(w, w.scc[k >> 1]!, t, ph).lands) add(land.node, mask);
            }
          }
        }
      }
      frontier = next;
    }

    const required = room.requiredKills;
    const covers = arrivalKills >= 0 && bestCover >= required;
    // One- and two-Sphere rooms are meant to end with "hit it, warp there".
    const verdict = required < 3 || !covers ? "BALANCED"
      : arrivalKills <= 1 ? "SKIPPABLE"
        : arrivalKills * 2 <= required ? "EARLY FINISH" : "BALANCED";
    return { arrivalKills, finaleSpheres, required, verdict };
  }

  function finish(index: number): SolveResult {
    const steps: SolveStep[] = [];
    for (let i = index; states[i]!.parent >= 0; i = states[i]!.parent) steps.unshift(...(states[i]!.step ?? []));
    const ys = [room.spawn[1], ...steps.flatMap((s) => [s.from[1], s.to?.[1] ?? s.from[1]])];
    return {
      solved: true,
      states: states.length,
      steps,
      yRange: [Math.min(...ys), Math.max(...ys)],
      warps: steps.filter((s) => s.action !== "kill").length
    };
  }
}

function rectEntry(origin: V, target: V, b: Box): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  for (const i of [0, 2]) {
    const d = target[i]! - origin[i]!;
    const lo = b.min[i]! + 0.12;
    const hi = b.max[i]! - 0.12;
    if (Math.abs(d) < 1e-9) { if (origin[i]! < lo || origin[i]! > hi) return null; continue; }
    let ta = (lo - origin[i]!) / d;
    let tb = (hi - origin[i]!) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
  }
  return t0 <= t1 ? [t0, t1] : null;
}

const nodeKey = (n: Node) => `${n.floor}:${n.ix}:${n.iz}`;

function nodeEye(w: World, i: number): V {
  const n = w.nodes[i]!;
  return [n.x, n.top + (n.stand ? STAND_EYE : CROUCH_EYE), n.z];
}

function nearestNode(w: World, floor: number, x: number, z: number): number {
  let best = -1;
  let bestD = Infinity;
  const ix = Math.round(x / GRID);
  const iz = Math.round(z / GRID);
  for (let r = 0; r <= 3 && best < 0; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const i = w.byKey.get(`${floor}:${ix + dx}:${iz + dz}`);
        if (i === undefined) continue;
        const n = w.nodes[i]!;
        const d = (n.x - x) ** 2 + (n.z - z) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
    }
  }
  return best;
}

function arrival(w: World, p: V, eyeHeight: number): number {
  let best = -1;
  let bestDelta = Infinity;
  for (let i = 0; i < w.floors.length; i++) {
    const f = w.floors[i]!;
    if (p[0] < f.box.min[0] - LAND_EDGE || p[0] > f.box.max[0] + LAND_EDGE || p[2] < f.box.min[2] - LAND_EDGE || p[2] > f.box.max[2] + LAND_EDGE) continue;
    const delta = Math.abs(p[1] - (f.top + eyeHeight));
    const lowArrival = p[1] > f.top + 0.05 && p[1] < f.top + eyeHeight;
    if ((delta > LAND_VERTICAL && !lowArrival) || delta >= bestDelta) continue;
    best = i; bestDelta = delta;
  }
  if (best < 0) return -1;
  const f = w.floors[best]!;
  const x = Math.min(Math.max(p[0], f.box.min[0] + 0.12), f.box.max[0] - 0.12);
  const z = Math.min(Math.max(p[2], f.box.min[2] + 0.12), f.box.max[2] - 0.12);
  return nearestNode(w, best, x, z);
}

function spawnNode(w: World, spawn: Vec3Tuple): number {
  const p = [...spawn] as V;
  for (let i = 0; i < w.floors.length; i++) {
    const f = w.floors[i]!;
    if (Math.abs(p[1] - (f.top + STAND_EYE)) > 0.82) continue;
    if (p[0] < f.box.min[0] || p[0] > f.box.max[0] || p[2] < f.box.min[2] || p[2] > f.box.max[2]) continue;
    const n = nearestNode(w, i, p[0], p[2]);
    if (n >= 0) return n;
  }
  return -1;
}

function* neighbors(w: World, i: number): Generator<number> {
  const n = w.nodes[i]!;
  for (const j of w.ride.get(i) ?? []) if (j !== i) yield j;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const column = w.byColumn.get(`${n.ix + dx}:${n.iz + dz}`);
      if (!column) continue;
      let walked = false;
      let drop = -1;
      let dropTop = -Infinity;
      for (const j of column) {
        const m = w.nodes[j]!;
        const rise = m.top - n.top;
        if (rise >= -0.06 && rise <= AUTO_STEP) { walked = true; yield j; }
        else if (rise < -0.06 && m.top > dropTop) { drop = j; dropTop = m.top; }
      }
      if (!walked && drop >= 0 && !solidAbove(w, n.ix + dx, n.iz + dz, dropTop, n.top)) yield drop;
    }
  }
}

/** A column is only a drop if nothing solid sits between the ledge and the floor below. */
function solidAbove(w: World, ix: number, iz: number, lowTop: number, highTop: number): boolean {
  const x = ix * GRID;
  const z = iz * GRID;
  return w.solids.some((b) =>
    x >= b.min[0] - PLAYER_RADIUS && x <= b.max[0] + PLAYER_RADIUS &&
    z >= b.min[2] - PLAYER_RADIUS && z <= b.max[2] + PLAYER_RADIUS &&
    b.max[1] > lowTop + 0.05 && b.min[1] < highTop + STAND_EYE);
}

function buildWorld(room: RoomSpec, targets: Target[], mask: number, allowCrouch: boolean): World {
  const disabled = new Set<string>();
  const activated = new Set<string>();
  const offsets = new Map<string, number>();
  for (const t of targets) {
    if (!(mask & (1 << t.index)) || !t.spec.effect) continue;
    const e = t.spec.effect;
    if (e.type === "disable-hazard") e.targetIds.forEach((id) => disabled.add(id));
    if (e.type === "activate-platform") e.targetIds.forEach((id) => activated.add(id));
    if (e.type === "shift-aperture") e.targetIds.forEach((id) => offsets.set(id, e.offset));
  }

  const solids = room.platforms.map((p) => box(p.center, p.size));
  const floors: Floor[] = room.platforms.map((p, i) => ({ box: solids[i]!, top: p.center[1] + p.size[1] / 2, source: i }));
  const riding = new Set<number>();
  room.platforms.forEach((p: PlatformSpec, i) => {
    const m = p.motion;
    if (!m) return;
    const active = (m.active ?? true) || (p.id !== undefined && activated.has(p.id));
    if (!active || m.amplitude <= 0) return;
    riding.add(i);
    floors[i]!.ride = true;
    const axis = m.axis === "x" ? 0 : m.axis === "y" ? 1 : 2;
    const samples = Math.min(12, Math.ceil((2 * m.amplitude) / Math.max(0.5, p.size[axis] * 0.7)) + 1);
    for (let k = 0; k < samples; k++) {
      const offset = -m.amplitude + (2 * m.amplitude * k) / Math.max(1, samples - 1);
      const c = [...p.center] as V;
      c[axis] += offset;
      const b = box(c, p.size);
      floors.push({ box: b, top: c[1] + p.size[1] / 2, source: i, ride: true });
    }
  });

  const shotBlockers = [...solids];
  const lethal: Lethal[] = [];
  for (const h of room.hazards ?? []) {
    if (disabled.has(h.id)) continue;
    if (h.kind === "sightline-gate") {
      if (!timeable(h)) shotBlockers.push(box(h.center, h.size));
      continue;
    }
    if (timeable(h)) continue;
    lethal.push({ spec: h, box: { min: [h.center[0] - h.size[0] / 2 - 0.34, h.center[1] - h.size[1] / 2 - 0.82, h.center[2] - h.size[2] / 2 - 0.34], max: [h.center[0] + h.size[0] / 2 + 0.34, h.center[1] + h.size[1] / 2 + 0.82, h.center[2] + h.size[2] / 2 + 0.34] }, offset: offsets.get(h.id) ?? 0 });
  }

  const nodes: Node[] = [];
  const byKey = new Map<string, number>();
  const byColumn = new Map<string, number[]>();
  const bodyClear = (x: number, z: number, top: number, height: number, own: number) => !solids.some((b, i) => {
    if (i === own) return false;
    if (!(top + height > b.min[1] + 0.02 && top + 0.045 < b.max[1] - 0.02)) return false;
    const nx = Math.min(Math.max(x, b.min[0]), b.max[0]);
    const nz = Math.min(Math.max(z, b.min[2]), b.max[2]);
    return (x - nx) ** 2 + (z - nz) ** 2 < PLAYER_RADIUS ** 2;
  });

  floors.forEach((f, fi) => {
    const own = fi < room.platforms.length ? fi : -1;
    // Edge cells are included so floors that touch edge-to-edge share a seam.
    for (let ix = Math.ceil((f.box.min[0] - 0.001) / GRID); ix * GRID <= f.box.max[0] + 0.001; ix++) {
      for (let iz = Math.ceil((f.box.min[2] - 0.001) / GRID); iz * GRID <= f.box.max[2] + 0.001; iz++) {
        const x = ix * GRID;
        const z = iz * GRID;
        const moving = fi >= room.platforms.length;
        const crouch = allowCrouch && (moving || bodyClear(x, z, f.top, CROUCH_EYE + HEAD_MARGIN, own)) &&
          !lethal.some((h) => pointUnsafe(h, [x, f.top + CROUCH_EYE - 0.72, z]));
        const stand = (moving || bodyClear(x, z, f.top, STAND_EYE + HEAD_MARGIN, own)) &&
          !lethal.some((h) => pointUnsafe(h, [x, f.top + STAND_EYE - 0.72, z]));
        if (!crouch && !stand) continue;
        const idx = nodes.length;
        nodes.push({ floor: fi, ix, iz, x, z, top: f.top, stand, crouch });
        byKey.set(`${fi}:${ix}:${iz}`, idx);
        const col = `${ix}:${iz}`;
        const list = byColumn.get(col);
        if (list) list.push(idx); else byColumn.set(col, [idx]);
      }
    }
  });

  // Sampling tiers: 1 = firing positions (1m, all of small floors), 2 = warp origins
  // (2m on large floors, 1m on small ones). Warp origins are also firing positions.
  const coarse = new Uint8Array(nodes.length);
  nodes.forEach((n, i) => {
    const f = floors[n.floor]!;
    const area = (f.box.max[0] - f.box.min[0]) * (f.box.max[2] - f.box.min[2]);
    // Ledge lips matter: players peek over edges to look down or around walls.
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !byKey.has(`${n.floor}:${n.ix + dx!}:${n.iz + dz!}`));
    const fine = edge || (n.ix % 2 === 0 && n.iz % 2 === 0);
    const wide = (edge && (n.ix + n.iz) % 2 === 0) || (n.ix % 4 === 0 && n.iz % 4 === 0);
    coarse[i] = (area < 16 ? fine : wide) ? 2 : area < 16 || fine ? 1 : 0;
  });

  const w: World = {
    mask, floors, solids, shotBlockers, lethal, nodes, byKey, byColumn,
    scc: new Int32Array(nodes.length), sccNodes: [], sccReach: new Map(), coarse, adj: [], ride: new Map(),
    vis: new Map(), warp: new Map()
  };
  // Riding: the same deck-relative spot across every sampled position of a mover.
  const groups = new Map<string, number[]>();
  nodes.forEach((n, i) => {
    const f = floors[n.floor]!;
    if (!f.ride) return;
    const cx = (f.box.min[0] + f.box.max[0]) / 2;
    const cz = (f.box.min[2] + f.box.max[2]) / 2;
    const key = `${f.source}:${Math.round((n.x - cx) / GRID)}:${Math.round((n.z - cz) / GRID)}`;
    const list = groups.get(key);
    if (list) list.push(i); else groups.set(key, [i]);
  });
  for (const list of groups.values()) for (const i of list) w.ride.set(i, list);
  computeScc(w);
  return w;
}

function computeScc(w: World): void {
  const n = w.nodes.length;
  const index = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const stack: number[] = [];
  let counter = 0;
  const adjacency = w.nodes.map((_, i) => [...neighbors(w, i)]);
  w.adj = adjacency;

  for (let root = 0; root < n; root++) {
    if (index[root] !== -1) continue;
    const work: [number, number][] = [[root, 0]];
    index[root] = low[root] = counter++;
    stack.push(root); onStack[root] = 1;
    while (work.length) {
      const frame = work[work.length - 1]!;
      const [v, i] = frame;
      const adj = adjacency[v]!;
      if (i < adj.length) {
        frame[1] += 1;
        const u = adj[i]!;
        if (index[u] === -1) {
          index[u] = low[u] = counter++;
          stack.push(u); onStack[u] = 1;
          work.push([u, 0]);
        } else if (onStack[u]) low[v] = Math.min(low[v]!, index[u]!);
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1]![0];
        low[parent] = Math.min(low[parent]!, low[v]!);
      }
      if (low[v] === index[v]) {
        const id = w.sccNodes.length;
        const members: number[] = [];
        let u: number;
        do { u = stack.pop()!; onStack[u] = 0; w.scc[u] = id; members.push(u); } while (u !== v);
        w.sccNodes.push(members);
      }
    }
  }
}
