import {
  TRAVERSAL_ACTIONS,
  type GamepadBinding,
  type KeyboardMouseBinding,
  type MovementKeys,
  type TraversalActionDefinition,
  type TraversalActionId
} from "../input/TraversalActions";
import { resolveTraversalAction, traversalBindings } from "../input/TraversalBindings";

type FlowLike = {
  onActivate(screenId: string, choiceId: string): void;
  onBack(screenId: string): void;
};

type UILike = {
  register(screens: Array<Record<string, unknown>>): void;
  updateScreen(screenId: string, payload: Record<string, unknown>): void;
  show(screenId: string): void;
};

type CaptureDevice = "keyboardMouse" | "gamepad";
type MoveStep = keyof MovementKeys;

const ROOT_SCREEN = "traversal-controls";
const ACTION_SCREEN = "traversal-control-action";
const MOVE_STEPS: MoveStep[] = ["forward", "backward", "left", "right"];
const MOVE_STEP_LABEL: Record<MoveStep, string> = {
  forward: "FORWARD",
  backward: "BACKWARD",
  left: "LEFT",
  right: "RIGHT"
};

/**
 * Shell-native controls UI. The Shell keeps menu navigation; this runtime only
 * owns capture, conflict checks, persistence, and binding presentation.
 */
export function installControlsRuntime(flow: FlowLike, ui: UILike): void {
  let selectedAction: TraversalActionId | null = null;
  let cancelCapture: (() => void) | null = null;

  ui.register([
    {
      id: ROOT_SCREEN,
      title: "Controls",
      subtitle: "Select an action to inspect or rebind.",
      backTarget: "settings",
      choices: rootChoices()
    },
    {
      id: ACTION_SCREEN,
      title: "Control",
      subtitle: "Keyboard, mouse, and controller bindings.",
      backTarget: ROOT_SCREEN,
      choices: []
    }
  ]);

  const refreshRoot = () => {
    ui.updateScreen(ROOT_SCREEN, {
      title: "Controls",
      subtitle: traversalBindings.hasOverrides()
        ? "Custom bindings active."
        : "Default bindings active.",
      choices: rootChoices()
    });
  };

  const openAction = (id: TraversalActionId, subtitle?: string) => {
    selectedAction = id;
    const action = resolveTraversalAction(id);
    const overrides = traversalBindings.snapshot()[id];
    ui.updateScreen(ACTION_SCREEN, {
      title: action.label,
      subtitle: subtitle ?? "Select a device to rebind.",
      choices: [
        {
          id: "controls-bind-kbm",
          label: `Keyboard & Mouse // ${formatKeyboardMouse(action.keyboardMouse)}`,
          description: overrides?.keyboardMouse ? "CUSTOM" : "DEFAULT"
        },
        {
          id: "controls-bind-pad",
          label: `Controller // ${formatGamepad(action.gamepad)}`,
          description: overrides?.gamepad ? "CUSTOM" : "DEFAULT"
        },
        {
          id: "controls-reset-action",
          label: "Reset Action",
          description: "Restore both device defaults."
        },
        { id: "controls-action-back", label: "Back" }
      ]
    });
    ui.show(ACTION_SCREEN);
  };

  const stopCapture = () => {
    cancelCapture?.();
    cancelCapture = null;
  };

  const finishBinding = (id: TraversalActionId, device: CaptureDevice, label: string) => {
    stopCapture();
    refreshRoot();
    openAction(id, `BOUND // ${label}`);
  };

  const showCaptureMessage = (id: TraversalActionId, message: string) => {
    openAction(id, message);
  };

  const beginKeyboardMouseCapture = (id: TraversalActionId) => {
    stopCapture();
    const action = resolveTraversalAction(id);
    let moveDraft: Partial<MovementKeys> = {};
    let moveIndex = 0;
    let active = true;

    const cleanup = () => {
      if (!active) return;
      active = false;
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("wheel", onWheel, true);
    };

    const commit = (binding: KeyboardMouseBinding, label: string) => {
      const conflict = keyboardMouseConflict(id, binding);
      if (conflict) {
        showCaptureMessage(id, `CONFLICT // ${conflict}`);
        return;
      }
      if (!traversalBindings.setKeyboardMouse(id, binding)) {
        showCaptureMessage(id, "This action cannot be remapped.");
        return;
      }
      finishBinding(id, "keyboardMouse", label);
    };

    const promptMoveStep = () => {
      const step = MOVE_STEPS[moveIndex]!;
      showCaptureMessage(id, `PRESS ${MOVE_STEP_LABEL[step]} KEY // ESC CANCELS`);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!active) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === "Escape") {
        cleanup();
        cancelCapture = null;
        openAction(id, "Binding unchanged.");
        return;
      }
      if (event.repeat) return;

      if (id === "move") {
        const step = MOVE_STEPS[moveIndex]!;
        if (Object.values(moveDraft).includes(event.code)) {
          showCaptureMessage(id, "That key is already used in this movement set.");
          return;
        }
        const conflict = keyboardMouseConflict(id, { keys: [event.code] });
        if (conflict) {
          showCaptureMessage(id, `CONFLICT // ${conflict}`);
          return;
        }
        moveDraft[step] = event.code;
        moveIndex += 1;
        if (moveIndex < MOVE_STEPS.length) {
          promptMoveStep();
          return;
        }
        const moveKeys = moveDraft as MovementKeys;
        commit({ moveKeys }, formatKeyboardMouse({ moveKeys }));
        return;
      }

      commit({ keys: [event.code] }, formatKeyCode(event.code));
    };

    const onMouseDown = (event: MouseEvent) => {
      if (!active || id === "move") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      commit({ mouseButtons: [event.button] }, formatMouseButton(event.button));
    };

    const onWheel = (event: WheelEvent) => {
      if (!active || id === "move") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const wheel = event.deltaY >= 0 ? "down" : "up";
      commit({ wheel }, wheel === "down" ? "Wheel Down" : "Wheel Up");
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    cancelCapture = cleanup;

    if (id === "move") promptMoveStep();
    else showCaptureMessage(id, `PRESS KEY / MOUSE / WHEEL // ESC CANCELS`);
  };

  const beginGamepadCapture = (id: TraversalActionId) => {
    stopCapture();
    let active = true;
    let armed = false;
    let raf = 0;

    const cleanup = () => {
      if (!active) return;
      active = false;
      cancelAnimationFrame(raf);
    };

    const commit = (binding: GamepadBinding, label: string) => {
      const conflict = gamepadConflict(id, binding);
      if (conflict) {
        showCaptureMessage(id, `CONFLICT // ${conflict}`);
        return;
      }
      if (!traversalBindings.setGamepad(id, binding)) {
        showCaptureMessage(id, "This action cannot be remapped.");
        return;
      }
      finishBinding(id, "gamepad", label);
    };

    const poll = () => {
      if (!active) return;
      const pad = activeGamepad();
      if (!pad) {
        showCaptureMessage(id, "CONNECT A CONTROLLER // B OR ESC CANCELS");
        raf = requestAnimationFrame(poll);
        return;
      }

      const pressed = pad.buttons.map((button) => button.pressed || button.value > 0.55);
      const axesNeutral = pad.axes.every((axis) => Math.abs(axis) < 0.35);
      if (!armed) {
        if (!pressed.some(Boolean) && axesNeutral) armed = true;
        raf = requestAnimationFrame(poll);
        return;
      }

      if (id === "move") {
        const axis = pad.axes.findIndex((value) => Math.abs(value) > 0.65);
        if (axis >= 0) {
          const first = axis % 2 === 0 ? axis : axis - 1;
          const axisPair: [number, number] = [first, first + 1];
          commit({ axisPair }, formatGamepad({ axisPair }));
          return;
        }
      }

      const buttonIndex = pressed.findIndex(Boolean);
      if (buttonIndex >= 0) {
        const base = resolveTraversalAction(id).gamepad;
        const binding = base.triggerButton !== undefined
          ? { triggerButton: buttonIndex }
          : { buttons: [buttonIndex] };
        commit(binding, formatGamepad(binding));
        return;
      }

      raf = requestAnimationFrame(poll);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Escape") return;
      event.preventDefault();
      cleanup();
      cancelCapture = null;
      openAction(id, "Binding unchanged.");
    };
    window.addEventListener("keydown", onKeyDown, { capture: true, once: true });
    const originalCleanup = cleanup;
    cancelCapture = () => {
      window.removeEventListener("keydown", onKeyDown, true);
      originalCleanup();
    };
    showCaptureMessage(id, id === "move"
      ? "MOVE THE DESIRED STICK // ESC CANCELS"
      : "PRESS THE DESIRED CONTROLLER BUTTON // ESC CANCELS");
    raf = requestAnimationFrame(poll);
  };

  window.addEventListener("traversal:open-controls", () => {
    stopCapture();
    selectedAction = null;
    refreshRoot();
    ui.show(ROOT_SCREEN);
  });

  traversalBindings.subscribe(() => refreshRoot());

  const originalActivate = flow.onActivate.bind(flow);
  flow.onActivate = (screenId: string, choiceId: string) => {
    if (cancelCapture) return;

    if (screenId === ROOT_SCREEN) {
      if (choiceId === "controls-reset-all") {
        traversalBindings.resetAll();
        refreshRoot();
        ui.show(ROOT_SCREEN);
        return;
      }
      if (choiceId === "controls-back") {
        ui.show("settings");
        return;
      }
      if (choiceId.startsWith("controls-action:")) {
        const id = choiceId.slice("controls-action:".length) as TraversalActionId;
        if (TRAVERSAL_ACTIONS.some((action) => action.id === id && action.remappable)) openAction(id);
        return;
      }
    }

    if (screenId === ACTION_SCREEN && selectedAction) {
      if (choiceId === "controls-bind-kbm") {
        beginKeyboardMouseCapture(selectedAction);
        return;
      }
      if (choiceId === "controls-bind-pad") {
        beginGamepadCapture(selectedAction);
        return;
      }
      if (choiceId === "controls-reset-action") {
        traversalBindings.resetAction(selectedAction);
        refreshRoot();
        openAction(selectedAction, "Defaults restored.");
        return;
      }
      if (choiceId === "controls-action-back") {
        selectedAction = null;
        refreshRoot();
        ui.show(ROOT_SCREEN);
        return;
      }
    }

    originalActivate(screenId, choiceId);
  };

  const originalBack = flow.onBack.bind(flow);
  flow.onBack = (screenId: string) => {
    if (cancelCapture) {
      stopCapture();
      if (selectedAction) openAction(selectedAction, "Binding unchanged.");
      return;
    }
    if (screenId === ACTION_SCREEN) {
      selectedAction = null;
      refreshRoot();
      ui.show(ROOT_SCREEN);
      return;
    }
    if (screenId === ROOT_SCREEN) {
      ui.show("settings");
      return;
    }
    originalBack(screenId);
  };
}

