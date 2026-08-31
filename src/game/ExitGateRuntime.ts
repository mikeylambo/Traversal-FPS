import * as THREE from "three";
import { ROOMS } from "../world/stages";

type RuntimeState = {
  roomIndex: number;
  roomKills: number;
  exactKills: boolean;
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
 * activate it unmistakably.
 */
export function installExitGateRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  let wasReady = false;

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
      document.body.classList.remove("exit-activated");
      void document.body.offsetWidth;
      document.body.classList.add("exit-activated");
      window.setTimeout(() => document.body.classList.remove("exit-activated"), 520);
    }
    wasReady = ready;
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    wasReady = false;
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
