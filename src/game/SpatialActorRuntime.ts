import * as THREE from "three";
import { emitTraversalAudio } from "../audio/TraversalAudio";
import { actorColor } from "./TraversalAccessibility";
import { evaluateActorOrigin, resolveOriginConstraint } from "../world/spatialActors";
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
    const originRule = evaluateActorOrigin(enemy.spec.kind, enemy.spec.originConstraint, origin);
    if (!originRule.allowed) {
      state.flashMessage(originRule.message ?? "TARGET REJECT // CHANGE YOUR FIRING ORIGIN", 1800);
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
        : "WARP VECTOR WRITTEN",
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
    const originRule = enemy
      ? evaluateActorOrigin(enemy.spec.kind, enemy.spec.originConstraint, vectorTuple(state.camera.position))
      : { allowed: true };
    const blocked = Boolean(enemy && !originRule.allowed);

    document.body.classList.toggle("target-hot", Boolean(enemy) && !blocked);
    document.body.classList.toggle("target-blocked", blocked);
    document.body.classList.toggle("target-utility", Boolean(enemy && UTILITY_KINDS.has(enemy.spec.kind)));
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    decorateActorVisuals(state.enemies);
  };

  installActorGeometryRuntime(game);
  installRoomAccentAccessibilityRuntime(game);
}

function decorateActorVisuals(enemies: ActiveEnemy[]): void {
  for (const enemy of enemies) {
    if (enemy.mesh.userData.traversalActorVisual) continue;
    enemy.mesh.userData.traversalActorVisual = true;

    if (enemy.spec.originConstraint || enemy.spec.kind === "shield") decorateOriginGate(enemy);
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
 * Any origin-gated Sphere wears a half shell over the side it cannot be hit
 * from, arrowheads pointing where you must fire from, and a dashed tether to
 * the world-space line you have to cross. Colour encodes the axis.
 */
function decorateOriginGate(enemy: ActiveEnemy): void {
  const constraint = resolveOriginConstraint(enemy.spec.kind, enemy.spec.originConstraint);
  if (!constraint) return;
  const radius = enemy.spec.radius ?? 0.72;
  const axis = constraint.axis;
  const threshold = constraint.min ?? constraint.max;
  const allowedSign = constraint.min !== undefined ? 1 : -1;
  const allowed = axisVector(axis).multiplyScalar(allowedSign);
  const color = GATE_COLORS[axis];
  const additive = (opacity: number, extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, ...extra
  });
  const up = new THREE.Vector3(0, 1, 0);

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.24, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    additive(0.3, { side: THREE.DoubleSide })
  );
  shell.quaternion.setFromUnitVectors(up, allowed.clone().negate());

  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.26, radius * 0.05, 8, 48), additive(0.9));
  rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), allowed);

  const arrows = new THREE.Group();
  for (let i = 0; i < 2; i += 1) {
    const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.26, radius * 0.42, 4), additive(0.85 - i * 0.3));
    head.quaternion.setFromUnitVectors(up, allowed);
    head.position.copy(allowed).multiplyScalar(radius * (1.75 + i * 0.5));
    arrows.add(head);
  }
  const started = performance.now();
  (arrows.children[0] as THREE.Mesh).onBeforeRender = () => {
    const t = ((performance.now() - started) / 900) % 1;
    arrows.position.copy(allowed).multiplyScalar(radius * 0.35 * Math.sin(t * Math.PI));
  };

  enemy.mesh.add(shell, rim, arrows);

  if (threshold === undefined) return;
  const marker = new THREE.Mesh(new THREE.RingGeometry(radius * 0.5, radius * 0.62, 32), additive(0.75, { side: THREE.DoubleSide }));
  marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), allowed);
  const tetherGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tether = new THREE.Line(tetherGeometry, new THREE.LineDashedMaterial({
    color, dashSize: 0.28, gapSize: 0.22, transparent: true, opacity: 0.6, depthWrite: false
  }));
  tether.frustumCulled = false;
  let lastOffset = Number.NaN;
  // Drifters move, so the world-space line is re-projected every frame.
  tether.onBeforeRender = () => {
    const offset = threshold - enemy.mesh.position[axis];
    if (Math.abs(offset - lastOffset) < 0.01) return;
    lastOffset = offset;
    const show = Math.abs(offset) > radius * 1.3 && Math.abs(offset) < 30;
    marker.visible = show;
    setAxisPosition(marker.position, axis, offset);
    const end = tetherGeometry.attributes.position as THREE.BufferAttribute;
    const start = axisVector(axis).multiplyScalar(radius * 1.26 * Math.sign(offset));
    end.setXYZ(0, start.x, start.y, start.z);
    end.setXYZ(1, marker.position.x, marker.position.y, marker.position.z);
    end.needsUpdate = true;
    tetherGeometry.computeBoundingSphere();
    tether.computeLineDistances();
    tether.material.opacity = show ? 0.6 : 0;
  };
  enemy.mesh.add(marker, tether);
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

function orientDisc(object: THREE.Object3D, axis: "x" | "y" | "z"): void {
  if (axis === "x") object.rotation.y = Math.PI * 0.5;
  if (axis === "y") object.rotation.x = Math.PI * 0.5;
}

function setAxisPosition(position: THREE.Vector3, axis: "x" | "y" | "z", value: number): void {
  position.set(0, 0, 0);
  position[axis] = value;
}

function axisVector(axis: "x" | "y" | "z"): THREE.Vector3 {
  if (axis === "x") return new THREE.Vector3(1, 0, 0);
  if (axis === "y") return new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3(0, 0, 1);
}

function vectorTuple(vector: THREE.Vector3): [number, number, number] {
  return [vector.x, vector.y, vector.z];
}