function rootChoices(): Array<Record<string, unknown>> {
  const overrides = traversalBindings.snapshot();
  const actions = TRAVERSAL_ACTIONS
    .filter((action) => action.remappable)
    .map((base) => {
      const action = resolveTraversalAction(base.id);
      const custom = overrides[base.id];
      return {
        id: `controls-action:${base.id}`,
        label: action.label,
        description: `KBM ${formatKeyboardMouse(action.keyboardMouse)} · PAD ${formatGamepad(action.gamepad)}${custom ? " · CUSTOM" : ""}`
      };
    });

  return [
    ...actions,
    {
      id: "controls-reset-all",
      label: "Reset All Controls",
      description: "Restore the default keyboard, mouse, and controller profile."
    },
    { id: "controls-back", label: "Back" }
  ];
}

function keyboardMouseConflict(id: TraversalActionId, candidate: KeyboardMouseBinding): string | null {
  const candidateKeys = new Set([
    ...(candidate.keys ?? []),
    ...Object.values(candidate.moveKeys ?? {})
  ]);
  const candidateButtons = new Set(candidate.mouseButtons ?? []);

  for (const other of TRAVERSAL_ACTIONS) {
    if (other.id === id) continue;
    const binding = resolveTraversalAction(other.id).keyboardMouse;
    const otherKeys = [
      ...(binding.keys ?? []),
      ...Object.values(binding.moveKeys ?? {})
    ];
    if (otherKeys.some((key) => candidateKeys.has(key))) return `${other.label} already uses that key.`;
    if ((binding.mouseButtons ?? []).some((button) => candidateButtons.has(button))) {
      return `${other.label} already uses that mouse button.`;
    }
    if (candidate.wheel && binding.wheel === candidate.wheel) return `${other.label} already uses that wheel direction.`;
  }
  return null;
}

