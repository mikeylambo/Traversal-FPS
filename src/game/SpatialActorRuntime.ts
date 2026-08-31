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

/**
 * Replaces the prototype Shield-only targeting branch with the declarative actor
 * schema. Any implemented actor can now carry an origin constraint without adding
 * another hardcoded condition to TraversalGame. Actor identity is also reinforced
 * by silhouette so color is never the only way to read spatial behavior.
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

    const deathPosition = enemy.mesh.position.clone();
    enemy.alive = false;
    enemy.mesh.visible = false;
    state.roomKills += 1;
    state.totalKills += 1;
    state.addKillFx(deathPosition, enemy.spec.kind);
    state.playKill();

    if (state.exactKills && state.roomKills > room.requiredKills) {
      state.failChallenge("CLEAN ROUTE FAILED // EXTRA KILL", now);
      return;
    }

    if (state.enforceChallengeShotBudget(now)) return;

    state.warp.write(state.camera.position.clone(), deathPosition);
    state.playVectorWritten();
    state.flashMessage(
      state.roomKills > room.requiredKills
        ? "EXTRA KILL // ROUTE EFFICIENCY DOWN"
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
  }
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

function orientDisc(object: THREE.Object3D, axis: "x" | "y" | "z"): void {
  // Circle/Torus geometries face +Z by default.
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
