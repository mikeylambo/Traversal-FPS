import * as THREE from "three";
import { emitTraversalAudio } from "../audio/TraversalAudio";

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  velocityY: number;
  warpWasTransiting?: boolean;
  input: { movement(): { x: number; z: number } };
  warp?: { isTransiting?(): boolean };
  updateMovement(dt: number, now: number): void;
  loadRoom(index: number): void;
};

export function installMovementAudioRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  const originalMove = state.updateMovement.bind(game);
  let initialized = false;
  let wasAirborne = false;
  let wasCrouching = false;
  let stepDistance = 0;
  let peakFallSpeed = 0;

  state.updateMovement = (dt: number, now: number) => {
    const before = state.camera.position.clone();
    const beforeVelocityY = state.velocityY;
    const intent = state.input.movement();
    const wasWarpTransiting = Boolean(state.warpWasTransiting);
    originalMove(dt, now);

    const body = document.body;
    const airborne = body.classList.contains("airborne");
    const crouching = body.classList.contains("crouching");
    const transit = Boolean(state.warp?.isTransiting?.());
    // TraversalGame calls updateMovement on the first frame immediately after warp
    // transit ends, before it clears warpWasTransiting or applies the arrival body
    // class. Treat that one frame as warp presentation too so physical landing foley
    // can never double the authored Warp Arrival cue.
    const justWarpArrived = wasWarpTransiting && !transit;
    const warpPresentation = justWarpArrived || transit || body.classList.contains("warp-committed") || body.classList.contains("rewinding") || body.classList.contains("warp-arrival");

    if (!initialized) {
      initialized = true;
      wasAirborne = airborne;
      wasCrouching = crouching;
      return;
    }

    if (airborne) peakFallSpeed = Math.max(peakFallSpeed, Math.max(0, -beforeVelocityY, -state.velocityY));

    if (wasAirborne && !airborne) {
      if (!warpPresentation && peakFallSpeed >= 2.4) {
        emitTraversalAudio(peakFallSpeed >= 7.25 ? "movement.land-heavy" : "movement.land-light");
      }
      peakFallSpeed = 0;
      stepDistance = 0;
    }

    if (wasCrouching !== crouching && !airborne && !warpPresentation) {
      emitTraversalAudio(crouching ? "movement.crouch-down" : "movement.crouch-up");
    }

    const dx = state.camera.position.x - before.x;
    const dz = state.camera.position.z - before.z;
    const travelled = Math.hypot(dx, dz);
    const hasIntent = Math.hypot(intent.x, intent.z) > 0.14;
    if (!airborne && !warpPresentation && hasIntent && travelled < 1.5) {
      stepDistance += travelled;
      const stride = crouching ? 1.05 : 1.58;
      if (stepDistance >= stride) {
        stepDistance %= stride;
        emitTraversalAudio(crouching ? "movement.crouch-step" : "movement.footstep");
      }
    } else if (airborne || warpPresentation || travelled >= 1.5) {
      stepDistance = 0;
    }

    wasAirborne = airborne;
    wasCrouching = crouching;
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    initialized = false;
    stepDistance = 0;
    peakFallSpeed = 0;
  };
}
