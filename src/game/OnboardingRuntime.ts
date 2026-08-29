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

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEP_COUNT = 7;
const ADVANCE_GAP_MS = 150;

/**
 * Controls onboarding is deliberately separate from Puzzle Grammar v1. It teaches
 * the physical interface, then hands the player directly into the eight grammar rooms.
 */
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

  const originalFire = input.consumeFire.bind(input);
  input.consumeFire = () => {
    const fired = originalFire();
    if (!active()) return fired;
    // Keep the target intact until the player has physically learned movement/look/crouch.
    return step >= 3 ? fired : false;
  };

  const originalWarpHeld = input.isWarpHeld.bind(input);
  input.isWarpHeld = () => {
    const held = originalWarpHeld();
    if (active() && step === 4 && held && state.warp.hasAnchor()) advance(5);
    return held;
  };

  const originalWheel = input.consumeWheel.bind(input);
  input.consumeWheel = () => {
    const delta = originalWheel();
    if (active() && step === 5 && delta !== 0) advance(6);
    return delta;
  };

  const originalFraction = input.consumeWarpFraction.bind(input);
  input.consumeWarpFraction = () => {
    const value = originalFraction();
    if (active() && step === 5 && value !== null && value < 0.95) advance(6);
    return value;
  };

  const originalShoot = state.shoot.bind(game);
  state.shoot = () => {
    const killsBefore = state.totalKills;
    originalShoot();
    if (active() && step === 3 && state.totalKills > killsBefore) advance(4);
  };

  const originalCommit = state.warp.commit.bind(state.warp);
  state.warp.commit = (position: THREE.Vector3) => {
    if (active()) {
      const percent = state.warp.selectionPercent();
      if (step < 6 || percent >= 95) {
        if (step >= 5) step = 5;
        return false;
      }
    }
    const committed = originalCommit(position);
    if (active() && committed && step === 6) advance(7);
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
    if (!room || step < 7 || state.roomKills < room.requiredKills) return;
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
  const entry = prompts[step];

  card.classList.add("visible");
  room.textContent = step < 7 ? `CONTROLS ${Math.min(step + 1, STEP_COUNT)}/${STEP_COUNT}` : "CONTROLS COMPLETE";
  text.textContent = entry;
  if (roomLabel) roomLabel.textContent = "CONTROLS";
  if (objective) objective.textContent = step < 7 ? "LEARN THE RIG" : "REACH THE EXIT";
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
      "CROUCH — B",
      "FIRE — RT",
      "WARP — HOLD LT",
      "LANDING — LB / RB",
      "COMMIT — RELEASE LT",
      "REACH THE EXIT"
    ];
  }

  return [
    "MOVE — WASD",
    "LOOK — MOUSE",
    "CROUCH — CTRL / C",
    "FIRE — LMB",
    "WARP — HOLD RMB",
    "LANDING — MOUSE WHEEL",
    "COMMIT — RELEASE RMB",
    "REACH THE EXIT"
  ];
}
