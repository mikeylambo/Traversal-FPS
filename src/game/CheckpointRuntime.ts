import * as THREE from "three";
import { emitTraversalAudio } from "../audio/TraversalAudio";
import { ROOMS } from "../world/stages";

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  roomRoot: THREE.Group;
  modeId: string;
  roomIndex: number;
  runComplete: boolean;
  velocityY: number;
  airGraceUntil: number;
  pendingRoomResetAt: number;
  warpWasTransiting: boolean;
  warp: { reset(): void };
  input: { consumeReset(): boolean };
  flashMessage(message: string, duration: number): void;
  loadRoom(index: number): void;
  beginRun(): void;
  update(dt: number): void;
};

/** Fired when the player respawns at a checkpoint without reloading the room. */
export const CHECKPOINT_RESPAWN_EVENT = "traversal:checkpoint-respawn";

const REACH_RADIUS = 2.6;
const DOUBLE_TAP_MS = 700;
const IDLE = 0x7cefff;

/**
 * Checkpoints inside a Campaign sector. Walking into one makes it the respawn:
 * falls, hazards and Reset return you there with your progress kept (Spheres
 * stay destroyed) and collapsed floors restored, so the room is always finishable. Pressing Reset twice in
 * quick succession restarts the whole sector instead.
 */
export function installCheckpointRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  let markers: { mesh: THREE.Mesh; position: THREE.Vector3; reached: boolean }[] = [];
  let active: THREE.Vector3 | null = null;
  let roomIndex = -1;
  let resetPressedAt = 0;
  let lastResetPress = 0;
  let forceFullReload = false;

  const enabled = () => state.modeId === "standard";

  const consumeReset = state.input.consumeReset.bind(state.input);
  state.input.consumeReset = () => {
    if (!consumeReset()) return false;
    const now = performance.now();
    if (active && now - lastResetPress < DOUBLE_TAP_MS) forceFullReload = true;
    lastResetPress = now;
    resetPressedAt = now;
    return true;
  };

  const originalBeginRun = state.beginRun.bind(game);
  state.beginRun = () => {
    active = null;
    roomIndex = -1;
    originalBeginRun();
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    const respawn = enabled() && active && index === roomIndex && !state.runComplete && !forceFullReload;
    if (respawn && active) {
      state.camera.position.copy(active);
      state.velocityY = 0;
      state.airGraceUntil = 0;
      state.pendingRoomResetAt = 0;
      state.warpWasTransiting = false;
      state.warp.reset();
      // Floors come back so the remaining Spheres are always reachable from the
      // checkpoint; Sphere progress stays. Without this a collapsed floor could
      // strand the room and leave the menu as the only way out.
      window.dispatchEvent(new CustomEvent(CHECKPOINT_RESPAWN_EVENT));
      state.flashMessage("CHECKPOINT // RESET TWICE TO RESTART SECTOR", 1500);
      return;
    }
    forceFullReload = false;
    originalLoadRoom(index);
    roomIndex = index;
    active = null;
    markers = [];
    if (!enabled()) return;
    for (const point of ROOMS[index]?.checkpoints ?? []) {
      const position = new THREE.Vector3(...point);
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.15, 48),
        new THREE.MeshBasicMaterial({ color: IDLE, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(position.x, position.y - 1.66, position.z);
      state.roomRoot.add(mesh);
      markers.push({ mesh, position, reached: false });
    }
  };

  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    originalUpdate(dt);
    if (!enabled()) return;
    for (const marker of markers) {
      const material = marker.mesh.material as THREE.MeshBasicMaterial;
      if (!marker.reached && state.camera.position.distanceTo(marker.position) <= REACH_RADIUS) {
        marker.reached = true;
        active = marker.position.clone();
        emitTraversalAudio("sector.enter");
        state.flashMessage("CHECKPOINT", 1100);
      }
      const current = active !== null && marker.position.equals(active);
      material.opacity = current ? 0.55 + Math.sin(performance.now() * 0.004) * 0.15 : marker.reached ? 0.12 : 0.28;
      marker.mesh.scale.setScalar(current ? 1.1 : 1);
    }
  };
}
