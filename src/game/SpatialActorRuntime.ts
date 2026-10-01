import * as THREE from "three";
import { emitTraversalAudio } from "../audio/TraversalAudio";
import { actorColor } from "./TraversalAccessibility";
import { evaluateActorOrigin, resolveOriginConstraint, type ProximityConstraint } from "../world/spatialActors";
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
      // Out of reach: the mace's spikes already say so. No text, just the bounce.
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
    const blocked = Boolean(enemy && !evaluateActorOrigin(enemy.spec.kind, enemy.spec.originConstraint, vectorTuple(state.camera.position), vectorTuple(enemy.mesh.position)).allowed);
    document.body.classList.toggle("target-hot", Boolean(enemy) && !blocked);
    document.body.classList.toggle("target-blocked", blocked);
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

function decorateActorVisuals(enemies: ActiveEnemy[], camera: THREE.Camera): void {
  for (const enemy of enemies) {
    if (enemy.mesh.userData.traversalActorVisual) continue;
    enemy.mesh.userData.traversalActorVisual = true;

    const constraint = resolveOriginConstraint(enemy.spec.kind, enemy.spec.originConstraint);
    if (constraint) decorateProximityGate(enemy, constraint, camera);
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

const PROXIMITY_COLOR = 0xff8f7a;

/**
 * A proximity Sphere is a mace: spikes out while you are too far away, folded
 * into the body once you are inside its reach. The spikes are the whole signal;
 * no rings or text clutter the view.
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

  // Initial pose, so the first frame never shows spikes at the origin.
  for (const spike of spikes.children) spike.position.copy(spike.userData.dir as THREE.Vector3).multiplyScalar(radius * 0.92);

  let open = 0;
  let last = performance.now();
  const lead = spikes.children[0] as THREE.Mesh;
  // Ticked off-screen too, so the fold state is right the moment you look back.
  lead.frustumCulled = false;
  lead.onBeforeRender = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const inside = evaluateActorOrigin(enemy.spec.kind, constraint, vectorTuple(camera.position), vectorTuple(enemy.mesh.position)).allowed;
    open = THREE.MathUtils.clamp(open + (inside ? dt : -dt) * 5, 0, 1);
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
