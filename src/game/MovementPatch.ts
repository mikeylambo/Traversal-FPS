import * as THREE from "three";
import { ROOMS, type PlatformSpec } from "../world/stages";

const STAND_EYE_HEIGHT = 1.7;
const CROUCH_EYE_HEIGHT = 1.06;
const HEAD_MARGIN = 0.16;
const PLAYER_RADIUS = 0.32;
const RUN_SPEED = 7.5;
const CROUCH_SPEED = 4.9;
const JUMP_SPEED = 6.8;
const BASE_GRAVITY = 18;

type MovementInput = {
  movement(): { x: number; z: number };
  consumeJump(): boolean;
  isCrouchHeld(): boolean;
};

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  input: MovementInput;
  roomIndex: number;
  yaw: number;
  velocityY: number;
  airGraceUntil: number;
  gravityScalar: number;
  updateMovement: (dt: number, now: number) => void;
  loadRoom: (index: number) => void;
};

/**
 * Adds conventional FPS jump/crouch without turning them into warp substitutes.
 * It also upgrades the old floor-only resolver into a compact AABB player body so
 * future puzzle maps can use real walls, ceilings, and crouch-clearance routes.
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
    const requestedCrouch = state.input.isCrouchHeld();
    const currentFootY = state.camera.position.y - eyeHeight;
    const standingBlocked = !requestedCrouch && !hasHeadroom(
      room.platforms,
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
    const footY = state.camera.position.y - eyeHeight;

    moveWithBodyCollision(
      state.camera.position,
      direction.x * speed * dt,
      direction.z * speed * dt,
      footY,
      bodyHeight,
      room.platforms
    );

    const jumpPressed = state.input.consumeJump();
    if (jumpPressed && grounded && now >= state.airGraceUntil) {
      state.velocityY = JUMP_SPEED;
      grounded = false;
    }

    const previousY = state.camera.position.y;
    if (now >= state.airGraceUntil) {
      state.velocityY -= BASE_GRAVITY * state.gravityScalar * dt;
      let nextY = state.camera.position.y + state.velocityY * dt;

      if (state.velocityY > 0) {
        const ceiling = ceilingLimit(
          state.camera.position.x,
          state.camera.position.z,
          state.camera.position.y,
          nextY,
          eyeHeight,
          bodyHeight,
          room.platforms
        );
        if (ceiling !== null) {
          nextY = ceiling;
          state.velocityY = 0;
        }
      }

      state.camera.position.y = nextY;
      const landed = resolveFloor(
        state.camera.position,
        previousY,
        eyeHeight,
        state.velocityY,
        room.platforms
      );
      grounded = landed;
      if (landed) state.velocityY = 0;
    } else {
      // Warp phase-hang is intentionally airborne: it cannot be converted into a jump.
      state.velocityY = 0;
      grounded = false;
    }

    document.body.classList.toggle("airborne", !grounded);

    if (state.camera.position.y < -9.5) {
      // Preserve the existing room reset behavior by falling through the same threshold.
      // The core update notices this state on its next movement tick through loadRoom logic.
      state.camera.position.y = -10;
    }
  };
}

function moveWithBodyCollision(
  position: THREE.Vector3,
  dx: number,
  dz: number,
  footY: number,
  bodyHeight: number,
  platforms: PlatformSpec[]
): void {
  const nextX = position.x + dx;
  if (!bodyBlocked(nextX, position.z, footY, bodyHeight, platforms)) position.x = nextX;

  const nextZ = position.z + dz;
  if (!bodyBlocked(position.x, nextZ, footY, bodyHeight, platforms)) position.z = nextZ;
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

function ceilingLimit(
  x: number,
  z: number,
  currentCameraY: number,
  nextCameraY: number,
  eyeHeight: number,
  bodyHeight: number,
  platforms: PlatformSpec[]
): number | null {
  const headOffset = bodyHeight - eyeHeight;
  const currentHead = currentCameraY + headOffset;
  const nextHead = nextCameraY + headOffset;
  let limit: number | null = null;

  for (const platform of platforms) {
    const [cx, cy, cz] = platform.center;
    const [sx, sy, sz] = platform.size;
    if (Math.abs(x - cx) > sx * 0.5 + PLAYER_RADIUS ||
        Math.abs(z - cz) > sz * 0.5 + PLAYER_RADIUS) continue;

    const underside = cy - sy * 0.5;
    if (currentHead <= underside && nextHead >= underside) {
      const cameraLimit = underside - headOffset - 0.025;
      limit = limit === null ? cameraLimit : Math.min(limit, cameraLimit);
    }
  }

  return limit;
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
      Math.abs(position.x - cx) <= sx * 0.5 - 0.05 &&
      Math.abs(position.z - cz) <= sz * 0.5 - 0.05;
    if (!inside) continue;

    const standingY = cy + sy * 0.5 + eyeHeight;
    if (
      position.y <= standingY + 0.22 &&
      previousY >= standingY - 0.52 &&
      standingY > bestStandingY
    ) {
      bestStandingY = standingY;
    }
  }

  if (!Number.isFinite(bestStandingY)) return false;
  position.y = bestStandingY;
  return true;
}
