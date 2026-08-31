import * as THREE from "three";
import { ROOMS, type PlatformSpec } from "../world/stages";

type RuntimeState = {
  scene: THREE.Scene;
  roomIndex: number;
  warp: {
    hasAnchor(): boolean;
    // Runtime-accessed private method on WarpSystem. Kept here rather than
    // changing WarpSystem's movement contract for a presentation-only feature.
    selectedPoint(): THREE.Vector3;
  };
  input: { isWarpHeld(): boolean };
  update(dt: number): void;
};

type GroundSupport = {
  surfaceY: number;
  standingY: number;
};

const EYE_HEIGHT = 1.7;
const EDGE_INSET = 0.18;
const VERTICAL_CUSHION = 0.72;

/**
 * Positive-only landing information: when the selected vector coordinate has a
 * real walkable surface underneath it, draw a thin drop line and ground ring.
 * Absence of the cue does not forbid the warp; airborne routes remain possible.
 */
export function installLandingReadabilityRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  const material = new THREE.LineBasicMaterial({
    color: 0x7dffb2,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    material
  );
  line.visible = false;

  const groundRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.025, 7, 32),
    new THREE.MeshBasicMaterial({
      color: 0x7dffb2,
      transparent: true,
      opacity: 0.76,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  groundRing.rotation.x = Math.PI * 0.5;
  groundRing.visible = false;
  state.scene.add(line, groundRing);

  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    originalUpdate(dt);
    syncLandingCue(state, line, groundRing);
  };
}

function syncLandingCue(
  state: RuntimeState,
  line: THREE.Line,
  groundRing: THREE.Mesh
): void {
  const active = state.warp.hasAnchor() && state.input.isWarpHeld();
  if (!active) {
    line.visible = false;
    groundRing.visible = false;
    document.body.classList.remove("landing-supported");
    return;
  }

  const selected = state.warp.selectedPoint();
  const room = ROOMS[state.roomIndex];
  const support = room ? findGroundSupport(selected, room.platforms) : null;
  const supported = Boolean(support);
  document.body.classList.toggle("landing-supported", supported);

  if (!support) {
    line.visible = false;
    groundRing.visible = false;
    return;
  }

  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints([
    selected,
    new THREE.Vector3(selected.x, support.surfaceY + 0.035, selected.z)
  ]);
  line.visible = true;

  groundRing.position.set(selected.x, support.surfaceY + 0.045, selected.z);
  groundRing.visible = true;

  const stateLabel = document.getElementById("stop-short-state");
  if (stateLabel) stateLabel.textContent = "GROUND";
}

function findGroundSupport(selected: THREE.Vector3, platforms: readonly PlatformSpec[]): GroundSupport | null {
  let best: GroundSupport | null = null;

  for (const platform of platforms) {
    // Thin floors/decks are landing surfaces. This filters the tall/thin wall
    // slabs that share PlatformSpec for collision/occlusion.
    if (platform.size[0] < 1.5 || platform.size[2] < 1.5 || platform.size[1] > 2.5) continue;

    const halfX = Math.max(0.05, platform.size[0] * 0.5 - EDGE_INSET);
    const halfZ = Math.max(0.05, platform.size[2] * 0.5 - EDGE_INSET);
    if (Math.abs(selected.x - platform.center[0]) > halfX) continue;
    if (Math.abs(selected.z - platform.center[2]) > halfZ) continue;

    const surfaceY = platform.center[1] + platform.size[1] * 0.5;
    const standingY = surfaceY + EYE_HEIGHT;
    // If the selected camera point is materially below the standing height, the
    // platform is above the player, not ground beneath them.
    if (selected.y < standingY - VERTICAL_CUSHION) continue;
    if (!best || surfaceY > best.surfaceY) best = { surfaceY, standingY };
  }

  return best;
}
