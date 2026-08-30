export type TraversalActionId =
  | "move"
  | "look"
  | "fire"
  | "warp"
  | "landing-shorter"
  | "landing-longer"
  | "crouch"
  | "scope"
  | "reset"
  | "pause";

export type TraversalActionKind = "axis-2d" | "button" | "hold";

export type MovementKeys = {
  forward: string;
  backward: string;
  left: string;
  right: string;
};

export type KeyboardMouseBinding = {
  keys?: string[];
  moveKeys?: MovementKeys;
  mouseButtons?: number[];
  wheel?: "up" | "down";
  pointer?: true;
};

export type GamepadBinding = {
  buttons?: number[];
  axisPair?: [number, number];
  triggerButton?: number;
};

export interface TraversalActionDefinition {
  id: TraversalActionId;
  label: string;
  kind: TraversalActionKind;
  remappable: boolean;
  keyboardMouse: KeyboardMouseBinding;
  gamepad: GamepadBinding;
  touchControl?: string;
}

/**
 * Canonical action manifest. Gameplay consumes these semantic IDs rather than
 * owning device bindings. Persisted overrides are merged on top by
 * TraversalBindingsStore; this table remains the immutable default profile.
 */
export const TRAVERSAL_ACTIONS: readonly TraversalActionDefinition[] = [
  {
    id: "move",
    label: "Move",
    kind: "axis-2d",
    remappable: true,
    keyboardMouse: {
      moveKeys: {
        forward: "KeyW",
        backward: "KeyS",
        left: "KeyA",
        right: "KeyD"
      }
    },
    gamepad: { axisPair: [0, 1] },
    touchControl: "move-stick"
  },
  {
    id: "look",
    label: "Look",
    kind: "axis-2d",
    remappable: false,
    keyboardMouse: { pointer: true },
    gamepad: { axisPair: [2, 3] },
    touchControl: "look-pad"
  },
  {
    id: "fire",
    label: "Fire",
    kind: "button",
    remappable: true,
    keyboardMouse: { mouseButtons: [0] },
    gamepad: { triggerButton: 7 },
    touchControl: "mobile-fire"
  },
  {
    id: "warp",
    label: "Warp",
    kind: "hold",
    remappable: true,
    keyboardMouse: { mouseButtons: [2] },
    gamepad: { triggerButton: 6 },
    touchControl: "mobile-warp"
  },
  {
    id: "landing-shorter",
    label: "Landing Shorter",
    kind: "button",
    remappable: true,
    keyboardMouse: { wheel: "down" },
    gamepad: { buttons: [5] },
    touchControl: "mobile-range"
  },
  {
    id: "landing-longer",
    label: "Landing Longer",
    kind: "button",
    remappable: true,
    keyboardMouse: { wheel: "up" },
    gamepad: { buttons: [4] },
    touchControl: "mobile-range"
  },
  {
    id: "crouch",
    label: "Crouch",
    kind: "hold",
    remappable: true,
    keyboardMouse: { keys: ["ControlLeft", "ControlRight", "KeyC"] },
    gamepad: { buttons: [10, 1] },
    touchControl: "mobile-crouch"
  },
  {
    id: "scope",
    label: "Scope",
    kind: "button",
    remappable: true,
    keyboardMouse: { keys: ["KeyQ"] },
    gamepad: { buttons: [11] },
    touchControl: "mobile-scope"
  },
  {
    id: "reset",
    label: "Reset",
    kind: "button",
    remappable: true,
    keyboardMouse: { keys: ["KeyR"] },
    gamepad: { buttons: [2] },
    touchControl: "mobile-reset"
  },
  {
    id: "pause",
    label: "Pause",
    kind: "button",
    remappable: false,
    keyboardMouse: { keys: ["Escape"] },
    gamepad: { buttons: [9] },
    touchControl: "mobile-pause"
  }
] as const;

export type TraversalBindingOverrides = Partial<Record<TraversalActionId, {
  keyboardMouse?: KeyboardMouseBinding;
  gamepad?: GamepadBinding;
}>>;

export const DEFAULT_KEYBOARD_CODES = {
  moveForward: "KeyW",
  moveLeft: "KeyA",
  moveBackward: "KeyS",
  moveRight: "KeyD",
  crouch: ["ControlLeft", "ControlRight", "KeyC"],
  scope: "KeyQ",
  reset: "KeyR"
} as const;

export const DEFAULT_GAMEPAD_BINDINGS = {
  moveAxes: [0, 1] as const,
  lookAxes: [2, 3] as const,
  fire: 7,
  warp: 6,
  landingShorter: 5,
  landingLonger: 4,
  crouch: [10, 1] as const,
  scope: 11,
  reset: 2,
  pause: 9
} as const;

export function defaultTraversalAction(id: TraversalActionId): TraversalActionDefinition {
  const action = TRAVERSAL_ACTIONS.find((candidate) => candidate.id === id);
  if (!action) throw new Error(`Unknown Traversal action: ${id}`);
  return action;
}
