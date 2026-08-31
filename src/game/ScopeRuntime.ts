import * as THREE from "three";
import { resolveTraversalAction } from "../input/TraversalBindings";
import type { TraversalSettingsStore } from "./TraversalSettings";

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  gameSettings: { value: { fov: number } };
  input: {
    consumeLook(): { x: number; y: number };
    isWarpHeld(): boolean;
  };
  warp: {
    isTransiting(): boolean;
  };
  weapon: {
    group: THREE.Group;
  };
  update(dt: number): void;
};

/** Precision scope is a positioning/visibility tool, not a second weapon mode. */
export function installScopeRuntime(game: object, settings: TraversalSettingsStore): void {
  const state = game as unknown as RuntimeState;
  let scoped = false;
  let blend = 0;

  const setScoped = (next: boolean) => {
    scoped = next;
    document.body.classList.toggle("scope-active", scoped);
    window.dispatchEvent(new CustomEvent("traversal:scope-change", { detail: { active: scoped } }));
  };

  const overlay = document.createElement("div");
  overlay.id = "scope-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `<span class="scope-mark scope-mark-left"></span><span class="scope-mark scope-mark-right"></span>`;
  document.body.appendChild(overlay);

  const mobileControls = document.getElementById("mobile-controls");
  if (mobileControls) {
    const button = document.createElement("button");
    button.id = "mobile-scope";
    button.className = "mobile-small mobile-scope";
    button.type = "button";
    button.textContent = "SCOPE";
    button.addEventListener("click", () => setScoped(!scoped));
    mobileControls.appendChild(button);
  }

  window.addEventListener("traversal:scope-toggle", () => {
    if (!document.body.classList.contains("playing")) return;
    setScoped(!scoped);
  });

  window.addEventListener("keydown", (event) => {
    const keys = resolveTraversalAction("scope").keyboardMouse.keys ?? [];
    if (!keys.includes(event.code) || event.repeat) return;
    if (!document.body.classList.contains("playing")) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
    event.preventDefault();
    setScoped(!scoped);
  });

  window.addEventListener("mousedown", (event) => {
    const buttons = resolveTraversalAction("scope").keyboardMouse.mouseButtons ?? [];
    if (!buttons.includes(event.button)) return;
    if (!document.body.classList.contains("playing")) return;
    event.preventDefault();
    setScoped(!scoped);
  });

  const originalLook = state.input.consumeLook.bind(state.input);
  state.input.consumeLook = () => {
    const look = originalLook();
    const gamepad = document.body.classList.contains("gamepad-active");
    const precision = scoped
      ? gamepad ? settings.value.controllerScopeSensitivity : 0.56
      : 1;
    return { x: look.x * precision, y: look.y * precision };
  };

  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    if (!document.body.classList.contains("playing") && scoped) setScoped(false);

    originalUpdate(dt);

    // Scope remains available while holding Warp so distant/low landing points
    // can be placed precisely. Physical transit still suppresses the scope and it
    // returns automatically afterward if the toggle remains active.
    const allowed = scoped && !state.warp.isTransiting();
    const targetBlend = allowed ? 1 : 0;
    blend = THREE.MathUtils.lerp(blend, targetBlend, 1 - Math.pow(0.0008, dt));

    const baseFov = state.gameSettings.value.fov;
    const scopedFov = THREE.MathUtils.clamp(baseFov * 0.5, 36, 48);
    state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, scopedFov, blend);
    state.camera.updateProjectionMatrix();

    const weapon = state.weapon.group;
    weapon.position.x -= 0.37 * blend;
    weapon.position.y += 0.085 * blend;
    weapon.position.z += 0.075 * blend;
    weapon.rotation.x += 0.026 * blend;
    weapon.rotation.y += 0.024 * blend;
    weapon.rotation.z += 0.044 * blend;

    document.documentElement.style.setProperty("--scope-blend", blend.toFixed(3));
  };
}
