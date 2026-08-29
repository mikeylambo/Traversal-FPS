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

const MOVE_DEADZONE = 0.16;
const BASE_LOOK_X = 15.5;
const BASE_LOOK_Y = 13.5;

/**
 * The Shell owns menu-pad navigation. Traversal owns gameplay-pad input.
 * Right-stick tuning follows a familiar FPS shape: separate horizontal/vertical
 * sensitivity, configurable center deadzone, and extra acceleration near full deflection.
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
    if (frame.wheelDelta !== 0) adjustRepeatAt = performance.now() + 105;
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
  const leftX = curveMoveAxis(pad.axes[0] ?? 0);
  const leftY = curveMoveAxis(pad.axes[1] ?? 0);

  const aim = settings.value;
  const rightX = curveLookAxis(
    pad.axes[2] ?? 0,
    aim.controllerRightDeadzone,
    aim.controllerLookAcceleration
  );
  const rightY = curveLookAxis(
    pad.axes[3] ?? 0,
    aim.controllerRightDeadzone,
    aim.controllerLookAcceleration
  );

  const fireHeld = buttonValue(pad, 7) > 0.55;
  const previousFire = previousButtons[7] ?? false;
  const warpHeld = buttonValue(pad, 6) > 0.42;

  // RB shortens; LB extends. This mirrors the player's sense of pulling the
  // destination back with the right hand and opening the line with the left.
  const shorten = buttons[5] ?? false;
  const extend = buttons[4] ?? false;
  const now = performance.now();
  let wheelDelta = 0;
  if (warpHeld && shorten !== extend) {
    const wasShorten = previousButtons[5] ?? false;
    const wasExtend = previousButtons[4] ?? false;
    const newlyPressed = shorten ? !wasShorten : !wasExtend;
    if (newlyPressed || now >= adjustRepeatAt) wheelDelta = shorten ? 1 : -1;
  }

  const frameScale = dt * 60;
  const horizontalScale = sensitivityScale(aim.controllerSensitivityX);
  const verticalScale = sensitivityScale(aim.controllerSensitivityY);

  return {
    moveX: leftX,
    moveZ: -leftY,
    lookX: rightX * BASE_LOOK_X * horizontalScale * frameScale,
    lookY: rightY * BASE_LOOK_Y * verticalScale * frameScale,
    firePressed: fireHeld && !previousFire,
    crouchHeld: Boolean((buttons[1] ?? false) || (buttons[10] ?? false)),
    warpHeld,
    warpReleased: previousWarp && !warpHeld,
    wheelDelta,
    resetPressed: Boolean(buttons[2] && !(previousButtons[2] ?? false)),
    scopePressed: Boolean(buttons[11] && !(previousButtons[11] ?? false))
  };
}

function sensitivityScale(setting: number): number {
  // 5 reproduces the previous default. 1 remains deliberately usable; 10 gives
  // a fast-turn ceiling without making the middle settings jump dramatically.
  return 0.35 + Math.max(1, Math.min(10, setting)) * 0.13;
}

function curveMoveAxis(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude <= MOVE_DEADZONE) return 0;
  const normalized = (magnitude - MOVE_DEADZONE) / (1 - MOVE_DEADZONE);
  const curved = normalized * normalized * (3 - 2 * normalized);
  return Math.sign(value) * curved;
}

function curveLookAxis(value: number, deadzone: number, acceleration: number): number {
  const dz = Math.max(0.02, Math.min(0.28, deadzone));
  const magnitude = Math.abs(value);
  if (magnitude <= dz) return 0;

  const normalized = Math.min(1, (magnitude - dz) / (1 - dz));
  const base = normalized * normalized * (3 - 2 * normalized);
  const outer = Math.pow(normalized, 4.5);
  const accelBoost = 1 + Math.max(0, Math.min(5, acceleration)) * 0.1 * outer;
  return Math.sign(value) * Math.min(1.45, base * accelBoost);
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
