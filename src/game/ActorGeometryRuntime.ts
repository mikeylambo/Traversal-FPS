import * as THREE from "three";
import { mountRegisteredVisual, type ProceduralVisualKey } from "../art/procedural/ProceduralVisualRegistry";
import type { EnemySpec } from "../world/stages";
import { installActorLinkRuntime } from "./ActorLinkRuntime";
import { UTILITY_ROLE_COLORS } from "./TraversalAccessibility";

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
    // Utilities are hard-edged and ringless; Spheres stay round and haloed.
    // Silhouette carries the role even in greyscale: box, tall gem, lens bar.
    const body = kind === "cube"
      ? new THREE.BoxGeometry(radius * 1.7, radius * 1.7, radius * 1.7)
      : kind === "diamond"
        ? new THREE.OctahedronGeometry(radius * 1.1, 0).scale(0.8, 1.7, 0.8)
        : new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, radius * 3.1, 3, 1, false);
    replaceGeometry(enemy, body);
    stripHalo(enemy);
    // Own material, outside the shared energy shader: dim faces, bright edges,
    // so bloom draws the silhouette instead of a glowing blob.
    const role = new THREE.Color(UTILITY_ROLE_COLORS[kind]);
    const faces = new THREE.MeshStandardMaterial({
      color: role.clone().multiplyScalar(0.32),
      emissive: role,
      emissiveIntensity: 0.22,
      metalness: 0.55,
      roughness: 0.32,
      flatShading: true
    });
    enemy.mesh.material = faces;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(body),
      new THREE.LineBasicMaterial({ color: UTILITY_ROLE_COLORS[kind], transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    edges.scale.setScalar(1.015);
    edges.name = "utility-edges";
    enemy.mesh.add(edges);
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

/** Removes the Sphere halo (wire shell + orbit rings) so utilities never read round. */
function stripHalo(enemy: ActiveEnemy): void {
  for (const child of [...enemy.mesh.children]) {
    if (!(child instanceof THREE.Mesh)) continue;
    const geometry = child.geometry;
    const wire = child.material instanceof THREE.MeshBasicMaterial && child.material.wireframe;
    if (wire || geometry instanceof THREE.TorusGeometry || geometry instanceof THREE.IcosahedronGeometry) {
      enemy.mesh.remove(child);
      geometry.dispose();
    }
  }
}
