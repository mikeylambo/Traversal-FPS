import * as THREE from "three";
import { emitTraversalAudio } from "../audio/TraversalAudio";
import { actorColor } from "./TraversalAccessibility";
import { evaluateActorOrigin, isProximity, originGuidance, resolveOriginConstraint, type OriginGuidance, type ProximityConstraint } from "../world/spatialActors";
import { ROOMS, type EnemySpec } from "../world/stages";
import { installActorGeometryRuntime } from "./ActorGeometryRuntime";
import { installRoomAccentAccessibilityRuntime } from "./RoomAccentAccessibilityRuntime";

type ActiveEnemy = {
  spec: EnemySpec;
  mesh: THREE.Mesh;
  alive: boolean;
};

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  raycaster: THREE.Raycaster;
  enemies: ActiveEnemy[];
  platformMeshes: THREE.Mesh[];
  roomIndex: number;
  fireReadyAt: number;
  runComplete: boolean;
  pendingRoomResetAt: number;
  shots: number;
  roomShots: number;
  targetHits: number;
  roomKills: number;
  totalKills: number;
  exactKills: boolean;
  weapon: { fire(): void };
  warp: { write(origin: THREE.Vector3, target: THREE.Vector3): void };
  shoot(): void;
  updateTargetReticle(): void;
  loadRoom(index: number): void;
  playShot(): void;
  playShieldReject(): void;
  playKill(): void;
  playVectorWritten(): void;
  addMuzzleFx(): void;
  addShotTrace(point: THREE.Vector3): void;
  addImpactFx(point: THREE.Vector3, color: number): void;
  addKillFx(point: THREE.Vector3, kind: EnemySpec["kind"]): void;
  enforceChallengeShotBudget(now: number): boolean;
  failChallenge(message: string, now: number): void;
  flashMessage(message: string, duration: number): void;
};

const UTILITY_KINDS = new Set<EnemySpec["kind"]>(["cube", "diamond", "prism"]);

function utilityCue(kind: EnemySpec["kind"]): "actor.cube" | "actor.diamond" | "actor.prism" {
  if (kind === "diamond") return "actor.diamond";
  if (kind === "prism") return "actor.prism";
  return "actor.cube";
}

/**
 * Sphere-family actors are movement currency. Cubes, Diamonds, and Prisms are
 * spatial machinery: shooting them changes world state but never writes a vector.
 * Identity is carried by geometry, motion, and silhouette rather than color alone.
 */
