import * as THREE from "three";
import { emitTraversalAudio } from "../audio/TraversalAudio";

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  velocityY: number;
  warpWasTransiting?: boolean;
  warp?: { isTransiting?(): boolean };
  updateMovement(dt: number, now: number): void;
  loadRoom(index: number): void;
};

/**
 * Landing foley only. Footsteps, crouch steps and crouch-stance foley were cut:
 * Traversal is warp-first with a deliberately sparse mix, so continuous on-foot
 * body sound added clutter for the movement mode players use least. A landing,
 * by contrast, is a discrete event that sells a real fall.
 */
export function installMovementAudioRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  const originalMove = state.updateMovement.bind(game);
  let initialized = false;
  let wasAirborne = false;
  let peakFallSpeed = 0;

  state.updateMovement = (dt: number, now: number) => {
    const beforeVelocityY = state.velocityY;
    const wasWarpTransiting = Boolean(state.warpWasTransiting);
    originalMove(dt, now);

    const body = document.body;
    const airborne = body.classList.contains("airborne");
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
      return;
    }

    if (airborne) peakFallSpeed = Math.max(peakFallSpeed, Math.max(0, -beforeVelocityY, -state.velocityY));

    if (wasAirborne && !airborne) {
      if (!warpPresentation && peakFallSpeed >= 2.4) {
        emitTraversalAudio(peakFallSpeed >= 7.25 ? "movement.land-heavy" : "movement.land-light");
      }
      peakFallSpeed = 0;
    }

    wasAirborne = airborne;
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    initialized = false;
    peakFallSpeed = 0;
  };
}
