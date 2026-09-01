import * as THREE from "three";
import { ROOMS, type PlatformSpec } from "../world/stages";

const STAND_EYE_HEIGHT = 1.7;
const CROUCH_EYE_HEIGHT = 1.06;
const HEAD_MARGIN = 0.16;
const PLAYER_RADIUS = 0.32;
const RUN_SPEED = 7.5;
const CROUCH_SPEED = 4.9;
const AUTO_STEP_HEIGHT = 0.38;
const BASE_GRAVITY = 18;
const WARP_LANDING_EDGE_CUSHION = 0.26;
const WARP_LANDING_VERTICAL_CUSHION = 0.72;

type MovementInput = {
  movement(): { x: number; z: number };
  isCrouchHeld(): boolean;
};

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  input: MovementInput;
  platformMeshes: THREE.Mesh[];
  roomIndex: number;
  roomRestarts: number;
  yaw: number;
  velocityY: number;
  airGraceUntil: number;
  gravityScalar: number;
  updateMovement: (dt: number, now: number) => void;
  loadRoom: (index: number) => void;
};

/**
 * Traversal deliberately has no conventional jump. Run/crouch handle local positioning;
 * the Warp Rifle owns meaningful elevation and gap traversal. A small automatic step-up
 * prevents tiny lips and stairs from creating fake reasons for a jump button.
 */
export function enhanceTraversalMovement(game: object): void {
  const state = game as unknown as RuntimeState;
  let eyeHeight = STAND_EYE_HEIGHT;
  let grounded = true;

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    eyeHeight = STAND_EYE_HEIGHT;
    grounded = true;
    document.body.classList.remove("crouching", "airborne");
  };

  state.updateMovement = (dt: number, now: number) => {
    const room = ROOMS[state.roomIndex];
    const platforms = resolveLivePlatforms(room.platforms, state.platformMeshes);
    const requestedCrouch = state.input.isCrouchHeld();
    const currentFootY = state.camera.position.y - eyeHeight;
    const standingBlocked = !requestedCrouch && !hasHeadroom(
      platforms,
      state.camera.position.x,
      state.camera.position.z,
      currentFootY
    );
    const crouching = requestedCrouch || standingBlocked;
    const targetEyeHeight = crouching ? CROUCH_EYE_HEIGHT : STAND_EYE_HEIGHT;

    // Keep the player's feet fixed while smoothly changing eye/body height.
    const crouchResponse = 1 - Math.exp(-17 * dt);
    const nextEyeHeight = THREE.MathUtils.lerp(eyeHeight, targetEyeHeight, crouchResponse);
    state.camera.position.y += nextEyeHeight - eyeHeight;
    eyeHeight = nextEyeHeight;
    document.body.classList.toggle("crouching", crouching || eyeHeight < 1.42);

    const move = state.input.movement();
    const forward = new THREE.Vector3(0, 0, -1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);
    const right = new THREE.Vector3(1, 0, 0)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);
    const direction = forward.multiplyScalar(move.z).add(right.multiplyScalar(move.x));
    const speed = crouching ? CROUCH_SPEED : RUN_SPEED;
    const bodyHeight = eyeHeight + HEAD_MARGIN;

    moveWithBodyCollision(
      state.camera.position,
      direction.x * speed * dt,
      direction.z * speed * dt,
      eyeHeight,
      bodyHeight,
      platforms,
      grounded && now >= state.airGraceUntil
    );

    const previousY = state.camera.position.y;
    if (now >= state.airGraceUntil) {
      state.velocityY -= BASE_GRAVITY * state.gravityScalar * dt;
      state.camera.position.y += state.velocityY * dt;
      const landed = resolveFloor(
        state.camera.position,
        previousY,
        eyeHeight,
        state.velocityY,
        platforms
      );
      grounded = landed;
      if (landed) state.velocityY = 0;
    } else {
      // Warp phase-hang is allowed when the endpoint is truly airborne, but an
      // endpoint visibly over a platform should settle cleanly instead of missing
      // because its center is a few centimeters outside the collision inset.
      const settled = resolveWarpArrival(state.camera.position, eyeHeight, platforms);
      if (settled) {
        state.velocityY = 0;
        state.airGraceUntil = 0;
        grounded = true;
      } else {
        state.velocityY = 0;
        grounded = false;
      }
    }

    document.body.classList.toggle("airborne", !grounded);

    // Deep authored spaces are valid level geometry. Reset only after the player
    // falls well below the lowest platform in the current construct.
    const lowestGeometry = platforms.reduce(
      (lowest, platform) => Math.min(lowest, platform.center[1] - platform.size[1] * 0.5),
      0
    );
    if (state.camera.position.y < lowestGeometry - 12) {
      state.roomRestarts += 1;
      state.loadRoom(state.roomIndex);
    }
  };
}

