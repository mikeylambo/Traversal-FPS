import * as THREE from "three";
import { emitTraversalAudio, preloadTraversalAudioEvents } from "../audio/TraversalAudio";
import { resolveTraversalAction } from "../input/TraversalBindings";

type Transit = {
  from: THREE.Vector3;
  to: THREE.Vector3;
  elapsed: number;
  duration: number;
};

type WarpAccess = {
  commit(position: THREE.Vector3): boolean;
  isTransiting(): boolean;
  hasAnchor(): boolean;
  // WarpSystem currently keeps transit private. This contained runtime access lets
  // Rewind reuse the exact certified physical transit/arrival path without adding
  // a second movement system. Promote to a public WarpSystem method if Rewind stays.
  transit: Transit | null;
};

type RuntimeState = {
  modeId: string;
  difficultyId: string;
  shots: number;
  camera: THREE.PerspectiveCamera;
  warp: WarpAccess;
  update(dt: number): void;
  shoot(): void;
  loadRoom(index: number): void;
  playWarpArrival(): void;
};

/**
 * One-step movement undo. It reverses only the last Warp: sphere kills, shots,
 * and consumed vectors remain committed. Firing after commit invalidates Rewind,
 * preventing shoot-and-retreat scouting loops.
 *
 * Difficulty contract: Rewind is a tier lever, not a mode-rule lever. Assist and
 * Standard provide it in every mode; Hard and Expert solve without undo.
 */
export function installRewindWarpRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  let rewindOrigin: THREE.Vector3 | null = null;
  let pendingArrival = false;
  let available = false;
  let rewinding = false;
  let keyboardQueued = false;
  let previousPadPressed = false;

  const clear = () => {
    rewindOrigin = null;
    pendingArrival = false;
    available = false;
    rewinding = false;
    document.body.classList.remove("rewind-available", "rewinding");
  };

  const originalCommit = state.warp.commit.bind(state.warp);
  state.warp.commit = (position: THREE.Vector3) => {
    const origin = position.clone();
    const committed = originalCommit(position);
    if (committed && eligible(state)) {
      rewindOrigin = origin;
      pendingArrival = true;
      available = false;
      rewinding = false;
    }
    return committed;
  };

  const originalShoot = state.shoot.bind(game);
  state.shoot = () => {
    const shotsBefore = state.shots;
    originalShoot();
    if (state.shots > shotsBefore && (available || pendingArrival)) clear();
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    clear();
    originalLoadRoom(index);
    // Rewind audio is only reachable on Assist/Standard, so it is fetched when a
    // room first makes it possible rather than sitting in the boot bundle.
    if (eligible(state)) void preloadTraversalAudioEvents(["rewind.begin", "rewind.arrive"]);
  };

  // The reverse transit reuses WarpSystem's certified arrival path, so the arrival
  // cue arrives through the normal warp hook. Retimbre it rather than adding a
  // second arrival sound on top of the first.
  const originalWarpArrival = state.playWarpArrival.bind(game);
  state.playWarpArrival = () => {
    if (rewinding) emitTraversalAudio("rewind.arrive");
    else originalWarpArrival();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!available || event.repeat) return;
    const keys = resolveTraversalAction("rewind").keyboardMouse.keys ?? [];
    if (!keys.includes(event.code)) return;
    event.preventDefault();
    keyboardQueued = true;
  };
  window.addEventListener("keydown", onKeyDown, true);

  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    originalUpdate(dt);

    if (!eligible(state) && (available || pendingArrival || rewinding)) clear();

    if (pendingArrival && !state.warp.isTransiting()) {
      pendingArrival = false;
      available = Boolean(rewindOrigin) && eligible(state);
    }

    const padPressed = rewindPadPressed();
    const padQueued = padPressed && !previousPadPressed;
    previousPadPressed = padPressed;

    if (available && rewindOrigin && !state.warp.isTransiting() && (keyboardQueued || padQueued)) {
      const from = state.camera.position.clone();
      const to = rewindOrigin.clone();
      const distance = from.distanceTo(to);
      state.warp.transit = {
        from,
        to,
        elapsed: 0,
        duration: Math.max(0.075, distance / 82)
      };
      rewindOrigin = null;
      available = false;
      pendingArrival = false;
      rewinding = true;
      emitTraversalAudio("rewind.begin");
      document.body.classList.add("rewinding");
    }
    keyboardQueued = false;

    if (rewinding && !state.warp.isTransiting()) {
      rewinding = false;
      document.body.classList.remove("rewinding");
    }

    document.body.classList.toggle("rewind-available", available);
    updateHint(state, available, rewinding);
  };
}

function eligible(state: RuntimeState): boolean {
  return state.difficultyId === "assist" || state.difficultyId === "standard";
}

function rewindPadPressed(): boolean {
  const binding = resolveTraversalAction("rewind").gamepad;
  const indices = [...(binding.buttons ?? [])];
  if (binding.triggerButton !== undefined) indices.push(binding.triggerButton);
  if (indices.length === 0) return false;

  const pads = navigator.getGamepads?.() ?? [];
  const pad = [...pads].find((candidate) => candidate?.connected) ?? null;
  if (!pad) return false;
  return indices.some((index) => {
    const button = pad.buttons[index];
    return Boolean(button && (button.pressed || button.value > 0.55));
  });
}

function updateHint(state: RuntimeState, available: boolean, rewinding: boolean): void {
  const hint = document.getElementById("warp-hint");
  if (!hint || state.warp.hasAnchor()) return;
  if (rewinding) {
    hint.textContent = "REWINDING LAST WARP";
    return;
  }
  if (!available) return;

  const pad = document.body.classList.contains("gamepad-active");
  hint.textContent = pad ? "Y // REWIND LAST WARP" : "Z // REWIND LAST WARP";
}
