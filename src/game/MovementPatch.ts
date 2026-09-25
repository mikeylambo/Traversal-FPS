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
  depenetrate(position, position.y - eyeHeight, bodyHeight, platforms);
  moveAxis(position, "x", dx, eyeHeight, bodyHeight, platforms, allowStep);
  moveAxis(position, "z", dz, eyeHeight, bodyHeight, platforms, allowStep);
}

/**
 * Moving platforms, crouch-to-stand transitions and warp arrivals can leave the
 * body a few centimetres inside a wall. Push out along the shallowest side so the
 * player is never frozen in place.
 */
function depenetrate(position: THREE.Vector3, footY: number, bodyHeight: number, platforms: PlatformSpec[]): void {
  for (let pass = 0; pass < 3; pass += 1) {
    // Anything within step height is floor, owned by step/floor resolution.
    const hit = platforms.find((platform) =>
      platform.center[1] + platform.size[1] * 0.5 - footY > AUTO_STEP_HEIGHT &&
      penetration(position.x, position.z, footY, bodyHeight, platform) > 0.002);
    if (!hit) return;
    const [cx, , cz] = hit.center;
    const [sx, , sz] = hit.size;
    const exits = [
      { axis: "x" as const, value: cx - sx * 0.5 - PLAYER_RADIUS - 0.004 },
      { axis: "x" as const, value: cx + sx * 0.5 + PLAYER_RADIUS + 0.004 },
      { axis: "z" as const, value: cz - sz * 0.5 - PLAYER_RADIUS - 0.004 },
      { axis: "z" as const, value: cz + sz * 0.5 + PLAYER_RADIUS + 0.004 }
    ].map((exit) => ({ ...exit, distance: Math.abs(exit.value - position[exit.axis]) }))
      .filter((exit) => exit.distance <= 0.6)
      .sort((a, b) => a.distance - b.distance);
    const free = exits.find((exit) => {
      const x = exit.axis === "x" ? exit.value : position.x;
      const z = exit.axis === "z" ? exit.value : position.z;
      return !platforms.some((platform) => platform !== hit && penetration(x, z, footY, bodyHeight, platform) > 0.002);
    });
    if (!free) return;
    position[free.axis] = free.value;
  }
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

  const footY = position.y - eyeHeight;
  const at = (fraction: number) => ({
    x: axis === "x" ? position.x + delta * fraction : position.x,
    z: axis === "z" ? position.z + delta * fraction : position.z
  });
  const full = at(1);

  if (!moveBlocked(position.x, position.z, full.x, full.z, footY, bodyHeight, platforms)) {
    position[axis] += delta;
    return;
  }

  if (allowStep) {
    const step = findStep(full.x, full.z, axis, Math.sign(delta), footY, bodyHeight, platforms);
    if (step) {
      position.y += step.rise;
      position[axis] = step.settle;
      return;
    }
  }

  // Close the gap to the wall instead of stopping a full frame short of it;
  // a hovering gap is what makes corners feel sticky.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 5; i += 1) {
    const mid = (lo + hi) / 2;
    const probe = at(mid);
    if (moveBlocked(position.x, position.z, probe.x, probe.z, footY, bodyHeight, platforms)) hi = mid;
    else lo = mid;
  }
  position[axis] += delta * lo;
}

/**
 * Auto-step: the lip is detected under the body's leading edge (the centre is
 * still outside it when the capsule first touches), and the centre is then
 * settled onto the step so floor resolution keeps the player up there.
 */
