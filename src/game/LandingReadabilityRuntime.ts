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

export function installLandingReadabilityRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  installReadoutParityStyles();

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
    setGroundReadout(false);
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

  /* Ground/not-ground is basic spatial truth. It must survive scope/FOV changes and
     be identical on touch, mouse, and controller. Difficulty only reduces the
     predictive world-space line/ring, never the textual truth. */
  document.body.classList.toggle("landing-supported", Boolean(support));
  setGroundReadout(Boolean(support));

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
    line.visible = false;
  }

  groundRing.position.set(selected.x, support.surfaceY + 0.045, selected.z);
  groundRing.visible = true;
}

function setGroundReadout(supported: boolean): void {
  for (const id of ["stop-short-surface", "mobile-landing-surface"]) {
    const label = document.getElementById(id);
    if (!label) continue;
    label.textContent = supported ? "GROUND" : "";
    label.classList.toggle("visible", supported);
  }
}

function installReadoutParityStyles(): void {
  if (document.getElementById("landing-readout-parity-styles")) return;
  const style = document.createElement("style");
  style.id = "landing-readout-parity-styles";
  style.textContent = `
    #stop-short-surface,
    #mobile-landing-surface {
      display: none;
      margin: 0;
      font-family: "Sora", sans-serif;
      font-style: normal;
      font-size: 8px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: .14em;
      color: #a9ffd0;
      text-shadow: 0 0 10px rgba(125, 255, 178, .32);
    }
    #stop-short-surface.visible,
    #mobile-landing-surface.visible { display: block; }

    #stop-short-surface {
      grid-column: 1;
      margin-top: 4px;
    }

    @media (pointer: coarse) and (orientation: landscape) {
      #mobile-landing-readout {
        grid-template-rows: auto auto auto !important;
      }
      #mobile-landing-state { grid-row: 2 !important; }
      #mobile-landing-percent { grid-row: 1 / 4 !important; }
      #mobile-landing-surface {
        grid-column: 1;
        grid-row: 3;
        margin-top: 2px;
        font-size: 6px;
      }
    }
  `;
  document.head.appendChild(style);
}

function normalizeDifficulty(value: string): "assist" | "standard" | "hard" | "expert" {
  if (value === "assist" || value === "hard" || value === "expert") return value;
  return "standard";
}

function findGroundSupport(selected: THREE.Vector3, platforms: readonly PlatformSpec[]): GroundSupport | null {
  let best: GroundSupport | null = null;

  for (const platform of platforms) {
    if (platform.size[0] < 1.5 || platform.size[2] < 1.5 || platform.size[1] > 2.5) continue;

    const halfX = Math.max(0.05, platform.size[0] * 0.5 - EDGE_INSET);
    const halfZ = Math.max(0.05, platform.size[2] * 0.5 - EDGE_INSET);
    if (Math.abs(selected.x - platform.center[0]) > halfX) continue;
    if (Math.abs(selected.z - platform.center[2]) > halfZ) continue;

    const surfaceY = platform.center[1] + platform.size[1] * 0.5;
    const standingY = surfaceY + EYE_HEIGHT;
    if (selected.y < standingY - VERTICAL_CUSHION) continue;
    if (!best || surfaceY > best.surfaceY) best = { surfaceY, standingY };
  }

  return best;
}
