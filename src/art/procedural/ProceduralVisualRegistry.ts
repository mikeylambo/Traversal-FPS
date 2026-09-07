import * as THREE from "three";
import {
  attachProceduralVisual,
  detachProceduralVisual,
  type ProceduralVisualFactory,
  type ProceduralVisualOptions
} from "./attachProceduralVisual";

export type ProceduralVisualKey =
  | "weapon.warp-rifle.default"
  | "exit.gravity-ring.default"
  | "actor.sentry.default"
  | "actor.drifter.default"
  | "actor.shield.default"
  | "actor.orbit.default"
  | "actor.cube.default"
  | "actor.diamond.default"
  | "actor.prism.default"
  | `platform.${string}`
  | `hazard.${string}`
  | `environment.${string}`;

export interface ProceduralVisualRegistration {
  factory: ProceduralVisualFactory;
  options?: ProceduralVisualOptions;
  /** Optional animation/update callback returned models can expose through userData. */
  update?: (visual: THREE.Group, dt: number, time: number) => void;
  /** Optional normalized performance tier for future LOD decisions. */
  tier?: "hero" | "standard" | "background";
}

const registry = new Map<ProceduralVisualKey, ProceduralVisualRegistration>();

export function registerProceduralVisual(
  key: ProceduralVisualKey,
  registration: ProceduralVisualRegistration | ProceduralVisualFactory
): void {
  registry.set(
    key,
    typeof registration === "function" ? { factory: registration } : registration
  );
}

export function unregisterProceduralVisual(key: ProceduralVisualKey): void {
  registry.delete(key);
}

export function hasProceduralVisual(key: ProceduralVisualKey): boolean {
  return registry.has(key);
}

export function mountRegisteredVisual(
  anchor: THREE.Object3D,
  key: ProceduralVisualKey,
  overrides: ProceduralVisualOptions = {}
): THREE.Group | null {
  const registration = registry.get(key);
  if (!registration) return null;

  const previous = anchor.userData.traversalProceduralVisual as THREE.Object3D | undefined;
  if (previous) detachProceduralVisual(previous);

  const options = { ...registration.options, ...overrides };
  const visual = attachProceduralVisual(anchor, registration.factory, {
    ...options,
    name: options.name ?? key
  });
  visual.userData.traversalVisualKey = key;
  visual.userData.traversalVisualTier = registration.tier ?? "standard";
  anchor.userData.traversalProceduralVisual = visual;
  return visual;
}

export function updateRegisteredVisual(
  anchor: THREE.Object3D,
  dt: number,
  time: number
): void {
  const visual = anchor.userData.traversalProceduralVisual as THREE.Group | undefined;
  if (!visual) return;
  const key = visual.userData.traversalVisualKey as ProceduralVisualKey | undefined;
  if (!key) return;
  registry.get(key)?.update?.(visual, dt, time);
}

export function clearRegisteredVisual(anchor: THREE.Object3D): void {
  const visual = anchor.userData.traversalProceduralVisual as THREE.Object3D | undefined;
  if (!visual) return;
  detachProceduralVisual(visual);
  delete anchor.userData.traversalProceduralVisual;
}

/**
 * Generated img2threejs files should import registerProceduralVisual and register
 * themselves once. Gameplay code only asks for keys; it never imports generated art.
 */
export function registeredProceduralVisualKeys(): ProceduralVisualKey[] {
  return [...registry.keys()];
}