function gamepadConflict(id: TraversalActionId, candidate: GamepadBinding): string | null {
  const candidateButtons = new Set([
    ...(candidate.buttons ?? []),
    ...(candidate.triggerButton === undefined ? [] : [candidate.triggerButton])
  ]);

  for (const other of TRAVERSAL_ACTIONS) {
    if (other.id === id) continue;
    const binding = resolveTraversalAction(other.id).gamepad;
    const otherButtons = [
      ...(binding.buttons ?? []),
      ...(binding.triggerButton === undefined ? [] : [binding.triggerButton])
    ];
    if (otherButtons.some((button) => candidateButtons.has(button))) return `${other.label} already uses that button.`;
    if (candidate.axisPair && binding.axisPair && sameAxisPair(candidate.axisPair, binding.axisPair)) {
      return `${other.label} already uses that stick.`;
    }
  }
  return null;
}

function sameAxisPair(a: [number, number], b: [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function formatKeyboardMouse(binding: KeyboardMouseBinding): string {
  if (binding.moveKeys) {
    const { forward, left, backward, right } = binding.moveKeys;
    return [forward, left, backward, right].map(formatKeyCode).join("/");
  }
  if (binding.keys?.length) return binding.keys.map(formatKeyCode).join("/");
  if (binding.mouseButtons?.length) return binding.mouseButtons.map(formatMouseButton).join("/");
  if (binding.wheel) return binding.wheel === "down" ? "Wheel Down" : "Wheel Up";
  if (binding.pointer) return "Mouse Look";
  return "Unbound";
}

function formatGamepad(binding: GamepadBinding): string {
  if (binding.axisPair) {
    if (sameAxisPair(binding.axisPair, [0, 1])) return "Left Stick";
    if (sameAxisPair(binding.axisPair, [2, 3])) return "Right Stick";
    return `Axes ${binding.axisPair[0]}/${binding.axisPair[1]}`;
  }
  const indices = [
    ...(binding.buttons ?? []),
    ...(binding.triggerButton === undefined ? [] : [binding.triggerButton])
  ];
  return indices.length ? indices.map(formatGamepadButton).join("/") : "Unbound";
}

function formatKeyCode(code: string): string {
  const aliases: Record<string, string> = {
    ControlLeft: "LCtrl",
    ControlRight: "RCtrl",
    ShiftLeft: "LShift",
    ShiftRight: "RShift",
    Space: "Space",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→"
  };
  if (aliases[code]) return aliases[code]!;
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

function formatMouseButton(button: number): string {
  return ["LMB", "MMB", "RMB", "Mouse 4", "Mouse 5"][button] ?? `Mouse ${button + 1}`;
}

function formatGamepadButton(index: number): string {
  return [
    "A", "B", "X", "Y", "LB", "RB", "LT", "RT",
    "View", "Menu", "L3", "R3", "D-Up", "D-Down", "D-Left", "D-Right"
  ][index] ?? `Button ${index}`;
}

function activeGamepad(): Gamepad | null {
  const pads = navigator.getGamepads?.() ?? [];
  for (const pad of pads) if (pad?.connected && pad.mapping === "standard") return pad;
  for (const pad of pads) if (pad?.connected) return pad;
  return null;
}
