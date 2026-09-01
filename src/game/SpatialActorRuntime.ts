import * as THREE from "three";
import { evaluateActorOrigin, resolveOriginConstraint } from "../world/spatialActors";
import { ROOMS, type EnemySpec, type PlatformSpec, type SpatialDeviceSpec } from "../world/stages";

type ActiveEnemy = {
  spec: EnemySpec;
  mesh: THREE.Mesh;
  alive: boolean;
};

type PlatformBinding = {
  spec: PlatformSpec;
  mesh: THREE.Mesh;
  edge?: THREE.LineSegments;
  base: THREE.Vector3;
};

type ActiveDevice = {
  spec: SpatialDeviceSpec;
  mesh: THREE.Mesh;
  active: boolean;
  progress: number;
  target: number;
};

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  roomRoot: THREE.Group;
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
  update(dt: number): void;
  updateTargetReticle(): void;
  loadRoom(index: number): void;
  wastedShots(): number;
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
 * Sphere remains Traversal's only movement actor. Cube, Diamond and Prism are
 * deliberately non-warping spatial devices: they change the room, never the
 * player's coordinate directly.
 *
 * CUBE    = discrete geometry state switch
 * DIAMOND = animated geometry motion
 * PRISM   = energy/sightline routing
 */
export function installSpatialActorRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  let devices: ActiveDevice[] = [];
  let platformBindings: PlatformBinding[] = [];
  let deviceShots = 0;

  const baseWastedShots = state.wastedShots.bind(game);
  state.wastedShots = () => Math.max(0, baseWastedShots() - deviceShots);

  state.shoot = () => {
    const now = performance.now();
    if (now < state.fireReadyAt || state.runComplete || state.pendingRoomResetAt > 0) return;

    state.fireReadyAt = now + 105;
    state.shots += 1;
    state.weapon.fire();
    state.playShot();
    state.addMuzzleFx();

    const room = ROOMS[state.roomIndex];
    state.raycaster.setFromCamera(new THREE.Vector2(0, 0), state.camera);

    const liveMeshes = state.enemies
      .filter((enemy) => enemy.alive)
      .map((enemy) => enemy.mesh);
    const deviceMeshes = devices.map((device) => device.mesh);
    const hit = state.raycaster.intersectObjects(
      [...liveMeshes, ...deviceMeshes, ...state.platformMeshes],
      false
    )[0];

    const direction = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(state.camera.quaternion);
    const endPoint = hit?.point.clone() ?? state.camera.position
      .clone()
      .add(direction.multiplyScalar(120));
    state.addShotTrace(endPoint);

    if (!hit) {
      state.roomShots += 1;
      state.enforceChallengeShotBudget(now);
      return;
    }

    const device = devices.find((candidate) => candidate.mesh === hit.object);
    if (device) {
      deviceShots += 1;
      state.targetHits += 1;
      toggleDevice(device, room, platformBindings);
      state.addImpactFx(hit.point.clone(), deviceColor(device.spec.kind));
      state.flashMessage(deviceMessage(device), 1250);
      return;
    }

    state.roomShots += 1;
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
    const deviceMeshes = devices.map((device) => device.mesh);
    const hit = state.raycaster.intersectObjects(
      [...liveMeshes, ...deviceMeshes, ...state.platformMeshes],
      false
    )[0];

    const device = hit ? devices.find((candidate) => candidate.mesh === hit.object) : undefined;
    const enemy = hit
      ? state.enemies.find((candidate) => candidate.mesh === hit.object)
      : undefined;
    const originRule = enemy
      ? evaluateActorOrigin(enemy.spec.kind, enemy.spec.originConstraint, vectorTuple(state.camera.position))
      : { allowed: true };
    const blocked = Boolean(enemy && !originRule.allowed);

    document.body.classList.toggle("target-hot", Boolean(enemy || device) && !blocked);
    document.body.classList.toggle("target-blocked", blocked);
  };

  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    updateDevices(devices, platformBindings, dt);
    originalUpdate(dt);
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    devices = [];
    platformBindings = [];
    if (index === 0 && state.shots === 0) deviceShots = 0;

    originalLoadRoom(index);
    decorateActorVisuals(state.enemies);

    const room = ROOMS[index];
    platformBindings = bindPlatforms(state.roomRoot, room.platforms, state.platformMeshes);
    for (const spec of room.actors ?? []) {
      const device = createDevice(state.roomRoot, spec);
      devices.push(device);
      applyDeviceState(device, room, platformBindings, true);
    }
  };
}

