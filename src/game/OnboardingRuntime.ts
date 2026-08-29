import * as THREE from "three";
import { ROOMS } from "../world/stages";
import type { ContentRuntime } from "./ContentRuntime";

type GameplayInput = {
  movement(): { x: number; z: number };
  consumeLook(): { x: number; y: number };
  consumeFire(): boolean;
  isCrouchHeld(): boolean;
  isWarpHeld(): boolean;
  consumeWarpRelease(): boolean;
  consumeWheel(): number;
  consumeWarpFraction(): number | null;
};

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  goal: THREE.Object3D;
  goalRadius: number;
  input: GameplayInput;
  warp: {
    hasAnchor(): boolean;
    selectionPercent(): number;
    commit(position: THREE.Vector3): boolean;
  };
  roomIndex: number;
  roomKills: number;
  totalKills: number;
  shots: number;
  targetHits: number;
  warps: number;
  roomRestarts: number;
  runStartedAt: number;
  loadRoom(index: number): void;
  updateHUD(): void;
  shoot(): void;
  checkGoal(): void;
};

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const STEP_COUNT = 8;
const ADVANCE_GAP_MS = 150;

/** Controls onboarding teaches the physical interface, then hands the player to grammar. */
export function installOnboardingRuntime(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  const input = state.input;
  let step: Step = 0;
  let nextAdvanceAt = 0;

  const active = () => content.activeForm() === "controls";
  const canAdvance = () => performance.now() >= nextAdvanceAt;
  const advance = (next: Step) => {
    if (!active() || !canAdvance() || next <= step) return;
    step = next;
    nextAdvanceAt = performance.now() + ADVANCE_GAP_MS;
  };

  const originalMovement = input.movement.bind(input);
  input.movement = () => {
    const value = originalMovement();
    if (active() && step === 0 && Math.hypot(value.x, value.z) > 0.28) advance(1);
    return value;
  };

  const originalLook = input.consumeLook.bind(input);
  input.consumeLook = () => {
    const value = originalLook();
    if (active() && step === 1 && Math.hypot(value.x, value.y) > 2.2) advance(2);
    return value;
  };

  const originalCrouch = input.isCrouchHeld.bind(input);
  input.isCrouchHeld = () => {
    const held = originalCrouch();
    if (active() && step === 2 && held) advance(3);
    return held;
  };

  window.addEventListener("traversal:scope-change", (event) => {
    const detail = (event as CustomEvent<{ active?: boolean }>).detail;
    if (active() && step === 3 && detail?.active) advance(4);
  });

  const originalFire = input.consumeFire.bind(input);
  input.consumeFire = () => {
    const fired = originalFire();
    if (!active()) return fired;
    return step >= 4 ? fired : false;
  };

  const originalWarpHeld = input.isWarpHeld.bind(input);
  input.isWarpHeld = () => {
    const held = originalWarpHeld();
    if (active() && step === 5 && held && state.warp.hasAnchor()) advance(6);
    return held;
  };

  const originalWheel = input.consumeWheel.bind(input);
  input.consumeWheel = () => {
    const delta = originalWheel();
    if (active() && step === 6 && delta !== 0) advance(7);
    return delta;
  };

  const originalFraction = input.consumeWarpFraction.bind(input);
  input.consumeWarpFraction = () => {
    const value = originalFraction();
    if (active() && step === 6 && value !== null && value < 0.95) advance(7);
    return value;
  };

  const originalShoot = state.shoot.bind(game);
  state.shoot = () => {
    const killsBefore = state.totalKills;
    originalShoot();
    if (active() && step === 4 && state.totalKills > killsBefore) advance(5);
  };

  const originalCommit = state.warp.commit.bind(state.warp);
  state.warp.commit = (position: THREE.Vector3) => {
    if (active()) {
      const percent = state.warp.selectionPercent();
      if (step < 6) return false;
      if (percent >= 95) {
        step = 6;
        return false;
      }
      if (step === 6) step = 7;
    }

    const committed = originalCommit(position);
    if (active() && committed && step >= 7) {
      step = 8;
      nextAdvanceAt = performance.now();
    }
    return committed;
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    if (active()) {
      step = 0;
      nextAdvanceAt = performance.now() + 250;
      document.body.classList.add("controls-onboarding");
    } else {
      document.body.classList.remove("controls-onboarding");
    }
  };

  const originalHUD = state.updateHUD.bind(game);
  state.updateHUD = () => {
    originalHUD();
    if (!active()) return;
    renderPrompt(step);
  };

  const originalCheckGoal = state.checkGoal.bind(game);
  state.checkGoal = () => {
    if (!active()) {
      originalCheckGoal();
      return;
    }

    const room = ROOMS[state.roomIndex];
    if (!room || step < 8 || state.roomKills < room.requiredKills) return;
    if (state.camera.position.distanceTo(state.goal.position) > state.goalRadius) return;

    content.enterGrammar();
    state.roomIndex = 0;
    state.totalKills = 0;
    state.shots = 0;
    state.targetHits = 0;
    state.warps = 0;
    state.roomRestarts = 0;
    state.runStartedAt = performance.now();
    document.body.classList.remove("controls-onboarding");
    state.loadRoom(0);
  };
}

function renderPrompt(step: Step): void {
  const card = document.getElementById("tutorial-card");
  const room = document.getElementById("tutorial-room");
  const text = document.getElementById("tutorial-text");
  const roomLabel = document.getElementById("room-label");
  const objective = document.getElementById("room-objective");
  const mode = document.getElementById("mode-label");
  if (!card || !room || !text) return;

  const prompts = controlPrompts();
  card.classList.add("visible");
  room.textContent = step < 8 ? `CONTROLS ${Math.min(step + 1, STEP_COUNT)}/${STEP_COUNT}` : "CONTROLS COMPLETE";
  text.textContent = prompts[step];
  if (roomLabel) roomLabel.textContent = "CONTROLS";
  if (objective) objective.textContent = step < 8 ? "LEARN THE RIG" : "REACH THE EXIT";
  if (mode) mode.textContent = "TRAINING";
}

function controlPrompts(): string[] {
  const touch = document.body.classList.contains("touch-device");
  const pad = document.body.classList.contains("gamepad-active");

  if (touch) {
    return [
      "MOVE — LEFT STICK",
      "LOOK — DRAG",
      "CROUCH — CROUCH",
      "SCOPE — SCOPE",
      "FIRE — FIRE",
      "WARP — HOLD WARP",
      "LANDING — RANGE",
      "COMMIT — RELEASE WARP",
      "REACH THE EXIT"
    ];
  }

  if (pad) {
    return [
      "MOVE — LEFT STICK",
      "LOOK — RIGHT STICK",
      "CROUCH — L3 / B",
      "SCOPE — R3",
      "FIRE — RT",
      "WARP — HOLD LT",
      "LANDING — RB SHORTER / LB LONGER",
      "COMMIT — RELEASE LT",
      "REACH THE EXIT"
    ];
  }

  return [
    "MOVE — WASD",
    "LOOK — MOUSE",
    "CROUCH — CTRL / C",
    "SCOPE — Q",
    "FIRE — LMB",
    "WARP — HOLD RMB",
    "LANDING — MOUSE WHEEL",
    "COMMIT — RELEASE RMB",
    "REACH THE EXIT"
  ];
}