export function installSpatialActorRuntime(game: object): void {
  const state = game as unknown as RuntimeState;

  state.shoot = () => {
    const now = performance.now();
    if (now < state.fireReadyAt || state.runComplete || state.pendingRoomResetAt > 0) return;

    state.fireReadyAt = now + 105;
    state.shots += 1;
    state.roomShots += 1;
    state.weapon.fire();
    state.playShot();
    state.addMuzzleFx();

    const room = ROOMS[state.roomIndex];
    state.raycaster.setFromCamera(new THREE.Vector2(0, 0), state.camera);

    const liveMeshes = state.enemies
      .filter((enemy) => enemy.alive)
      .map((enemy) => enemy.mesh);
    const hit = state.raycaster.intersectObjects(
      [...liveMeshes, ...state.platformMeshes],
      false
    )[0];

    const direction = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(state.camera.quaternion);
    const endPoint = hit?.point.clone() ?? state.camera.position
      .clone()
      .add(direction.multiplyScalar(120));
    state.addShotTrace(endPoint);

    if (!hit) {
      state.enforceChallengeShotBudget(now);
      return;
    }

    const enemy = state.enemies.find((candidate) => candidate.mesh === hit.object);
    if (!enemy) {
      state.addImpactFx(hit.point.clone(), 0x9edcff);
      state.enforceChallengeShotBudget(now);
      return;
    }

    state.targetHits += 1;
    const origin = vectorTuple(state.camera.position);
    const at = vectorTuple(enemy.mesh.position);
    const originRule = evaluateActorOrigin(enemy.spec.kind, enemy.spec.originConstraint, origin, at);
    if (!originRule.allowed) {
      const guidance = originGuidance(enemy.spec.kind, enemy.spec.originConstraint, origin, at);
      const hint = guidance ? describeGuidance(guidance, state.camera).text : originRule.message;
      state.flashMessage(hint ?? "TARGET REJECT // CHANGE YOUR FIRING ORIGIN", 1800);
      state.playShieldReject();
      state.addImpactFx(hit.point.clone(), 0xffa665);
      state.enforceChallengeShotBudget(now);
      return;
    }

    const hitPosition = enemy.mesh.position.clone();
    enemy.alive = false;
    enemy.mesh.visible = false;

    if (UTILITY_KINDS.has(enemy.spec.kind)) {
      state.roomShots = Math.max(0, state.roomShots - 1);
      state.addImpactFx(hitPosition, utilityImpactColor(enemy.spec.kind));
      // Utility resolves get their own timbre rather than the sphere confirm: the
      // flash message and this sound are the only two signals that the kill changed
      // world state, so they must not sound like an ordinary sphere.
      emitTraversalAudio(utilityCue(enemy.spec.kind));
      state.flashMessage(utilityMessage(enemy.spec.kind), 1500);
      window.dispatchEvent(new CustomEvent("traversal:puzzle-actor", {
        detail: {
          roomId: room.id,
          actorId: enemy.spec.id,
          kind: enemy.spec.kind,
          effect: enemy.spec.effect
        }
      }));
      return;
    }

    state.roomKills += 1;
    state.totalKills += 1;
    state.addKillFx(hitPosition, enemy.spec.kind);
    state.playKill();

    if (state.exactKills && state.roomKills > room.requiredKills) {
      state.failChallenge("CLEAN ROUTE FAILED // EXTRA KILL", now);
      return;
    }

    if (state.enforceChallengeShotBudget(now)) return;

    state.warp.write(state.camera.position.clone(), hitPosition);
    state.playVectorWritten();
    state.flashMessage(
      state.roomKills > room.requiredKills
        ? "EXTRA SPHERE // ROUTE EFFICIENCY DOWN"
        : "WARP READY",
      state.roomKills > room.requiredKills ? 1800 : 1000
    );
  };

  state.updateTargetReticle = () => {
    state.raycaster.setFromCamera(new THREE.Vector2(0, 0), state.camera);
    const liveMeshes = state.enemies
      .filter((enemy) => enemy.alive)
      .map((enemy) => enemy.mesh);
    const hit = state.raycaster.intersectObjects(
      [...liveMeshes, ...state.platformMeshes],
      false
    )[0];

    const enemy = hit
      ? state.enemies.find((candidate) => candidate.mesh === hit.object)
      : undefined;
    const guidance = enemy
      ? originGuidance(enemy.spec.kind, enemy.spec.originConstraint, vectorTuple(state.camera.position), vectorTuple(enemy.mesh.position))
      : null;
    const blocked = Boolean(guidance);

    document.body.classList.toggle("target-hot", Boolean(enemy) && !blocked);
    document.body.classList.toggle("target-blocked", blocked);
    // Say where to fire from while aiming, before a shot is wasted: which way
    // (relative to the view, with an arrow on screen) and how far.
    renderTargetHint(guidance ? describeGuidance(guidance, state.camera) : null);
    document.body.classList.toggle("target-utility", Boolean(enemy && UTILITY_KINDS.has(enemy.spec.kind)));
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    decorateActorVisuals(state.enemies, state.camera);
  };

  installActorGeometryRuntime(game);
  installRoomAccentAccessibilityRuntime(game);
}

type HintNodes = { root: HTMLElement; arrow: HTMLElement; text: HTMLElement };
let hintNodes: HintNodes | null = null;
let hintText = "";

