import * as THREE from "three";
import { evaluateActorOrigin, resolveOriginConstraint } from "../world/spatialActors";
import { ROOMS, type EnemySpec } from "../world/stages";

type ActiveEnemy = {
  spec: EnemySpec;
  mesh: THREE.Mesh;
  base: THREE.Vector3;
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
  updateEnemies(time: number): void;
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
 * Declarative spatial-actor runtime. v0.12 prototypes Orbit and Phase here so
 * their behavior stays actor-local and Campaign geometry does not own mechanics.
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

    if (enemy.spec.kind === "phase" && !isPhaseOpen(enemy)) {
      state.flashMessage("PHASE CLOSED // WAIT FOR SOLID CORE", 1300);
      state.playShieldReject();
      state.addImpactFx(hit.point.clone(), 0xa98bff);
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
    const phaseBlocked = Boolean(enemy?.spec.kind === "phase" && !isPhaseOpen(enemy));
    const blocked = Boolean(enemy && (!originRule.allowed || phaseBlocked));

    document.body.classList.toggle("target-hot", Boolean(enemy) && !blocked);
    document.body.classList.toggle("target-blocked", blocked);
  };

  const originalUpdateEnemies = state.updateEnemies.bind(game);
  state.updateEnemies = (time: number) => {
    originalUpdateEnemies(time);
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      if (enemy.spec.kind === "orbit" && enemy.spec.orbit) updateOrbit(enemy, time);
      if (enemy.spec.kind === "phase" && enemy.spec.phase) updatePhase(enemy, time);
    }
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    decorateActorVisuals(state.enemies);
  };
}

function updateOrbit(enemy: ActiveEnemy, time: number): void {
  const orbit = enemy.spec.orbit;
  if (!orbit) return;
  const angle = time * orbit.speed + (orbit.phase ?? 0);
  enemy.mesh.position.copy(enemy.base);
  if (orbit.plane === "xy") {
    enemy.mesh.position.x += Math.cos(angle) * orbit.radius;
    enemy.mesh.position.y += Math.sin(angle) * orbit.radius;
  } else {
    enemy.mesh.position.x += Math.cos(angle) * orbit.radius;
    enemy.mesh.position.z += Math.sin(angle) * orbit.radius;
  }
  const ring = enemy.mesh.userData.orbitRing as THREE.Object3D | undefined;
  if (ring) ring.rotation.z = -angle * 0.55;
}

function updatePhase(enemy: ActiveEnemy, time: number): void {
  const phase = enemy.spec.phase;
  if (!phase) return;
  const local = positiveModulo(time + (phase.phase ?? 0), phase.period);
  const open = local < phase.openFor;
  enemy.mesh.userData.phaseOpen = open;

  const material = enemy.mesh.material as THREE.MeshStandardMaterial;
  material.transparent = true;
  material.opacity = open ? 1 : 0.24;
  material.emissiveIntensity = open ? 0.72 : 0.12;

  const halo = enemy.mesh.userData.phaseHalo as THREE.Mesh | undefined;
  if (halo) {
    const haloMaterial = halo.material as THREE.MeshBasicMaterial;
    haloMaterial.opacity = open ? 0.92 : 0.28;
    halo.scale.setScalar(open ? 1.08 : 1.35);
    halo.rotation.z += open ? 0.045 : 0.012;
  }
}

function isPhaseOpen(enemy: ActiveEnemy): boolean {
  return enemy.spec.kind !== "phase" || enemy.mesh.userData.phaseOpen === true;
}

function decorateActorVisuals(enemies: ActiveEnemy[]): void {
  for (const enemy of enemies) {
    if (enemy.mesh.userData.traversalActorVisual) continue;
    enemy.mesh.userData.traversalActorVisual = true;

    if (enemy.spec.kind === "shield") decorateShield(enemy);
    if (enemy.spec.kind === "drifter") decorateDrifter(enemy);
    if (enemy.spec.kind === "orbit") decorateOrbit(enemy);
    if (enemy.spec.kind === "phase") decoratePhase(enemy);
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

function decorateOrbit(enemy: ActiveEnemy): void {
  const radius = enemy.spec.radius ?? 0.72;
  const material = enemy.mesh.material as THREE.MeshStandardMaterial;
  material.color.setHex(0xffd86d);
  material.emissive.setHex(0xffb84f);

  const ring = new THREE.Group();
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffe7a0,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const a = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.35, radius * 0.045, 7, 36), ringMaterial);
  const b = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.35, radius * 0.045, 7, 36), ringMaterial.clone());
  b.rotation.x = Math.PI * 0.5;
  ring.add(a, b);
  enemy.mesh.add(ring);
  enemy.mesh.userData.orbitRing = ring;
}

function decoratePhase(enemy: ActiveEnemy): void {
  const radius = enemy.spec.radius ?? 0.72;
  const material = enemy.mesh.material as THREE.MeshStandardMaterial;
  material.color.setHex(0xb69cff);
  material.emissive.setHex(0x8d6cff);
  material.transparent = true;

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.38, radius * 0.06, 8, 40),
    new THREE.MeshBasicMaterial({
      color: 0xd3c8ff,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  halo.rotation.x = Math.PI * 0.28;
  halo.rotation.y = Math.PI * 0.18;
  enemy.mesh.add(halo);
  enemy.mesh.userData.phaseHalo = halo;
  enemy.mesh.userData.phaseOpen = false;
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

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}
