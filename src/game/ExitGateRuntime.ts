import * as THREE from "three";
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
  flashMessage(message: string, duration: number): void;
};

const READY_COLOR = 0x78ffb2;
const LOCKED_COLOR = 0x263b46;

/**
 * Gravity Rings are the only sector exits. They remain dormant until the required
 * sphere count is resolved, then visibly spool up as the destination to advance.
 */
export function installExitGateRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  let wasReady = false;
  decorateGravityRing(state.goal);

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
    state.goal.userData.gravityRingReady = ready;
    document.body.classList.toggle("gravity-ring-ready", ready);
    document.body.classList.toggle("gravity-ring-locked", !ready);
    // Compatibility for existing presentation CSS.
    document.body.classList.toggle("exit-ready", ready);
    document.body.classList.toggle("exit-locked", !ready);

    for (const child of state.goal.children) {
      const material = child instanceof THREE.Mesh ? child.material : undefined;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = ready ? 0.7 : 0.08;
      }
    }

    if (ready && !wasReady) {
      document.body.classList.remove("exit-activated");
      void document.body.offsetWidth;
      document.body.classList.add("exit-activated");
      state.flashMessage("GRAVITY RING ONLINE // ENTER TO ADVANCE", 1800);
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

function decorateGravityRing(goal: THREE.Mesh): void {
  if (goal.userData.gravityRingDecorated) return;
  goal.userData.gravityRingDecorated = true;

  const material = () => new THREE.MeshBasicMaterial({
    color: 0xb8ffcf,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const outer = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.035, 8, 64), material());
  outer.rotation.x = Math.PI * 0.5;
  outer.rotation.z = Math.PI * 0.18;

  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.028, 8, 48), material());
  inner.rotation.y = Math.PI * 0.5;
  inner.rotation.z = -Math.PI * 0.22;

  const axis = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.018, 6, 56), material());
  axis.rotation.x = Math.PI * 0.28;
  axis.rotation.y = Math.PI * 0.22;

  goal.add(outer, inner, axis);
}