function targetHint(): HintNodes {
  if (hintNodes?.root.isConnected) return hintNodes;
  const root = document.getElementById("target-hint") ?? document.body.appendChild(document.createElement("div"));
  root.id = "target-hint";
  root.replaceChildren();
  const arrow = root.appendChild(document.createElement("span"));
  arrow.className = "hint-arrow";
  const text = root.appendChild(document.createElement("span"));
  text.className = "hint-text";
  hintNodes = { root, arrow, text };
  hintText = "";
  return hintNodes;
}

function renderTargetHint(hint: GuidanceCopy | null): void {
  const nodes = targetHint();
  const text = hint?.text ?? "";
  if (text !== hintText) {
    hintText = text;
    nodes.text.textContent = text;
  }
  nodes.root.classList.toggle("has-text", Boolean(text));
  nodes.root.classList.toggle("has-arrow", hint?.angle != null);
  if (hint?.angle != null) nodes.arrow.style.transform = `rotate(${hint.angle.toFixed(1)}deg)`;
}

type GuidanceCopy = { text: string; angle: number | null };
const scratch = { forward: new THREE.Vector3(), right: new THREE.Vector3(), move: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3() };

/**
 * World guidance -> words relative to where the player is looking, plus the
 * on-screen angle of the move. "Right" means the player's right, not +X: after
 * turning round on a loop, a world-axis word would point the wrong way.
 */
function describeGuidance(guidance: OriginGuidance, camera: THREE.PerspectiveCamera): GuidanceCopy {
  const { forward, right, move, a, b } = scratch;
  move.set(...guidance.move);
  camera.getWorldDirection(forward);

  let words: string;
  if (guidance.kind === "proximity") words = "GET CLOSER";
  else if (guidance.axis === "y") words = guidance.move[1] > 0 ? "GO HIGHER" : "GO LOWER";
  else {
    a.copy(forward).setY(0);
    if (a.lengthSq() < 1e-6) a.set(0, 0, -1);
    a.normalize();
    right.set(-a.z, 0, a.x);
    const side = move.dot(right);
    const ahead = move.dot(a);
    words = Math.abs(side) >= Math.abs(ahead)
      ? side > 0 ? "MOVE RIGHT" : "MOVE LEFT"
      : ahead > 0 ? "MOVE FORWARD" : "MOVE BACK";
  }
  const metres = Math.max(1, Math.ceil(guidance.distance));

  // Project a short step of the move from a point just ahead of the eye. When
  // the move runs along the view (closer, forward, back) there is no honest
  // on-screen direction, so the arrow steps aside and the words carry it.
  a.copy(camera.position).addScaledVector(forward, 4);
  b.copy(a).addScaledVector(move, 1);
  a.project(camera);
  b.project(camera);
  const dx = (b.x - a.x) * camera.aspect;
  const dy = b.y - a.y;
  const angle = Math.hypot(dx, dy) < 0.05 ? null : THREE.MathUtils.radToDeg(Math.atan2(dx, dy));
  return { text: `${words} · ${metres}M`, angle };
}

function decorateActorVisuals(enemies: ActiveEnemy[], camera: THREE.Camera): void {
  for (const enemy of enemies) {
    if (enemy.mesh.userData.traversalActorVisual) continue;
    enemy.mesh.userData.traversalActorVisual = true;

    const constraint = resolveOriginConstraint(enemy.spec.kind, enemy.spec.originConstraint);
    if (constraint && isProximity(constraint)) decorateProximityGate(enemy, constraint, camera);
    else if (constraint) decorateOriginGate(enemy, camera);
    if (enemy.spec.kind === "drifter") decorateDrifter(enemy);
    if (enemy.spec.kind === "orbit") decorateOrbit(enemy);
  }
}

