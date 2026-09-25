import * as THREE from "three";
import { mountRegisteredVisual, type ProceduralVisualKey } from "../art/procedural/ProceduralVisualRegistry";
import type { EnemySpec } from "../world/stages";
import { installActorLinkRuntime } from "./ActorLinkRuntime";

type ActiveEnemy = {
  spec: EnemySpec;
  mesh: THREE.Mesh;
};

type RuntimeState = {
  enemies: ActiveEnemy[];
  loadRoom(index: number): void;
};

const SPHERE_COLOR = 0x7cefff;

/**
 * Shape is the semantic channel. Procedural visuals are presentation-only children;
 * the authoritative enemy mesh remains simple, stable, and gameplay-safe.
 */
export function installActorGeometryRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  const originalLoadRoom = state.loadRoom.bind(game);

  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    for (const enemy of state.enemies) applyGeometry(enemy);
  };

  installActorLinkRuntime(game);
}

function applyGeometry(enemy: ActiveEnemy): void {
  const radius = enemy.spec.radius ?? 0.72;
  const material = enemy.mesh.material;

  const kind = enemy.spec.kind;
  if (kind === "cube" || kind === "diamond" || kind === "prism") {
    // Same energy glow, wire shell and rings as a Sphere, so every actor reads as
    // one family; the body and shell take the utility's own silhouette.
    const shape = (scale: number) => kind === "cube"
      ? new THREE.BoxGeometry(radius * 1.6 * scale, radius * 1.6 * scale, radius * 1.6 * scale)
      : kind === "diamond"
        ? new THREE.OctahedronGeometry(radius * 1.05 * scale, 0).scale(0.82, 1.55, 0.82)
        : new THREE.CylinderGeometry(radius * 0.7 * scale, radius * 0.7 * scale, radius * 2.8 * scale, 3, 1, false);
    replaceGeometry(enemy, shape(1));
    replaceWireShell(enemy, shape(1.18));
    if (kind === "cube") enemy.mesh.rotation.set(0.22, 0.35, 0.12);
    if (kind === "diamond") enemy.mesh.rotation.set(0, 0, 0);
    if (kind === "prism") enemy.mesh.rotation.set(Math.PI * 0.5, 0, 0);
  } else {
    setMaterialColor(material, SPHERE_COLOR);
  }

  // No registration means no change: current primitives remain the guaranteed fallback.
  mountRegisteredVisual(enemy.mesh, `actor.${enemy.spec.kind}.default` as ProceduralVisualKey, {
    scale: radius / 0.72
  });
}

function replaceGeometry(enemy: ActiveEnemy, geometry: THREE.BufferGeometry): void {
  enemy.mesh.geometry.dispose();
  enemy.mesh.geometry = geometry;
}

function replaceWireShell(enemy: ActiveEnemy, geometry: THREE.BufferGeometry): void {
  const shell = enemy.mesh.children.find((child) =>
    child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial && child.material.wireframe);
  if (!(shell instanceof THREE.Mesh)) {
    geometry.dispose();
    return;
  }
  shell.geometry.dispose();
  shell.geometry = geometry;
}

function setMaterialColor(material: THREE.Material | THREE.Material[], color: number, emissiveIntensity?: number): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) {
    if (entry instanceof THREE.MeshStandardMaterial || entry instanceof THREE.MeshBasicMaterial) {
      entry.color.setHex(color);
      if (entry instanceof THREE.MeshStandardMaterial) {
        entry.emissive.setHex(color);
        if (emissiveIntensity !== undefined) entry.emissiveIntensity = emissiveIntensity;
      }
    }
  }
}
