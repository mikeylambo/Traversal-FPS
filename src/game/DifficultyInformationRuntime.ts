import * as THREE from "three";

type DifficultyId = "assist" | "standard" | "hard" | "expert";

type WarpAnchor = {
  origin: THREE.Vector3;
  target: THREE.Vector3;
};

type WarpVisualAccess = {
  anchor: WarpAnchor | null;
  line: THREE.Line;
  beam: THREE.Mesh;
  marker: THREE.Group;
  hasAnchor(): boolean;
  selectionPercent(): number;
};

type RuntimeState = {
  difficultyId: string;
  enemySpeedScalar: number;
  gravityScalar: number;
  goalRadius: number;
  transientMessage: string;
  warp: WarpVisualAccess;
  input: { isWarpHeld(): boolean };
  ui: {
    updateScreen(id: string, patch: { title?: string; choices?: Array<{ id: string; label: string; description?: string }> }): void;
  };
  beginRun(): void;
  update(dt: number): void;
  updateHUD(): void;
  updateTargetReticle(): void;
  shoot(): void;
};

const DIFFICULTY_COPY = [
  {
    id: "assist",
    label: "Assist",
    description: "Full prediction + Rewind, with slightly forgiving physical timing."
  },
  {
    id: "standard",
    label: "Standard",
    description: "Intended physics. The Construct teaches you its full visual language."
  },
  {
    id: "hard",
    label: "Hard",
    description: "Standard physics. Less prediction and confirmation. No Rewind."
  },
  {
    id: "expert",
    label: "Expert",
    description: "Standard physics. Minimal computed guidance. Read the Construct yourself."
  }
] as const;

/**
 * Difficulty changes how much the game computes for the player, not whether the
 * world communicates its actual state. Utility actors, hazards, and causal state
 * changes remain readable on every tier.
 */
export function installDifficultyInformationRuntime(game: object): void {
  const state = game as unknown as RuntimeState;

  state.ui.updateScreen("difficulty-select", {
    title: "Difficulty // Information",
    choices: DIFFICULTY_COPY.map((entry) => ({ ...entry }))
  });

  const originalBeginRun = state.beginRun.bind(game);
  state.beginRun = () => {
    originalBeginRun();
    applyPhysicalProfile(state);
    document.body.dataset.traversalDifficulty = difficulty(state);
  };

  const originalHUD = state.updateHUD.bind(game);
  state.updateHUD = () => {
    originalHUD();
    applyHudProfile(state);
  };

  const originalReticle = state.updateTargetReticle.bind(game);
  state.updateTargetReticle = () => {
    originalReticle();
    applyTargetConfirmationProfile(state);
  };

  const originalShoot = state.shoot.bind(game);
  state.shoot = () => {
    originalShoot();
    scaleOriginRejectCopy(state);
  };

  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    originalUpdate(dt);
    applyVectorProfile(state);
  };
}

function difficulty(state: RuntimeState): DifficultyId {
  if (state.difficultyId === "assist" || state.difficultyId === "hard" || state.difficultyId === "expert") {
    return state.difficultyId;
  }
  return "standard";
}

function applyPhysicalProfile(state: RuntimeState): void {
  if (difficulty(state) === "assist") {
    // Accessibility/on-ramp forgiveness stays real, but deliberately compressed
    // compared with the old 0.78 / 0.85 / 2.8 profile.
    state.enemySpeedScalar = 0.9;
    state.gravityScalar = 0.94;
    state.goalRadius = 2.55;
    return;
  }

  // Standard, Hard and Expert solve the exact same physical problem.
  state.enemySpeedScalar = 1;
  state.gravityScalar = 1;
  state.goalRadius = 2.3;
}