function createDevice(root: THREE.Group, spec: SpatialDeviceSpec): ActiveDevice {
  const radius = spec.radius ?? 0.82;
  const color = deviceColor(spec.kind);
  const geometry = spec.kind === "cube"
    ? new THREE.BoxGeometry(radius * 1.55, radius * 1.55, radius * 1.55)
    : spec.kind === "diamond"
      ? new THREE.OctahedronGeometry(radius, 0)
      : new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, radius * 1.8, 3);

  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.34,
    roughness: 0.24,
    metalness: 0.48
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...spec.position);
  if (spec.kind === "prism") mesh.rotation.z = Math.PI * 0.5;
  mesh.userData.traversalSpatialDevice = spec.kind;
  mesh.userData.traversalSpatialDeviceId = spec.id;

  const shell = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 })
  );
  shell.scale.setScalar(1.14);
  mesh.add(shell);

  root.add(mesh);
  const active = Boolean(spec.startsOn);
  return { spec, mesh, active, progress: active ? 1 : 0, target: active ? 1 : 0 };
}

function toggleDevice(device: ActiveDevice, room: (typeof ROOMS)[number], bindings: PlatformBinding[]): void {
  device.active = !device.active;
  device.target = device.active ? 1 : 0;
  if (device.spec.kind !== "diamond") device.progress = device.target;
  applyDeviceState(device, room, bindings, false);
}

function updateDevices(devices: ActiveDevice[], bindings: PlatformBinding[], dt: number): void {
  for (const device of devices) {
    device.mesh.rotation.y += dt * (device.spec.kind === "diamond" ? 1.65 : 0.72);
    if (device.spec.kind === "prism") device.mesh.rotation.x += dt * 0.32;
    if (device.spec.kind !== "diamond") continue;

    const duration = Math.max(0.12, device.spec.moveDuration ?? 0.9);
    const step = dt / duration;
    device.progress = THREE.MathUtils.clamp(
      device.progress + Math.sign(device.target - device.progress) * step,
      0,
      1
    );
    if (Math.abs(device.progress - device.target) < step) device.progress = device.target;
    positionGroup(device, bindings, smoothstep(device.progress));
  }
}

function applyDeviceState(
  device: ActiveDevice,
  room: (typeof ROOMS)[number],
  bindings: PlatformBinding[],
  initial: boolean
): void {
  if (device.spec.kind === "cube") {
    positionGroup(device, bindings, device.active ? 1 : 0);
    pulseDevice(device, initial ? 0.25 : 0.62);
    return;
  }

  if (device.spec.kind === "diamond") {
    if (initial) positionGroup(device, bindings, device.progress);
    pulseDevice(device, initial ? 0.25 : 0.62);
    return;
  }

  for (const hazard of room.hazards ?? []) {
    if (hazard.group !== device.spec.targetGroup || hazard.kind !== "sightline-gate") continue;
    const cycle = hazard.cycle ?? { period: 2.4, openFor: 0.85, phase: 0 };
    const original = (hazard as typeof hazard & { __prismCycle?: typeof cycle }).__prismCycle ?? { ...cycle };
    (hazard as typeof hazard & { __prismCycle?: typeof cycle }).__prismCycle = original;
    hazard.cycle = device.active
      ? { ...cycle, period: original.period, openFor: original.period }
      : { ...original };
  }
  pulseDevice(device, initial ? 0.25 : 0.62);
}

function positionGroup(device: ActiveDevice, bindings: PlatformBinding[], amount: number): void {
  const offset = new THREE.Vector3(...(device.spec.moveOffset ?? [0, 0, 0]));
  for (const binding of bindings) {
    if (binding.spec.group !== device.spec.targetGroup) continue;
    const next = binding.base.clone().addScaledVector(offset, amount);
    binding.spec.center = [next.x, next.y, next.z];
    binding.mesh.position.copy(next);
    binding.edge?.position.copy(next);
  }
}

function bindPlatforms(root: THREE.Group, specs: PlatformSpec[], meshes: THREE.Mesh[]): PlatformBinding[] {
  return specs.map((spec, index) => {
    const mesh = meshes[index]!;
    const edge = root.children.find((child) =>
      child instanceof THREE.LineSegments &&
      child.position.distanceTo(mesh.position) < 0.001
    ) as THREE.LineSegments | undefined;
    return { spec, mesh, edge, base: new THREE.Vector3(...spec.center) };
  });
}

function pulseDevice(device: ActiveDevice, intensity: number): void {
  const material = device.mesh.material as THREE.MeshStandardMaterial;
  material.emissiveIntensity = intensity;
  window.setTimeout(() => {
    if (material) material.emissiveIntensity = device.active ? 0.48 : 0.26;
  }, 180);
}

function deviceMessage(device: ActiveDevice): string {
  const state = device.active ? "ON" : "OFF";
  if (device.spec.kind === "cube") return `CUBE // STATE ${state}`;
  if (device.spec.kind === "diamond") return `DIAMOND // MOTION ${state}`;
  return `PRISM // ENERGY ROUTE ${state}`;
}

function deviceColor(kind: SpatialDeviceSpec["kind"]): number {
  if (kind === "cube") return 0x89f7c4;
  if (kind === "diamond") return 0xffd36d;
  return 0xb9a1ff;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
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