import { resolveTraversalAction } from "../input/TraversalBindings";

type RuntimeState = {
  warp: {
    hasAnchor(): boolean;
    cancelHold(): void;
    isHoldCancelled(): boolean;
    commit(position: unknown): boolean;
  };
  input: { isWarpHeld(): boolean };
  update(dt: number): void;
  flashMessage(message: string, duration?: number): void;
};

/**
 * "I wrote a vector but don't want to spend it yet." While Warp is held, the
 * Cancel Warp input (X / controller A) marks the hold as cancelled; releasing then
 * keeps the vector armed instead of warping. Stepping Stop Short below its
 * minimum (the CANCEL detent) does the same without a button.
 */
export function installWarpCancelRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  let previousPad = false;

  const tryCancel = () => {
    if (!state.input.isWarpHeld() || !state.warp.hasAnchor()) return;
    state.warp.cancelHold();
  };

  window.addEventListener("keydown", (event) => {
    if (event.repeat || !document.body.classList.contains("playing")) return;
    const keys = resolveTraversalAction("warp-cancel").keyboardMouse.keys ?? [];
    if (keys.includes(event.code)) tryCancel();
  });

  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    const buttons = resolveTraversalAction("warp-cancel").gamepad.buttons ?? [];
    const pads = navigator.getGamepads?.() ?? [];
    const pressed = [...pads].some((pad) => pad?.connected && buttons.some((index) => pad.buttons[index]?.pressed));
    if (pressed && !previousPad) tryCancel();
    previousPad = pressed;
    originalUpdate(dt);
  };

  const originalCommit = state.warp.commit.bind(state.warp);
  state.warp.commit = (position: unknown) => {
    const kept = state.warp.hasAnchor() && state.warp.isHoldCancelled();
    const committed = originalCommit(position);
    if (kept && !committed) state.flashMessage("VECTOR KEPT", 900);
    return committed;
  };
}