function decorateOrbit(enemy: ActiveEnemy): void {
  const orbit = enemy.spec.orbit;
  if (!orbit) return;
  const radius = enemy.spec.radius ?? 0.72;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.45, radius * 0.055, 8, 44),
    new THREE.MeshBasicMaterial({
      color: 0xb9ffe8,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  if (orbit.plane === "xy") ring.rotation.x = Math.PI * 0.5;
  if (orbit.plane === "yz") ring.rotation.y = Math.PI * 0.5;
  enemy.mesh.add(ring);
}

/** Axis families read differently at a glance: lateral, vertical, depth. */
const GATE_COLORS = { x: 0xffb46b, y: 0xb99bff, z: 0xff7fb8 } as const;

/**
 * An origin-gated Sphere sits in a cage while you stand where its shots would
 * bounce, and the cage opens the moment you cross into the firing zone. The
 * boundary itself is drawn as a large ring in the world that lights up once you
 * are over it. Moving is the explanation; no arrows, no reading required.
 */
function decorateOriginGate(enemy: ActiveEnemy, camera: THREE.Camera): void {
  const constraint = resolveOriginConstraint(enemy.spec.kind, enemy.spec.originConstraint);
  if (!constraint || isProximity(constraint)) return;
  const radius = enemy.spec.radius ?? 0.72;
  const axis = constraint.axis;
  const threshold = constraint.min ?? constraint.max;
  const allowedSign = constraint.min !== undefined ? 1 : -1;
  const allowed = axisVector(axis).multiplyScalar(allowedSign);
  const color = GATE_COLORS[axis];
  const additive = (opacity: number, extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, ...extra
  });

  const cageFill = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.32, 1), additive(0.22, { side: THREE.DoubleSide }));
  const cageWire = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.36, 1), additive(0.85, { wireframe: true }));
  const cage = new THREE.Group();
  cage.add(cageFill, cageWire);
  enemy.mesh.add(cage);

  const boundary = threshold === undefined ? null : new THREE.Mesh(
    new THREE.RingGeometry(1.35, 1.6, 48),
    additive(0.3, { side: THREE.DoubleSide })
  );
  if (boundary && threshold !== undefined) {
    // Lives in the room, not on the (spinning) Sphere, so it stays flat on the line.
    boundary.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), allowed);
    enemy.mesh.parent?.add(boundary);
    boundary.onBeforeRender = () => {
      boundary.position.copy(enemy.mesh.position);
      boundary.position[axis] = threshold;
      const offset = Math.abs(threshold - enemy.mesh.position[axis]);
      const inside = evaluateActorOrigin(enemy.spec.kind, enemy.spec.originConstraint, vectorTuple(camera.position), vectorTuple(enemy.mesh.position)).allowed;
      // Hidden via opacity: an invisible object never gets this callback again.
      const shown = enemy.mesh.visible && offset > radius * 1.6 && offset < 40;
      (boundary.material as THREE.MeshBasicMaterial).opacity = shown ? (inside ? 0.75 : 0.3) : 0;
    };
  }

  let open = 0;
  let last = performance.now();
  cageWire.onBeforeRender = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const inside = evaluateActorOrigin(enemy.spec.kind, enemy.spec.originConstraint, vectorTuple(camera.position), vectorTuple(enemy.mesh.position)).allowed;
    open = THREE.MathUtils.clamp(open + (inside ? dt : -dt) * 5, 0, 1);
    // The cage swells and fades as it opens, like it is being released.
    cage.scale.setScalar(1 + open * 0.45);
    (cageFill.material as THREE.MeshBasicMaterial).opacity = 0.22 * (1 - open);
    (cageWire.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - open) + 0.02;
    cage.rotation.y += dt * (0.4 + open * 2);
  };
}

const PROXIMITY_COLOR = 0xff8f7a;

/**
 * A proximity Sphere is a mace: spikes out while you are too far away, folded
 * into the body once you are inside its reach. Three thin great circles trace
 * that reach in the world and brighten when you cross into it.
 */
