import * as THREE from "three";
import { emitTraversalAudio } from "../audio/TraversalAudio";
import { ROOMS } from "../world/stages";

type RuntimeState = {
  roomIndex: number;
  roomKills: number;
  exactKills: boolean;
  goal: THREE.Mesh;
  goalMaterial: THREE.MeshBasicMaterial;
  goalLight: THREE.PointLight;
  loadRoom(index: number): void;
  updateHUD(): void;
};

const READY_COLOR = 0x78ffb2;
const LOCKED_COLOR = 0x263b46;

/**
 * The exit should never visually promise completion before the room is solved.
 * Keep the ring as dormant geometry until the required sphere count is met, then
 * activate it with a short spatial pulse + confirmation cue.
 */
export function installExitGateRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  let wasReady = false;
  let pulseStartedAt = 0;

  const sync = () => {
    const room = ROOMS[state.roomIndex];
    if (!room) return;
    const ready = state.exactKills
      ? state.roomKills === room.requiredKills
      : state.roomKills >= room.requiredKills;

    state.goalMaterial.color.setHex(ready ? READY_COLOR : LOCKED_COLOR);
    state.goalMaterial.opacity = ready ? 0.96 : 0.16;
    state.goalLight.color.setHex(READY_COLOR);
    state.goalLight.intensity = ready ? 4 : 0;
    document.body.classList.toggle("exit-ready", ready);
    document.body.classList.toggle("exit-locked", !ready);

    if (ready && !wasReady) {
      pulseStartedAt = performance.now();
      emitTraversalAudio("exit.activate");
      document.body.classList.remove("exit-activated");
      void document.body.offsetWidth;
      document.body.classList.add("exit-activated");
      window.setTimeout(() => document.body.classList.remove("exit-activated"), 620);
    }

    if (!ready) {
      state.goal.scale.setScalar(1);
      pulseStartedAt = 0;
    } else if (pulseStartedAt > 0) {
      const t = Math.min(1, (performance.now() - pulseStartedAt) / 560);
      const envelope = Math.sin(Math.PI * t) * (1 - t * 0.35);
      state.goal.scale.setScalar(1 + envelope * 0.34);
      state.goalMaterial.opacity = Math.min(1, 0.96 + envelope * 0.04);
      state.goalLight.intensity = 4 + envelope * 4.8;
      if (t >= 1) {
        pulseStartedAt = 0;
        state.goal.scale.setScalar(1);
      }
    }

    wasReady = ready;
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    wasReady = false;
    pulseStartedAt = 0;
    state.goal.scale.setScalar(1);
    originalLoadRoom(index);
    sync();
  };

  const originalHUD = state.updateHUD.bind(game);
  state.updateHUD = () => {
    originalHUD();
    sync();
  };

  sync();
}
