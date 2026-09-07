import * as THREE from "three";

export type ProceduralVisualFactory = () => THREE.Group;

export interface ProceduralVisualOptions {
  scale?: number | readonly [number, number, number];
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  name?: string;
}

/**
 * Mounts presentation-only Three.js geometry onto an existing semantic gameplay
 * object. Generated/img2threejs visuals stay children of the authoritative actor,
 * so collision, targeting, puzzle effects, and movement remain owned by Traversal.
 */
export function attachProceduralVisual(
  anchor: THREE.Object3D,
  factory: ProceduralVisualFactory,
  options: ProceduralVisualOptions = {}
): THREE.Group {
  const visual = factory();
  visual.name = options.name ?? visual.name ?? "procedural-visual";
  visual.userData.traversalPresentationOnly = true;

  if (typeof options.scale === "number") {
    visual.scale.setScalar(options.scale);
  } else if (options.scale) {
    visual.scale.set(...options.scale);
  }

  if (options.position) visual.position.set(...options.position);
  if (options.rotation) visual.rotation.set(...options.rotation);

  visual.traverse((child) => {
    child.userData.traversalPresentationOnly = true;
  });

  anchor.add(visual);
  return visual;
}

export function detachProceduralVisual(visual: THREE.Object3D): void {
  visual.removeFromParent();
  visual.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}