function applyHudProfile(state: RuntimeState): void {
  const tier = difficulty(state);
  const hasAnchor = state.warp.hasAnchor();
  const held = state.input.isWarpHeld();
  const percent = state.warp.selectionPercent();
  const warpPercent = document.getElementById("warp-percent");
  const stopPanel = document.getElementById("stop-short-readout");
  const stopPercent = document.getElementById("stop-short-percent");
  const stopState = document.getElementById("stop-short-state");
  const warpHint = document.getElementById("warp-hint");
  const anchor = document.getElementById("anchor-status");

  if (warpPercent) warpPercent.hidden = tier !== "assist";

  if (stopPanel && tier !== "assist" && tier !== "standard") {
    // The filling bar itself is a computed percentage answer, so Hard/Expert do
    // not get an exact proportional confirmation.
    stopPanel.style.setProperty("--landing-width", "100%");
  }

  if (stopPercent) {
    stopPercent.textContent = tier === "assist"
      ? `${percent}%`
      : tier === "standard"
        ? "VECTOR"
        : tier === "hard"
          ? "READ"
          : "MANUAL";
  }

  if (stopState && hasAnchor && held) {
    if (tier === "hard") stopState.textContent = "EXTRAPOLATE";
    if (tier === "expert") stopState.textContent = "BY EYE";
  }

  if (warpHint && hasAnchor) {
    if (tier === "hard") warpHint.textContent = held ? "PLACE // EXTRAPOLATE VECTOR" : "HOLD WARP TO PLACE";
    if (tier === "expert") warpHint.textContent = held ? "PLACE BY EYE // RELEASE TO COMMIT" : "HOLD WARP // READ THE VECTOR";
  }

  if (anchor && hasAnchor && held) {
    anchor.textContent = tier === "assist"
      ? `VECTOR SELECT // ${percent}%`
      : tier === "standard"
        ? "VECTOR SELECT"
        : tier === "hard"
          ? "VECTOR SELECT // EXTRAPOLATE"
          : "VECTOR SELECT // MANUAL";
  }
}

function applyVectorProfile(state: RuntimeState): void {
  const anchor = state.warp.anchor;
  if (!anchor) return;

  const tier = difficulty(state);
  const visibleFraction = tier === "hard" ? 0.68 : tier === "expert" ? 0.28 : 1;
  const end = anchor.origin.clone().lerp(anchor.target, visibleFraction);
  setLineEndpoints(state.warp.line, anchor.origin, end);

  if (tier === "hard") {
    // Hard keeps the movable placement marker, but removes the bright computed
    // beam that otherwise draws the answer from origin to selection.
    state.warp.beam.visible = false;
    return;
  }

  if (tier === "expert") {
    state.warp.beam.visible = false;
    state.warp.marker.visible = false;
  }
}

function setLineEndpoints(line: THREE.Line, from: THREE.Vector3, to: THREE.Vector3): void {
  const position = line.geometry.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute) || position.count < 2) return;
  position.setXYZ(0, from.x, from.y, from.z);
  position.setXYZ(1, to.x, to.y, to.z);
  position.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

function applyTargetConfirmationProfile(state: RuntimeState): void {
  const tier = difficulty(state);
  if (tier === "assist" || tier === "standard") return;

  // Origin-gate rejection is still fully communicated after the shot. Hard and
  // Expert simply stop pre-solving that origin check in the reticle.
  document.body.classList.remove("target-blocked");
  if (tier === "expert") document.body.classList.remove("target-hot");

  // Deliberately preserve target-utility. Cube/Diamond/Prism identity is grammar,
  // not solution assistance, and remains readable on every difficulty.
}

function scaleOriginRejectCopy(state: RuntimeState): void {
  if (!state.transientMessage.includes("REJECT")) return;
  const tier = difficulty(state);

  if (tier === "assist") {
    state.transientMessage = state.transientMessage
      .replace("CHANGE YOUR FIRING ORIGIN", "MOVE TO THE OPEN SIDE OF THE SPHERE")
      .replace("CHANGE SIDE", "MOVE TO THE OPEN SIDE");
    return;
  }

  if (tier === "hard") {
    state.transientMessage = "ORIGIN REJECT // INVALID ORIGIN";
    return;
  }

  if (tier === "expert") state.transientMessage = "ORIGIN REJECT";
}
