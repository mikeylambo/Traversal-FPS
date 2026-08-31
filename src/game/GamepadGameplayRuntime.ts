import { resolveTraversalAction } from "../input/TraversalBindings";
import type { TraversalActionId } from "../input/TraversalActions";
import type { TraversalSettingsStore } from "./TraversalSettings";

type GameplayInput = {
  movement(): { x: number; z: number };
  consumeLook(): { x: number; y: number };
  consumeFire(): boolean;
  isCrouchHeld(): boolean;
  isWarpHeld(): boolean;
  consumeWarpRelease(): boolean;
  consumeWheel(): number;
  consumeReset(): boolean;
};

type RuntimeState = {
  input: GameplayInput;
  update(dt: number): void;
};

type PadFrame = {
  moveX: number;
  moveZ: number;
  lookX: number;
  lookY: number;
  firePressed: boolean;
  crouchHeld: boolean;
  warpHeld: boolean;
  warpReleased: boolean;
  wheelDelta: number;
  resetPressed: boolean;
  scopePressed: boolean;
};

const BASE_LOOK_X = 15.5;
const BASE_LOOK_Y = 13.5;

/**
 * The Shell owns menu-pad navigation. Traversal owns gameplay-pad input.
 * Bindings resolve from the persistent semantic action store every frame, so a
 * future remap UI can apply changes immediately without rebuilding gameplay.
 */
export function installGamepadGameplay(game: object, settings: TraversalSettingsStore): void {
  const state = game as unknown as RuntimeState;
  const input = state.input;

  const original = {
    movement: input.movement.bind(input),
    consumeLook: input.consumeLook.bind(input),
    consumeFire: input.consumeFire.bind(input),
    isCrouchHeld: input.isCrouchHeld.bind(input),
    isWarpHeld: input.isWarpHeld.bind(input),
    consumeWarpRelease: input.consumeWarpRelease.bind(input),
    consumeWheel: input.consumeWheel.bind(input),
    consumeReset: input.consumeReset.bind(input)
  };

  let frame: PadFrame = emptyFrame();
  let previousButtons: boolean[] = [];
  let previousWarp = false;
  let adjustRepeatAt = 0;

  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    frame = pollGamepad(dt, previousButtons, previousWarp, adjustRepeatAt, settings);
    previousButtons = currentButtons();
    previousWarp = frame.warpHeld;
    if (frame.wheelDelta !== 0) {
      adjustRepeatAt = performance.now() + 82;
      rumbleLandingAdjustment();
    }
    document.body.classList.toggle("gamepad-active", hasStandardGamepad());
    if (frame.scopePressed) {
      window.dispatchEvent(new CustomEvent("traversal:scope-toggle", { detail: { source: "gamepad" } }));
    }
    originalUpdate(dt);
  };

  input.movement = () => {
    const base = original.movement();
    const x = base.x + frame.moveX;
    const z = base.z + frame.moveZ;
    const length = Math.max(1, Math.hypot(x, z));
    return { x: x / length, z: z / length };
  };

  input.consumeLook = () => {
    const base = original.consumeLook();
    return { x: base.x + frame.lookX, y: base.y + frame.lookY };
  };

  input.consumeFire = () => original.consumeFire() || frame.firePressed;
  input.isCrouchHeld = () => original.isCrouchHeld() || frame.crouchHeld;
  input.isWarpHeld = () => original.isWarpHeld() || frame.warpHeld;
  input.consumeWarpRelease = () => original.consumeWarpRelease() || frame.warpReleased;
  input.consumeWheel = () => original.consumeWheel() + frame.wheelDelta;
  input.consumeReset = () => original.consumeReset() || frame.resetPressed;
}

function pollGamepad(
  dt: number,
  previousButtons: boolean[],
  previousWarp: boolean,
  adjustRepeatAt: number,
  settings: TraversalSettingsStore
): PadFrame {
  const pad = activeGamepad();
  if (!pad) return emptyFrame();

  const buttons = pad.buttons.map((button) => button.pressed || button.value > 0.55);
  const [moveXIndex, moveYIndex] = axisPair("move", [0, 1]);
  const [lookXIndex, lookYIndex] = axisPair("look", [2, 3]);
  const aim = settings.value;
  const left = curveMoveVector(
    pad.axes[moveXIndex] ?? 0,
    pad.axes[moveYIndex] ?? 0,
    aim.controllerMoveDeadzone
  );
  const right = curveLookVector(
    pad.axes[lookXIndex] ?? 0,
    pad.axes[lookYIndex] ?? 0,
    aim.controllerRightDeadzone,
    aim.controllerLookAcceleration
  );

  const fireIndices = buttonIndices("fire");
  const warpIndices = buttonIndices("warp");
  const shorterIndices = buttonIndices("landing-shorter");
  const longerIndices = buttonIndices("landing-longer");
  const crouchIndices = buttonIndices("crouch");
  const resetIndices = buttonIndices("reset");
  const scopeIndices = buttonIndices("scope");

  const fireHeld = maxButtonValue(pad, fireIndices) > 0.45;
  const previousFire = anyPrevious(previousButtons, fireIndices);
  const warpHeld = maxButtonValue(pad, warpIndices) > 0.32;

  const shorten = anyPressed(buttons, shorterIndices);
  const extend = anyPressed(buttons, longerIndices);
  const now = performance.now();
  let wheelDelta = 0;
  if (warpHeld && shorten !== extend) {
    const wasShorten = anyPrevious(previousButtons, shorterIndices);
    const wasExtend = anyPrevious(previousButtons, longerIndices);
    const newlyPressed = shorten ? !wasShorten : !wasExtend;
    if (newlyPressed || now >= adjustRepeatAt) wheelDelta = shorten ? 1 : -1;
  }

  const frameScale = dt * 60;
  const horizontalScale = sensitivityScale(aim.controllerSensitivityX);
  const verticalScale = sensitivityScale(aim.controllerSensitivityY);

  return {
    moveX: left.x,
    moveZ: -left.y,
    lookX: right.x * BASE_LOOK_X * horizontalScale * frameScale,
    lookY: right.y * BASE_LOOK_Y * verticalScale * frameScale,
    firePressed: fireHeld && !previousFire,
    crouchHeld: anyPressed(buttons, crouchIndices),
    warpHeld,
    warpReleased: previousWarp && !warpHeld,
    wheelDelta,
    resetPressed: anyPressed(buttons, resetIndices) && !anyPrevious(previousButtons, resetIndices),
    scopePressed: anyPressed(buttons, scopeIndices) && !anyPrevious(previousButtons, scopeIndices)
  };
}