function decorateProximityGate(enemy: ActiveEnemy, constraint: ProximityConstraint, camera: THREE.Camera): void {
  const radius = enemy.spec.radius ?? 0.72;
  const spikeMaterial = new THREE.MeshStandardMaterial({
    color: PROXIMITY_COLOR, emissive: PROXIMITY_COLOR, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.35
  });
  const spikeGeometry = new THREE.ConeGeometry(radius * 0.2, radius * 0.8, 7).translate(0, radius * 0.4, 0);
  const directions = new THREE.IcosahedronGeometry(1, 0).getAttribute("position");
  const seen = new Set<string>();
  const spikes = new THREE.Group();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < directions.count; i++) {
    const dir = new THREE.Vector3().fromBufferAttribute(directions, i).normalize();
    const key = dir.toArray().map((v) => v.toFixed(3)).join();
    if (seen.has(key)) continue;
    seen.add(key);
    const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
    spike.quaternion.setFromUnitVectors(up, dir);
    spike.userData.dir = dir;
    spikes.add(spike);
  }
  enemy.mesh.add(spikes);

  const reachMaterial = new THREE.MeshBasicMaterial({
    color: PROXIMITY_COLOR, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const reach = new THREE.Group();
  const circle = new THREE.TorusGeometry(constraint.within, 0.028, 4, 128);
  for (const [x, y] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]] as const) {
    const ring = new THREE.Mesh(circle, reachMaterial);
    ring.rotation.set(x, y, 0);
    // Always ticked: the lead ring drives the spikes too, even off-screen.
    ring.frustumCulled = false;
    reach.add(ring);
  }
  // Lives in the room, not on the spinning Sphere, so the reach reads as fixed.
  enemy.mesh.parent?.add(reach);

  let open = 0;
  let last = performance.now();
  const lead = reach.children[0] as THREE.Mesh;
  lead.onBeforeRender = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    reach.position.copy(enemy.mesh.position);
    const inside = evaluateActorOrigin(enemy.spec.kind, constraint, vectorTuple(camera.position), vectorTuple(enemy.mesh.position)).allowed;
    open = THREE.MathUtils.clamp(open + (inside ? dt : -dt) * 5, 0, 1);
    // Hidden via opacity: an invisible object never gets this callback again.
    reachMaterial.opacity = enemy.mesh.visible ? 0.16 + open * 0.34 : 0;
    // Spikes sink into the body and shrink as you come within reach.
    for (const spike of spikes.children) {
      spike.position.copy(spike.userData.dir as THREE.Vector3).multiplyScalar(radius * (0.92 - open * 0.55));
      spike.scale.set(1 - open * 0.35, 1 - open * 0.8, 1 - open * 0.35);
    }
    spikeMaterial.emissiveIntensity = 0.9 - open * 0.5;
  };
}

function decorateDrifter(enemy: ActiveEnemy): void {
  const drift = enemy.spec.drift;
  if (!drift) return;
  const radius = enemy.spec.radius ?? 0.72;
  const axis = drift.axis;
  const direction = axisVector(axis).multiplyScalar(radius * 1.75);
  const geometry = new THREE.BufferGeometry().setFromPoints([
    direction.clone().multiplyScalar(-1),
    direction
  ]);
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: actorColor("drifter"),
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  enemy.mesh.add(line);
}

function utilityMessage(kind: EnemySpec["kind"]): string {
  if (kind === "cube") return "CUBE RESOLVED // BARRIER STATE CHANGED";
  if (kind === "diamond") return "DIAMOND RESOLVED // MOTION ONLINE";
  if (kind === "prism") return "PRISM RESOLVED // ENERGY REROUTED";
  return "WORLD STATE CHANGED";
}

function utilityImpactColor(kind: EnemySpec["kind"]): number {
  if (kind === "cube") return 0xf2f4ff;
  if (kind === "diamond") return 0xc8fff0;
  if (kind === "prism") return 0xffe8b2;
  return 0xd9feff;
}

function axisVector(axis: "x" | "y" | "z"): THREE.Vector3 {
  if (axis === "x") return new THREE.Vector3(1, 0, 0);
  if (axis === "y") return new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3(0, 0, 1);
}

function vectorTuple(vector: THREE.Vector3): [number, number, number] {
  return [vector.x, vector.y, vector.z];
}
