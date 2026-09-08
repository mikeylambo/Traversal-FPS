import * as THREE from "three";
import { emitTraversalAudio } from "../audio/TraversalAudio";
import { ROOMS, type PlatformSpec } from "../world/stages";
import { installDifficultyInformationRuntime } from "./DifficultyInformationRuntime";

type RuntimeState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  roomIndex: number;
  difficultyId: string;
  warp: {
    hasAnchor(): boolean;
    selectionPercent(): number;
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
const HARD_CUE_RANGE = 18;
const EXPERT_CONTACT_RANGE = 6.5;

/**
 * Positive-only landing information: when the selected vector coordinate has a
 * real walkable surface underneath it, draw a thin drop line and ground ring.
 * Absence of the cue does not forbid the warp; airborne routes remain possible.
 *
 * Difficulty scales prediction rather than basic spatial truth:
 * - Assist/Standard: full current cue.
 * - Hard: cue only at near/mid range.
 * - Expert: close contact ring only; no predictive drop line.
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

  // Placing a landing is a continuous, silent adjustment on the gauge. A short tick
  // per step gives the same information without asking the player to watch a number.
  let lastPercent = -1;
  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    originalUpdate(dt);
    syncLandingCue(state, line, groundRing);

    const placing = state.warp.hasAnchor() && state.input.isWarpHeld();
    const percent = placing ? state.warp.selectionPercent() : -1;
    if (placing && lastPercent >= 0 && percent !== lastPercent) emitTraversalAudio("landing.adjust");
    lastPercent = percent;
  };

  // Installed here because Landing Readability is already the presentation seam
  // immediately after GameplayClarity. This keeps the redesign isolated from the
  // shell's difficulty data contract while the new tiers are being playtested.
  installDifficultyInformationRuntime(game);
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
  const tier = normalizeDifficulty(state.difficultyId);
  const distance = state.camera.position.distanceTo(selected);
  const inRange = tier === "hard"
    ? distance <= HARD_CUE_RANGE
    : tier === "expert"
      ? distance <= EXPERT_CONTACT_RANGE
      : true;
  const cueVisible = Boolean(support) && inRange;
  document.body.classList.toggle("landing-supported", cueVisible);

  if (!support || !inRange) {
    line.visible = false;
    groundRing.visible = false;
    return;
  }

  if (tier !== "expert") {
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints([
      selected,
      new THREE.Vector3(selected.x, support.surfaceY + 0.035, selected.z)
    ]);
    line.visible = true;
  } else {
    // Expert still gets a close-range contact truth to compensate for first-person
    // depth/proprioception limits, but no long-range prediction line.
    line.visible = false;
  }

  groundRing.position.set(selected.x, support.surfaceY + 0.045, selected.z);
  groundRing.visible = true;

  const stateLabel = document.getElementById("stop-short-state");
  if (stateLabel && tier !== "hard" && tier !== "expert") stateLabel.textContent = "GROUND";
}

function normalizeDifficulty(value: string): "assist" | "standard" | "hard" | "expert" {
  if (value === "assist" || value === "hard" || value === "expert") return value;
  return "standard";
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
