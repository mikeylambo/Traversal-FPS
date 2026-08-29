import type { TraversalSettingsStore } from "./TraversalSettings";

type FlowLike = {
  onActivate(screenId: string, choiceId: string): void;
  onBack(screenId: string): void;
};

const ADJUSTABLE = new Set([
  "traversal-sensitivity",
  "traversal-controller-x",
  "traversal-controller-y",
  "traversal-controller-accel",
  "traversal-controller-scope",
  "traversal-controller-deadzone",
  "traversal-fov",
  "traversal-aim-smoothing",
  "traversal-reticle-scale"
]);

/**
 * Console-style settings editing:
 * - Up/Down chooses a row.
 * - A / Enter selects an adjustable row.
 * - Left/Right changes its value.
 * - A / Enter confirms, B / Escape cancels edit focus without leaving Settings.
 */
export function installSettingsAdjustmentRuntime(
  flow: FlowLike,
  root: HTMLElement,
  settings: TraversalSettingsStore
): void {
  const originalActivate = flow.onActivate.bind(flow);
  const originalBack = flow.onBack.bind(flow);
  let editingId: string | null = null;
  let previousPadDirection = 0;
  let repeatAt = 0;
  let frame = 0;

  const isSettingsOpen = () => Boolean(root.querySelector('[data-screen-id="settings"]'));

  const markEditing = () => {
    const screen = root.querySelector<HTMLElement>('[data-screen-id="settings"]');
    if (!screen) return;
    for (const button of Array.from(screen.querySelectorAll<HTMLButtonElement>('[data-choice-id]'))) {
      const active = button.dataset.choiceId === editingId;
      button.dataset.editing = String(active);
      button.querySelector(".settings-adjust-hint")?.remove();
      if (!active) continue;
      const hint = document.createElement("span");
      hint.className = "settings-adjust-hint";
      hint.textContent = document.body.classList.contains("gamepad-active")
        ? "◀ / ▶  Adjust   ·   A  Done"
        : "← / →  Adjust   ·   Enter  Done";
      button.appendChild(hint);
    }
  };

  const clearEditing = () => {
    editingId = null;
    previousPadDirection = 0;
    markEditing();
  };

  const apply = (direction: -1 | 1) => {
    if (!editingId || !isSettingsOpen()) return;
    settings.setAdjustmentDirection(direction);
    originalActivate("settings", editingId);
    window.setTimeout(markEditing, 0);
    window.setTimeout(markEditing, 35);
  };

  flow.onActivate = (screenId: string, choiceId: string) => {
    if (screenId !== "settings") {
      clearEditing();
      originalActivate(screenId, choiceId);
      return;
    }

    if (!ADJUSTABLE.has(choiceId)) {
      clearEditing();
      originalActivate(screenId, choiceId);
      return;
    }

    if (editingId === choiceId) {
      clearEditing();
      return;
    }

    editingId = choiceId;
    markEditing();
  };

  flow.onBack = (screenId: string) => {
    if (screenId === "settings" && editingId) {
      clearEditing();
      return;
    }
    originalBack(screenId);
  };

  window.addEventListener("keydown", (event) => {
    if (!editingId || !isSettingsOpen()) return;
    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      apply(event.code === "ArrowLeft" ? -1 : 1);
      return;
    }
    if (event.code === "ArrowUp" || event.code === "ArrowDown") clearEditing();
  }, true);

  const poll = () => {
    if (!isSettingsOpen() || !editingId) {
      previousPadDirection = 0;
      frame = requestAnimationFrame(poll);
      return;
    }

    const pad = activeGamepad();
    if (!pad) {
      frame = requestAnimationFrame(poll);
      return;
    }

    const dpadUp = Boolean(pad.buttons[12]?.pressed);
    const dpadDown = Boolean(pad.buttons[13]?.pressed);
    const stickY = pad.axes[1] ?? 0;
    if (dpadUp || dpadDown || Math.abs(stickY) > 0.72) {
      clearEditing();
      frame = requestAnimationFrame(poll);
      return;
    }

    const dpadLeft = Boolean(pad.buttons[14]?.pressed);
    const dpadRight = Boolean(pad.buttons[15]?.pressed);
    const stickX = pad.axes[0] ?? 0;
    const direction = dpadLeft || stickX < -0.7 ? -1 : dpadRight || stickX > 0.7 ? 1 : 0;
    const now = performance.now();

    if (direction !== 0) {
      if (direction !== previousPadDirection || now >= repeatAt) {
        apply(direction as -1 | 1);
        repeatAt = now + (direction !== previousPadDirection ? 330 : 115);
      }
    }

    previousPadDirection = direction;
    frame = requestAnimationFrame(poll);
  };
  frame = requestAnimationFrame(poll);

  if (!document.getElementById("traversal-settings-adjust-style")) {
    const style = document.createElement("style");
    style.id = "traversal-settings-adjust-style";
    style.textContent = `
      .slu-screen[data-screen-id="settings"] .slu-choice[data-editing="true"] {
        border-color: rgba(164, 242, 255, .72) !important;
        background: rgba(72, 190, 224, .11) !important;
        transform: translateX(3px);
      }
      .settings-adjust-hint {
        display: block;
        margin-top: 7px;
        font-family: "Sora", sans-serif;
        font-size: 10px;
        font-weight: 650;
        letter-spacing: .08em;
        color: rgba(220, 249, 255, .78);
      }
    `;
    document.head.appendChild(style);
  }

  window.addEventListener("beforeunload", () => cancelAnimationFrame(frame), { once: true });
}

function activeGamepad(): Gamepad | null {
  const pads = navigator.getGamepads?.() ?? [];
  for (const pad of pads) if (pad?.connected) return pad;
  return null;
}