function axisPair(id: TraversalActionId, fallback: [number, number]): [number, number] {
  return resolveTraversalAction(id).gamepad.axisPair ?? fallback;
}

function buttonIndices(id: TraversalActionId): number[] {
  const binding = resolveTraversalAction(id).gamepad;
  const indices = [...(binding.buttons ?? [])];
  if (binding.triggerButton !== undefined) indices.push(binding.triggerButton);
  return [...new Set(indices)];
}

function anyPressed(buttons: boolean[], indices: number[]): boolean {
  return indices.some((index) => Boolean(buttons[index]));
}

function anyPrevious(buttons: boolean[], indices: number[]): boolean {
  return indices.some((index) => Boolean(buttons[index]));
}

function maxButtonValue(pad: Gamepad, indices: number[]): number {
  let value = 0;
  for (const index of indices) value = Math.max(value, buttonValue(pad, index));
  return value;
}

function sensitivityScale(setting: number): number {
  return 0.35 + Math.max(1, Math.min(10, setting)) * 0.13;
}

function curveMoveVector(x: number, y: number, deadzone: number): { x: number; y: number } {
  const dz = Math.max(0.08, Math.min(0.35, deadzone));
  const magnitude = Math.min(1, Math.hypot(x, y));
  if (magnitude <= dz || magnitude <= 0.0001) return { x: 0, y: 0 };

  const normalized = Math.min(1, (magnitude - dz) / (1 - dz));
  const eased = normalized * normalized * (3 - 2 * normalized);
  const scale = eased / magnitude;
  return { x: x * scale, y: y * scale };
}

function curveLookVector(
  x: number,
  y: number,
  deadzone: number,
  acceleration: number
): { x: number; y: number } {
  const dz = Math.max(0.02, Math.min(0.28, deadzone));
  const magnitude = Math.min(1, Math.hypot(x, y));
  if (magnitude <= dz || magnitude <= 0.0001) return { x: 0, y: 0 };

  const normalized = Math.min(1, (magnitude - dz) / (1 - dz));
  const precision = Math.pow(normalized, 1.08);
  const outer = Math.max(0, Math.min(1, (normalized - 0.72) / 0.28));
  const outerEase = outer * outer * (3 - 2 * outer);
  const accelBoost = 1 + Math.max(0, Math.min(5, acceleration)) * 0.1 * outerEase;
  const curvedMagnitude = Math.min(1.5, precision * accelBoost);
  const scale = curvedMagnitude / magnitude;

  return { x: x * scale, y: y * scale };
}

function activeGamepad(): Gamepad | null {
  const pads = navigator.getGamepads?.() ?? [];
  for (const pad of pads) {
    if (pad?.connected && pad.mapping === "standard") return pad;
  }
  for (const pad of pads) if (pad?.connected) return pad;
  return null;
}

function hasStandardGamepad(): boolean {
  return activeGamepad() !== null;
}

function currentButtons(): boolean[] {
  const pad = activeGamepad();
  return pad ? pad.buttons.map((button) => button.pressed || button.value > 0.55) : [];
}

function buttonValue(pad: Gamepad, index: number): number {
  const button = pad.buttons[index];
  return button ? Math.max(button.value, button.pressed ? 1 : 0) : 0;
}

function rumbleLandingAdjustment(): void {
  try {
    const pad = activeGamepad() as (Gamepad & {
      vibrationActuator?: {
        playEffect?: (type: string, params: Record<string, number>) => Promise<unknown>;
      };
    }) | null;
    void pad?.vibrationActuator?.playEffect?.("dual-rumble", {
      duration: 24,
      strongMagnitude: 0.05,
      weakMagnitude: 0.16,
      startDelay: 0
    });
  } catch {
    // Selection haptics are optional.
  }
}

function emptyFrame(): PadFrame {
  return {
    moveX: 0,
    moveZ: 0,
    lookX: 0,
    lookY: 0,
    firePressed: false,
    crouchHeld: false,
    warpHeld: false,
    warpReleased: false,
    wheelDelta: 0,
    resetPressed: false,
    scopePressed: false
  };
}
