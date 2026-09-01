import * as THREE from "three";
import { evaluateActorOrigin, resolveOriginConstraint } from "../world/spatialActors";
import { ROOMS, type EnemySpec } from "../world/stages";

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
      // Utility hits are intentional puzzle actions, not challenge-mode misses.
      state.roomShots = Math.max(0, state.roomShots - 1);
      state.addImpactFx(hitPosition, utilityImpactColor(enemy.spec.kind));
      state.playKill();
      const message = utilityMessage(enemy.spec.kind);
      state.flashMessage(message, 1500);
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
}

function decorateActorVisuals(enemies: ActiveEnemy[]): void {
  for (const enemy of enemies) {
    if (enemy.mesh.userData.traversalActorVisual) continue;
    enemy.mesh.userData.traversalActorVisual = true;

    if (enemy.spec.kind === "shield") decorateShield(enemy);
    if (enemy.spec.kind === "drifter") decorateDrifter(enemy);
    if (enemy.spec.kind === "orbit") decorateOrbit(enemy);
    if (enemy.spec.kind === "cube") decorateUtility(enemy, "cube");
    if (enemy.spec.kind === "diamond") decorateUtility(enemy, "diamond");
    if (enemy.spec.kind === "prism") decorateUtility(enemy, "prism");
  }
}

function decorateUtility(enemy: ActiveEnemy, kind: "cube" | "diamond" | "prism"): void {
  const radius = enemy.spec.radius ?? 0.72;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.42, radius * 0.045, 8, kind === "prism" ? 3 : 36),
    new THREE.MeshBasicMaterial({
      color: 0xf2fbff,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  ring.rotation.x = kind === "diamond" ? Math.PI * 0.5 : 0;
  ring.rotation.z = kind === "prism" ? Math.PI / 6 : 0;
  enemy.mesh.add(ring);
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

function decorateShield(enemy: ActiveEnemy): void {
  const radius = enemy.spec.radius ?? 0.72;
  const constraint = resolveOriginConstraint(enemy.spec.kind, enemy.spec.originConstraint);
  const axis = constraint?.axis ?? "x";
  const blockedSign = constraint?.min !== undefined ? -1 : 1;

  const material = new THREE.MeshBasicMaterial({
    color: 0xffc48a,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const plate = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.18, 28), material);
  orientDisc(plate, axis);
  setAxisPosition(plate.position, axis, blockedSign * radius * 0.86);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.22, radius * 0.045, 8, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffd6ad,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  orientDisc(rim, axis);
  setAxisPosition(rim.position, axis, blockedSign * radius * 0.9);

  enemy.mesh.add(plate, rim);
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
      color: 0xffb4e5,
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
