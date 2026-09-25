import * as THREE from "three";
import { ROUTE_GHOSTS, type GhostStep } from "../world/generated/routeGhosts";
import { ROOMS } from "../world/stages";

type RuntimeState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  modeId: string;
  roomIndex: number;
  runComplete: boolean;
  loadRoom(index: number): void;
  finishRun(): void;
};

/** Flat samples: [ms, x, y, z, ms, x, y, z, ...]. */
type GhostRun = { ms: number; s: number[] };

const STORAGE_KEY = "traversal:ghosts:v1";
const SAMPLE_MS = 80;
const TRAIL_MS = 2600;
/** A jump this large between samples is a warp: drawn as a vector, never interpolated. */
const WARP_JUMP = 2.2;
const GHOST_COLOR = 0xc9b8ff;
const ROUTE_COLOR = 0xa9c4dd;
const WALK_SPEED = 7.5;

/**
 * Time Trial vector ghosts. Every course replays your best clear of that room
 * as a trail of spatial writing: walks are soft lines, warps are hard streaks.
 * Until you have a best, the proven route from route certification plays
 * instead, so a new course always shows one line that works.
 */
export function installGhostRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  const group = new THREE.Group();
  group.name = "vector-ghost";
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshBasicMaterial({ color: GHOST_COLOR, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.012, 6, 32),
    new THREE.MeshBasicMaterial({ color: GHOST_COLOR, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  halo.rotation.x = Math.PI / 2;
  // Constant screen size, so the ghost stays findable 60m down a course.
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: GHOST_COLOR, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: false
  }));
  beacon.scale.setScalar(0.05);
  marker.add(halo, beacon);
  const trail = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: GHOST_COLOR, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  const vectors = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: GHOST_COLOR, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  for (const object of [marker, trail, vectors]) object.frustumCulled = false;
  group.add(marker, trail, vectors);
  group.visible = false;

  let roomId: string | null = null;
  let roomIndex = -1;
  let startedAt = 0;
  let recording: number[] = [];
  let lastSample = 0;
  let playback: GhostRun | null = null;

  const active = () => state.modeId === "time-trial";

  const finalize = () => {
    if (!roomId || !active()) return;
    const ms = performance.now() - startedAt;
    // Only a clear counts: the player must be at the Gravity Ring (dev room
    // jumps also advance the index without clearing anything).
    const goal = ROOMS[roomIndex]?.goal;
    if (!goal || state.camera.position.distanceTo(new THREE.Vector3(...goal)) > 4) return;
    sample(true);
    const best = readGhosts()[roomId];
    if (!best || ms < best.ms) writeGhost(roomId, { ms: Math.round(ms), s: recording });
  };

  const sample = (force = false) => {
    const now = performance.now();
    if (!force && now - lastSample < SAMPLE_MS) return;
    lastSample = now;
    const p = state.camera.position;
    recording.push(Math.round(now - startedAt), round(p.x), round(p.y), round(p.z));
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    // Advancing to the next room means the previous one was cleared; reloading
    // the same room is a reset and its partial recording is discarded.
    if (index === roomIndex + 1 && !state.runComplete) finalize();
    originalLoadRoom(index);
    if (group.parent !== state.scene) state.scene.add(group);
    roomIndex = index;
    roomId = ROOMS[index]?.id ?? null;
    startedAt = performance.now();
    lastSample = 0;
    recording = [];
    playback = active() && roomId ? readGhosts()[roomId] ?? routeGhost(roomId, ROOMS[index]?.spawn, ROOMS[index]?.goal) : null;
    const color = playback && readGhosts()[roomId ?? ""] ? GHOST_COLOR : ROUTE_COLOR;
    for (const object of [marker, trail, vectors, halo, beacon]) ((object as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(color);
    group.visible = Boolean(playback);
  };

  const originalFinishRun = state.finishRun.bind(game);
  state.finishRun = () => {
    finalize();
    roomId = null;
    group.visible = false;
    originalFinishRun();
  };

  const tick = () => {
    requestAnimationFrame(tick);
    if (!active() || state.runComplete || !roomId || !document.body.classList.contains("playing")) {
      group.visible = false;
      return;
    }
    sample();
    if (!playback) return;
    group.visible = true;
    const t = performance.now() - startedAt;
    const s = playback.s;
    const count = s.length / 4;
    if (count < 2) return;

    // Last sample at or before t.
    let lo = 0;
    let hi = count - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (s[mid * 4]! <= t) lo = mid; else hi = mid - 1;
    }
    const i = lo;
    const j = Math.min(count - 1, i + 1);
    const a = point(s, i);
    const b = point(s, j);
    const span = s[j * 4]! - s[i * 4]!;
    const f = span > 0 ? THREE.MathUtils.clamp((t - s[i * 4]!) / span, 0, 1) : 0;
    marker.position.copy(a.distanceTo(b) > WARP_JUMP ? (f < 0.5 ? a : b) : a.lerp(b, f));
    marker.position.y -= 0.55;
    marker.rotation.y = t * 0.003;
    const finished = t > s[(count - 1) * 4]!;
    (marker.material as THREE.MeshBasicMaterial).opacity = finished ? 0.25 : 0.85;

    const walk: THREE.Vector3[] = [];
    const warps: THREE.Vector3[] = [];
    let k = i;
    while (k > 0 && t - s[k * 4]! < TRAIL_MS) k -= 1;
    for (let n = k; n < i; n += 1) {
      const p = point(s, n);
      const q = point(s, n + 1);
      p.y -= 0.55;
      q.y -= 0.55;
      if (p.distanceTo(q) > WARP_JUMP) warps.push(p, q);
      else walk.push(p, q);
    }
    walk.push(marker.position.clone());
    trail.geometry.setFromPoints(walk.length > 1 ? walk : [marker.position, marker.position]);
    vectors.geometry.setFromPoints(warps.length ? warps : [marker.position, marker.position]);
  };
  requestAnimationFrame(tick);
}

function glowTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function point(s: number[], i: number): THREE.Vector3 {
  return new THREE.Vector3(s[i * 4 + 1], s[i * 4 + 2], s[i * 4 + 3]);
}

const round = (value: number) => Math.round(value * 100) / 100;

function readGhosts(): Record<string, GhostRun> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, GhostRun>;
  } catch {
    return {};
  }
}

function writeGhost(id: string, run: GhostRun): void {
  try {
    const all = readGhosts();
    all[id] = run;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage full or blocked: ghosts are a convenience, never an error.
  }
}

/**
 * The certified route has positions but no clock. Walk at run speed between
 * firing positions, pause briefly to shoot, and cross warps almost instantly.
 */
function routeGhost(id: string, spawn?: readonly number[], goal?: readonly number[]): GhostRun | null {
  const steps = ROUTE_GHOSTS[id];
  if (!steps || !spawn) return null;
  const s: number[] = [];
  let t = 0;
  let at = new THREE.Vector3(...(spawn as [number, number, number]));
  const push = (p: THREE.Vector3) => s.push(Math.round(t), p.x, p.y, p.z);
  const walkTo = (to: THREE.Vector3) => {
    const distance = at.distanceTo(to);
    const segments = Math.max(1, Math.ceil(distance / 1.5));
    for (let n = 1; n <= segments; n += 1) {
      t += (distance / segments / WALK_SPEED) * 1000;
      push(at.clone().lerp(to, n / segments));
    }
    at = to.clone();
  };
  push(at);
  for (const step of steps as GhostStep[]) {
    const from = new THREE.Vector3(...(step.f as [number, number, number]));
    if (step.a !== "chain") walkTo(from);
    t += 260;
    push(at);
    if (step.t) {
      t += 120;
      at = new THREE.Vector3(...(step.t as [number, number, number]));
      push(at);
    }
  }
  if (goal) walkTo(new THREE.Vector3(goal[0], goal[1]! + 1.1, goal[2]));
  return { ms: t, s };
}
