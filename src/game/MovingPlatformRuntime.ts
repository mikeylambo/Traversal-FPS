import * as THREE from "three";
import { ROOMS, type PlatformSpec, type PuzzleEffect } from "../world/stages";

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  platformMeshes: THREE.Mesh[];
  roomRoot: THREE.Group;
  roomIndex: number;
  velocityY: number;
  loadRoom(index: number): void;
  update(dt: number): void;
  resolvePlatforms(previousY: number): void;
};

type ActiveMovingPlatform = {
  spec: PlatformSpec;
  mesh: THREE.Mesh;
  base: THREE.Vector3;
  previous: THREE.Vector3;
  edge?: THREE.Object3D;
  active: boolean;
  startedAt: number;
};

type PuzzleActorEvent = CustomEvent<{ effect?: PuzzleEffect }>;

export function installMovingPlatformRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  let moving: ActiveMovingPlatform[] = [];

  window.addEventListener("traversal:puzzle-actor", ((event: Event) => {
    const effect = (event as PuzzleActorEvent).detail?.effect;
    if (!effect || effect.type !== "activate-platform") return;
    for (const platform of moving) {
      if (!platform.spec.id || !effect.targetIds.includes(platform.spec.id)) continue;
      platform.active = true;
      platform.startedAt = performance.now() * 0.001;
      platform.mesh.userData.motionActive = true;
    }
  }) as EventListener);

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    moving = [];
    const room = ROOMS[index];
    if (!room) return;

    room.platforms.forEach((spec, platformIndex) => {
      if (!spec.motion) return;
      const mesh = state.platformMeshes[platformIndex];
      if (!mesh) return;
      const edge = nearestEdgeAtPosition(state.roomRoot, mesh.position, mesh);
      const active = spec.motion.active ?? true;
      const now = performance.now() * 0.001;
      mesh.userData.motionActive = active;
      mesh.userData.traversalPlatformId = spec.id;
      moving.push({
        spec,
        mesh,
        base: mesh.position.clone(),
        previous: mesh.position.clone(),
        edge,
        active,
        startedAt: now
      });
    });
  };

  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    updateMovingPlatforms(state, moving, performance.now() * 0.001);
    originalUpdate(dt);
  };

  state.resolvePlatforms = (previousY: number) => {
    const room = ROOMS[state.roomIndex];
    if (!room) return;

    for (let index = 0; index < room.platforms.length; index += 1) {
      const platform = room.platforms[index]!;
      const mesh = state.platformMeshes[index];
      const [sx, sy, sz] = platform.size;
      const center = mesh?.position ?? new THREE.Vector3(...platform.center);
      const inside =
        Math.abs(state.camera.position.x - center.x) <= sx * 0.5 - 0.12 &&
        Math.abs(state.camera.position.z - center.z) <= sz * 0.5 - 0.12;
      if (!inside) continue;

      const standingY = center.y + sy * 0.5 + 1.7;
      const movingEntry = moving.find((candidate) => candidate.mesh === mesh);
      const previousStandingY = movingEntry
        ? movingEntry.previous.y + sy * 0.5 + 1.7
        : standingY;
      const highestTop = Math.max(standingY, previousStandingY);
      const lowestTop = Math.min(standingY, previousStandingY);

      // Resolve against the swept deck instead of a single-frame top plane. This
      // prevents the player from tunneling through an elevator while both the player
      // and deck are moving vertically in opposite directions.
      const crossedDeck =
        state.velocityY <= 0 &&
        previousY >= lowestTop - 0.72 &&
        state.camera.position.y <= highestTop + 0.36;
      const alreadyOnDeck =
        Math.abs(state.camera.position.y - standingY) <= 0.42 &&
        previousY >= lowestTop - 0.72;

      if (crossedDeck || alreadyOnDeck) {
        state.camera.position.y = standingY;
        state.velocityY = 0;
        return;
      }
    }
  };
}

function updateMovingPlatforms(
  state: RuntimeState,
  moving: ActiveMovingPlatform[],
  time: number
): void {
  for (const platform of moving) {
    platform.previous.copy(platform.mesh.position);
    if (!platform.active || !platform.spec.motion) continue;

    const motion = platform.spec.motion;
    const localTime = Math.max(0, time - platform.startedAt);
    const offset = Math.sin(localTime * motion.speed * Math.PI * 2 + (motion.phase ?? 0)) * motion.amplitude;
    platform.mesh.position.copy(platform.base);
    platform.mesh.position[motion.axis] += offset;

    const delta = platform.mesh.position.clone().sub(platform.previous);
    if (platform.edge) platform.edge.position.add(delta);
    if (delta.lengthSq() <= 0.0000001) continue;

    const [sx, sy, sz] = platform.spec.size;
    const oldStandingY = platform.previous.y + sy * 0.5 + 1.7;
    const onDeck =
      Math.abs(state.camera.position.x - platform.previous.x) <= sx * 0.5 - 0.18 &&
      Math.abs(state.camera.position.z - platform.previous.z) <= sz * 0.5 - 0.18 &&
      Math.abs(state.camera.position.y - oldStandingY) <= 0.48;

    if (onDeck) state.camera.position.add(delta);
  }
}

function nearestEdgeAtPosition(
  root: THREE.Group,
  position: THREE.Vector3,
  mesh: THREE.Mesh
): THREE.Object3D | undefined {
  let best: THREE.Object3D | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const child of root.children) {
    if (child === mesh || !(child instanceof THREE.LineSegments)) continue;
    const distance = child.position.distanceToSquared(position);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = child;
    }
  }
  return bestDistance < 0.01 ? best : undefined;
}
