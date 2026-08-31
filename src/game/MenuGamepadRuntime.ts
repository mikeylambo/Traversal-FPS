type MenuUI = {
  move(delta: number): void;
};

const STICK_THRESHOLD = 0.68;
const FIRST_REPEAT_MS = 330;
const REPEAT_MS = 120;

/**
 * Adds left-stick vertical navigation to Shell menus. The Shell already owns
 * D-pad/button activation/back behavior; this runtime only mirrors menu movement
 * onto the left stick for controller-first PC play.
 */
export function installMenuGamepadRuntime(ui: MenuUI): void {
  let previousDirection = 0;
  let repeatAt = 0;
  let frame = 0;

  const poll = () => {
    if (document.body.classList.contains("playing") || document.body.classList.contains("controls-capturing")) {
      previousDirection = 0;
      frame = requestAnimationFrame(poll);
      return;
    }

    const pad = activeGamepad();
    if (!pad) {
      previousDirection = 0;
      frame = requestAnimationFrame(poll);
      return;
    }

    const vertical = pad.axes[1] ?? 0;
    const direction = vertical <= -STICK_THRESHOLD ? -1 : vertical >= STICK_THRESHOLD ? 1 : 0;
    const now = performance.now();

    if (direction !== 0 && (direction !== previousDirection || now >= repeatAt)) {
      ui.move(direction);
      repeatAt = now + (direction !== previousDirection ? FIRST_REPEAT_MS : REPEAT_MS);
    }

    previousDirection = direction;
    frame = requestAnimationFrame(poll);
  };

  frame = requestAnimationFrame(poll);
  window.addEventListener("beforeunload", () => cancelAnimationFrame(frame), { once: true });
}

function activeGamepad(): Gamepad | null {
  const pads = navigator.getGamepads?.() ?? [];
  for (const pad of pads) if (pad?.connected && pad.mapping === "standard") return pad;
  for (const pad of pads) if (pad?.connected) return pad;
  return null;
}
