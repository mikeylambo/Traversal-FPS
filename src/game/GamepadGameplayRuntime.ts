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
};

const DEADZONE = 0.16;

/**
 * The Shell owns menu-pad navigation. Traversal owns gameplay-pad input.
 * Keeping these layers separate lets the FPS feel tune independently while
 * preserving one controller from title screen through play.
 */
export function installGamepadGameplay(game: object): void {
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
    frame = pollGamepad(dt, previousButtons, previousWarp, adjustRepeatAt);
    previousButtons = currentButtons();
    previousWarp = frame.warpHeld;
    if (frame.wheelDelta !== 0) adjustRepeatAt = performance.now() + 105;
    document.body.classList.toggle("gamepad-active", hasStandardGamepad());
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
  adjustRepeatAt: number
): PadFrame {
  const pad = activeGamepad();
  if (!pad) return emptyFrame();

  const buttons = pad.buttons.map((button) => button.pressed || button.value > 0.55);
  const leftX = curveAxis(pad.axes[0] ?? 0);
  const leftY = curveAxis(pad.axes[1] ?? 0);
  const rightX = curveAxis(pad.axes[2] ?? 0);
  const rightY = curveAxis(pad.axes[3] ?? 0);

  const fireHeld = buttonValue(pad, 7) > 0.55;
  const previousFire = previousButtons[7] ?? false;
  const warpHeld = buttonValue(pad, 6) > 0.42;

  // LB shortens; RB extends. Repeat while held so stop-short feels analog enough
  // without sacrificing the right stick for aim during vector placement.
  const shorten = buttons[4] ?? false;
  const extend = buttons[5] ?? false;
  const now = performance.now();
  let wheelDelta = 0;
  if (warpHeld && shorten !== extend) {
    const wasShorten = previousButtons[4] ?? false;
    const wasExtend = previousButtons[5] ?? false;
    const newlyPressed = shorten ? !wasShorten : !wasExtend;
    if (newlyPressed || now >= adjustRepeatAt) wheelDelta = shorten ? 1 : -1;
  }

  return {
    moveX: leftX,
    moveZ: -leftY,
    lookX: rightX * 15.5 * dt * 60,
    lookY: rightY * 13.5 * dt * 60,
    firePressed: fireHeld && !previousFire,
    crouchHeld: buttons[1] ?? false,
    warpHeld,
    warpReleased: previousWarp && !warpHeld,
    wheelDelta,
    resetPressed: Boolean(buttons[2] && !(previousButtons[2] ?? false))
  };
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

function curveAxis(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude <= DEADZONE) return 0;
  const normalized = (magnitude - DEADZONE) / (1 - DEADZONE);
  const curved = normalized * normalized * (3 - 2 * normalized);
  return Math.sign(value) * curved;
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
    resetPressed: false
  };
}
