import {
  TRAVERSAL_ACTIONS,
  defaultTraversalAction,
  type GamepadBinding,
  type KeyboardMouseBinding,
  type TraversalActionDefinition,
  type TraversalActionId,
  type TraversalBindingOverrides
} from "./TraversalActions";

const STORAGE_KEY = "traversal-fps:bindings:v1";
const STORAGE_VERSION = 1;

type StoredBindings = {
  version: number;
  overrides: TraversalBindingOverrides;
};

type BindingListener = () => void;

/**
 * Persistent device-binding backend. Defaults remain immutable in
 * TraversalActions; this store only records user overrides. The Controls UI
 * calls setKeyboardMouse/setGamepad/resetAction and never mutates gameplay
 * handlers directly.
 */
export class TraversalBindingsStore {
  private overrides: TraversalBindingOverrides = {};
  private readonly listeners = new Set<BindingListener>();

  constructor() {
    this.overrides = this.load();

    if (typeof window !== "undefined") {
      window.addEventListener("storage", (event) => {
        if (event.key !== STORAGE_KEY) return;
        this.overrides = this.load();
        this.emit();
      });
    }
  }

  resolve(id: TraversalActionId): TraversalActionDefinition {
    const base = defaultTraversalAction(id);
    const override = this.overrides[id];
    if (!override) return cloneAction(base);

    return {
      ...base,
      keyboardMouse: override.keyboardMouse
        ? cloneKeyboardMouse(override.keyboardMouse)
        : cloneKeyboardMouse(base.keyboardMouse),
      gamepad: override.gamepad
        ? cloneGamepad(override.gamepad)
        : cloneGamepad(base.gamepad)
    };
  }

  snapshot(): TraversalBindingOverrides {
    return structuredClone(this.overrides);
  }

  hasOverrides(): boolean {
    return Object.keys(this.overrides).length > 0;
  }

  setKeyboardMouse(id: TraversalActionId, binding: KeyboardMouseBinding): boolean {
    const action = defaultTraversalAction(id);
    if (!action.remappable) return false;
    const sanitized = sanitizeKeyboardMouse(binding);
    if (!sanitized) return false;

    this.overrides[id] = {
      ...(this.overrides[id] ?? {}),
      keyboardMouse: sanitized
    };
    this.persist();
    return true;
  }

  setGamepad(id: TraversalActionId, binding: GamepadBinding): boolean {
    const action = defaultTraversalAction(id);
    if (!action.remappable) return false;
    const sanitized = sanitizeGamepad(binding);
    if (!sanitized) return false;

    this.overrides[id] = {
      ...(this.overrides[id] ?? {}),
      gamepad: sanitized
    };
    this.persist();
    return true;
  }

  resetAction(id: TraversalActionId, device?: "keyboardMouse" | "gamepad"): void {
    const current = this.overrides[id];
    if (!current) return;

    if (!device) {
      delete this.overrides[id];
    } else {
      delete current[device];
      if (!current.keyboardMouse && !current.gamepad) delete this.overrides[id];
    }
    this.persist();
  }

  resetAll(): void {
    this.overrides = {};
    this.persist();
  }

  subscribe(listener: BindingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private load(): TraversalBindingOverrides {
    if (typeof localStorage === "undefined") return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Partial<StoredBindings>;
      if (parsed.version !== STORAGE_VERSION || !parsed.overrides || typeof parsed.overrides !== "object") {
        return {};
      }
      return sanitizeOverrides(parsed.overrides);
    } catch {
      return {};
    }
  }

  private persist(): void {
    if (typeof localStorage !== "undefined") {
      try {
        const payload: StoredBindings = {
          version: STORAGE_VERSION,
          overrides: this.overrides
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Binding persistence is optional; current-session resolved controls still work.
      }
    }
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("traversal:bindings-change", {
        detail: { overrides: this.snapshot() }
      }));
    }
  }
}

export const traversalBindings = new TraversalBindingsStore();

export function resolveTraversalAction(id: TraversalActionId): TraversalActionDefinition {
  return traversalBindings.resolve(id);
}

function sanitizeOverrides(input: TraversalBindingOverrides): TraversalBindingOverrides {
  const output: TraversalBindingOverrides = {};
  for (const action of TRAVERSAL_ACTIONS) {
    if (!action.remappable) continue;
    const candidate = input[action.id];
    if (!candidate || typeof candidate !== "object") continue;

    const keyboardMouse = candidate.keyboardMouse
      ? sanitizeKeyboardMouse(candidate.keyboardMouse) ?? undefined
      : undefined;
    const gamepad = candidate.gamepad
      ? sanitizeGamepad(candidate.gamepad) ?? undefined
      : undefined;

    if (keyboardMouse || gamepad) output[action.id] = { keyboardMouse, gamepad };
  }
  return output;
}

function sanitizeKeyboardMouse(input: KeyboardMouseBinding): KeyboardMouseBinding | null {
  if (!input || typeof input !== "object") return null;
  const output: KeyboardMouseBinding = {};

  if (Array.isArray(input.keys)) {
    output.keys = input.keys.filter(isCode).slice(0, 8);
  }
  if (input.moveKeys && typeof input.moveKeys === "object") {
    const { forward, backward, left, right } = input.moveKeys;
    if ([forward, backward, left, right].every(isCode)) {
      output.moveKeys = { forward, backward, left, right };
    }
  }
  if (Array.isArray(input.mouseButtons)) {
    output.mouseButtons = uniqueIntegers(input.mouseButtons, 0, 7);
  }
  if (input.wheel === "up" || input.wheel === "down") output.wheel = input.wheel;
  if (input.pointer === true) output.pointer = true;

  return output;
}

function sanitizeGamepad(input: GamepadBinding): GamepadBinding | null {
  if (!input || typeof input !== "object") return null;
  const output: GamepadBinding = {};

  if (Array.isArray(input.buttons)) {
    output.buttons = uniqueIntegers(input.buttons, 0, 31);
  }
  if (
    Array.isArray(input.axisPair) &&
    input.axisPair.length === 2 &&
    input.axisPair.every((value) => Number.isInteger(value) && value >= 0 && value <= 15)
  ) {
    output.axisPair = [input.axisPair[0]!, input.axisPair[1]!];
  }
  if (Number.isInteger(input.triggerButton) && input.triggerButton! >= 0 && input.triggerButton! <= 31) {
    output.triggerButton = input.triggerButton;
  }

  return output;
}

function uniqueIntegers(values: number[], min: number, max: number): number[] {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value >= min && value <= max))];
}

function isCode(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 48;
}

function cloneKeyboardMouse(binding: KeyboardMouseBinding): KeyboardMouseBinding {
  return {
    ...binding,
    keys: binding.keys ? [...binding.keys] : undefined,
    moveKeys: binding.moveKeys ? { ...binding.moveKeys } : undefined,
    mouseButtons: binding.mouseButtons ? [...binding.mouseButtons] : undefined
  };
}

function cloneGamepad(binding: GamepadBinding): GamepadBinding {
  return {
    ...binding,
    buttons: binding.buttons ? [...binding.buttons] : undefined,
    axisPair: binding.axisPair ? [...binding.axisPair] as [number, number] : undefined
  };
}

function cloneAction(action: TraversalActionDefinition): TraversalActionDefinition {
  return {
    ...action,
    keyboardMouse: cloneKeyboardMouse(action.keyboardMouse),
    gamepad: cloneGamepad(action.gamepad)
  };
}