function findStep(
  x: number,
  z: number,
  axis: "x" | "z",
  sign: number,
  footY: number,
  bodyHeight: number,
  platforms: PlatformSpec[]
): { rise: number; settle: number } | null {
  const lead = { x, z };
  lead[axis] += sign * PLAYER_RADIUS * 0.9;
  const candidates: { rise: number; platform: PlatformSpec }[] = [];

  for (const platform of platforms) {
    const [cx, cy, cz] = platform.center;
    const [sx, sy, sz] = platform.size;
    if (Math.abs(lead.x - cx) > sx * 0.5 || Math.abs(lead.z - cz) > sz * 0.5) continue;
    const rise = cy + sy * 0.5 - footY;
    if (rise > 0.025 && rise <= AUTO_STEP_HEIGHT) candidates.push({ rise, platform });
  }

  for (const { rise, platform } of candidates.sort((a, b) => a.rise - b.rise)) {
    const centre = platform.center[axis === "x" ? 0 : 2];
    const half = platform.size[axis === "x" ? 0 : 2] * 0.5;
    const current = axis === "x" ? x : z;
    const settle = THREE.MathUtils.clamp(current, centre - half + 0.02, centre + half - 0.02);
    const sx = axis === "x" ? settle : x;
    const sz = axis === "z" ? settle : z;
    if (Math.abs(settle - current) > PLAYER_RADIUS + 0.05) continue;
    if (bodyBlocked(sx, sz, footY + rise, bodyHeight, platforms)) continue;
    if (!supportedAt(sx, sz, footY + rise, platforms)) continue;
    return { rise, settle };
  }

  return null;
}

function supportedAt(x: number, z: number, footY: number, platforms: PlatformSpec[]): boolean {
  return platforms.some((platform) => {
    const [cx, cy, cz] = platform.center;
    const [sx, sy, sz] = platform.size;
    const top = cy + sy * 0.5;
    return Math.abs(top - footY) <= 0.035 &&
      Math.abs(x - cx) <= sx * 0.5 + 0.01 &&
      Math.abs(z - cz) <= sz * 0.5 + 0.01;
  });
}

/** Horizontal overlap depth of the body circle with a box, or 0 if clear. */
function penetration(x: number, z: number, footY: number, bodyHeight: number, platform: PlatformSpec): number {
  const [cx, cy, cz] = platform.center;
  const [sx, sy, sz] = platform.size;
  const playerBottom = footY + 0.045;
  const playerTop = footY + bodyHeight;
  const boxBottom = cy - sy * 0.5;
  const boxTop = cy + sy * 0.5;
  if (!(playerTop > boxBottom + 0.02 && playerBottom < boxTop - 0.02)) return 0;

  const nearestX = THREE.MathUtils.clamp(x, cx - sx * 0.5, cx + sx * 0.5);
  const nearestZ = THREE.MathUtils.clamp(z, cz - sz * 0.5, cz + sz * 0.5);
  const distance = Math.hypot(x - nearestX, z - nearestZ);
  return Math.max(0, PLAYER_RADIUS - distance);
}

function bodyBlocked(
  x: number,
  z: number,
  footY: number,
  bodyHeight: number,
  platforms: PlatformSpec[]
): boolean {
  return platforms.some((platform) => penetration(x, z, footY, bodyHeight, platform) > 0);
}

/**
 * A move is blocked only if it enters a box or goes deeper into one. Moving out
 * of an existing overlap is always allowed, so the body can never be pinned.
 */
function moveBlocked(
  fromX: number,
  fromZ: number,
  x: number,
  z: number,
  footY: number,
  bodyHeight: number,
  platforms: PlatformSpec[]
): boolean {
  return platforms.some((platform) => {
    const next = penetration(x, z, footY, bodyHeight, platform);
    if (next <= 0) return false;
    return next > penetration(fromX, fromZ, footY, bodyHeight, platform) - 0.0001;
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

/** Pure collision entry points, exported for the regression suite. */
export const movementCollisionForTests = { moveWithBodyCollision, resolveFloor };

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

    const top = cy + sy * 0.5;
    const standingY = top + eyeHeight;
    const deltaY = Math.abs(position.y - standingY);
    // A shallow Stop Short can end with the eye between the surface and standing
    // height. Floor resolution never catches that (it only sees falls from above
    // standing height), so the player would drop straight through the slab.
    const lowArrival = position.y > top + 0.05 && position.y < standingY;
    if (deltaY > WARP_LANDING_VERTICAL_CUSHION && !lowArrival) continue;
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