function resolveLivePlatforms(
  specs: PlatformSpec[],
  meshes: THREE.Mesh[]
): PlatformSpec[] {
  return specs.map((spec, index) => {
    const mesh = meshes[index];
    if (!mesh) return spec;
    return {
      ...spec,
      center: [mesh.position.x, mesh.position.y, mesh.position.z]
    };
  });
}

function moveWithBodyCollision(
  position: THREE.Vector3,
  dx: number,
  dz: number,
  eyeHeight: number,
  bodyHeight: number,
  platforms: PlatformSpec[],
  allowStep: boolean
): void {
  moveAxis(position, "x", dx, eyeHeight, bodyHeight, platforms, allowStep);
  moveAxis(position, "z", dz, eyeHeight, bodyHeight, platforms, allowStep);
}

function moveAxis(
  position: THREE.Vector3,
  axis: "x" | "z",
  delta: number,
  eyeHeight: number,
  bodyHeight: number,
  platforms: PlatformSpec[],
  allowStep: boolean
): void {
  if (Math.abs(delta) < 0.000001) return;

  const candidateX = axis === "x" ? position.x + delta : position.x;
  const candidateZ = axis === "z" ? position.z + delta : position.z;
  const footY = position.y - eyeHeight;

  if (!bodyBlocked(candidateX, candidateZ, footY, bodyHeight, platforms)) {
    position[axis] += delta;
    return;
  }

  if (!allowStep) return;
  const step = findStepHeight(candidateX, candidateZ, footY, bodyHeight, platforms);
  if (step === null) return;

  position.y += step;
  position[axis] += delta;
}

function findStepHeight(
  x: number,
  z: number,
  footY: number,
  bodyHeight: number,
  platforms: PlatformSpec[]
): number | null {
  const candidates = new Set<number>();

  for (const platform of platforms) {
    const [cx, cy, cz] = platform.center;
    const [sx, sy, sz] = platform.size;
    if (
      Math.abs(x - cx) > sx * 0.5 + PLAYER_RADIUS ||
      Math.abs(z - cz) > sz * 0.5 + PLAYER_RADIUS
    ) continue;

    const top = cy + sy * 0.5;
    const rise = top - footY;
    if (rise > 0.025 && rise <= AUTO_STEP_HEIGHT) candidates.add(Number(rise.toFixed(4)));
  }

  for (const rise of [...candidates].sort((a, b) => a - b)) {
    const raisedFoot = footY + rise;
    if (bodyBlocked(x, z, raisedFoot, bodyHeight, platforms)) continue;
    if (!supportedAt(x, z, raisedFoot, platforms)) continue;
    return rise;
  }

  return null;
}

function supportedAt(x: number, z: number, footY: number, platforms: PlatformSpec[]): boolean {
  return platforms.some((platform) => {
    const [cx, cy, cz] = platform.center;
    const [sx, sy, sz] = platform.size;
    const top = cy + sy * 0.5;
    return Math.abs(top - footY) <= 0.035 &&
      Math.abs(x - cx) <= sx * 0.5 - 0.03 &&
      Math.abs(z - cz) <= sz * 0.5 - 0.03;
  });
}

function bodyBlocked(
  x: number,
  z: number,
  footY: number,
  bodyHeight: number,
  platforms: PlatformSpec[]
): boolean {
  const playerBottom = footY + 0.045;
  const playerTop = footY + bodyHeight;

  return platforms.some((platform) => {
    const [cx, cy, cz] = platform.center;
    const [sx, sy, sz] = platform.size;
    const boxBottom = cy - sy * 0.5;
    const boxTop = cy + sy * 0.5;
    const verticalOverlap = playerTop > boxBottom + 0.02 && playerBottom < boxTop - 0.02;
    if (!verticalOverlap) return false;

    const nearestX = THREE.MathUtils.clamp(x, cx - sx * 0.5, cx + sx * 0.5);
    const nearestZ = THREE.MathUtils.clamp(z, cz - sz * 0.5, cz + sz * 0.5);
    const ddx = x - nearestX;
    const ddz = z - nearestZ;
    return ddx * ddx + ddz * ddz < PLAYER_RADIUS * PLAYER_RADIUS;
  });
}

function hasHeadroom(
  platforms: PlatformSpec[],
  x: number,
  z: number,
  footY: number
): boolean {
  const targetTop = footY + STAND_EYE_HEIGHT + HEAD_MARGIN;
  const playerBottom = footY + 0.08;

  return !platforms.some((platform) => {
    const [cx, cy, cz] = platform.center;
    const [sx, sy, sz] = platform.size;
    const boxBottom = cy - sy * 0.5;
    const boxTop = cy + sy * 0.5;
    if (targetTop <= boxBottom + 0.02 || playerBottom >= boxTop - 0.02) return false;

    return Math.abs(x - cx) <= sx * 0.5 + PLAYER_RADIUS &&
      Math.abs(z - cz) <= sz * 0.5 + PLAYER_RADIUS;
  });
}

function resolveWarpArrival(
  position: THREE.Vector3,
  eyeHeight: number,
  platforms: PlatformSpec[]
): boolean {
  let best: { platform: PlatformSpec; standingY: number; deltaY: number } | null = null;

  for (const platform of platforms) {
    const [cx, cy, cz] = platform.center;
    const [sx, sy, sz] = platform.size;
    const withinFootprint =
      Math.abs(position.x - cx) <= sx * 0.5 + WARP_LANDING_EDGE_CUSHION &&
      Math.abs(position.z - cz) <= sz * 0.5 + WARP_LANDING_EDGE_CUSHION;
    if (!withinFootprint) continue;

    const standingY = cy + sy * 0.5 + eyeHeight;
    const deltaY = Math.abs(position.y - standingY);
    if (deltaY > WARP_LANDING_VERTICAL_CUSHION) continue;
    if (!best || deltaY < best.deltaY) best = { platform, standingY, deltaY };
  }

  if (!best) return false;

  const [cx, , cz] = best.platform.center;
  const [sx, , sz] = best.platform.size;
  const safeHalfX = Math.max(0.05, sx * 0.5 - 0.12);
  const safeHalfZ = Math.max(0.05, sz * 0.5 - 0.12);
  position.x = THREE.MathUtils.clamp(position.x, cx - safeHalfX, cx + safeHalfX);
  position.z = THREE.MathUtils.clamp(position.z, cz - safeHalfZ, cz + safeHalfZ);
  position.y = best.standingY;
  return true;
}

function resolveFloor(
  position: THREE.Vector3,
  previousY: number,
  eyeHeight: number,
  velocityY: number,
  platforms: PlatformSpec[]
): boolean {
  if (velocityY > 0) return false;

  let bestStandingY = Number.NEGATIVE_INFINITY;
  for (const platform of platforms) {
    const [cx, cy, cz] = platform.center;
    const [sx, sy, sz] = platform.size;
    const inside =
      Math.abs(position.x - cx) <= sx * 0.5 + 0.08 &&
      Math.abs(position.z - cz) <= sz * 0.5 + 0.08;
    if (!inside) continue;

    const standingY = cy + sy * 0.5 + eyeHeight;
    if (
      position.y <= standingY + 0.32 &&
      previousY >= standingY - 0.72 &&
      standingY > bestStandingY
    ) {
      bestStandingY = standingY;
    }
  }

  if (!Number.isFinite(bestStandingY)) return false;
  position.y = bestStandingY;
  return true;
}
