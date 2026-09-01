import * as THREE from "three";
import type { EnemySpec } from "../world/stages";

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
 * Shape is the semantic channel. Color can reinforce presentation, but every actor
 * remains readable in monochrome and under common color-vision deficiencies.
 */
export function installActorGeometryRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  const originalLoadRoom = state.loadRoom.bind(game);

  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    for (const enemy of state.enemies) applyGeometry(enemy);
  };
}

function applyGeometry(enemy: ActiveEnemy): void {
  const radius = enemy.spec.radius ?? 0.72;
  const material = enemy.mesh.material;

  if (enemy.spec.kind === "cube") {
    replaceGeometry(enemy, new THREE.BoxGeometry(radius * 1.75, radius * 1.75, radius * 1.75));
    replaceWireShell(enemy, new THREE.BoxGeometry(radius * 2.02, radius * 2.02, radius * 2.02));
    setMaterialColor(material, 0xeef4ff);
    enemy.mesh.rotation.set(0.22, 0.35, 0.12);
    return;
  }

  if (enemy.spec.kind === "diamond") {
    replaceGeometry(enemy, new THREE.OctahedronGeometry(radius * 1.22, 0));
    replaceWireShell(enemy, new THREE.OctahedronGeometry(radius * 1.42, 0));
    setMaterialColor(material, 0xd7fff1);
    enemy.mesh.rotation.set(0, 0, Math.PI * 0.25);
    return;
  }

  if (enemy.spec.kind === "prism") {
    replaceGeometry(enemy, new THREE.CylinderGeometry(radius, radius, radius * 2.05, 3, 1, false));
    replaceWireShell(enemy, new THREE.CylinderGeometry(radius * 1.17, radius * 1.17, radius * 2.36, 3, 1, false));
    setMaterialColor(material, 0xffedc7);
    enemy.mesh.rotation.set(Math.PI * 0.5, 0, 0);
    return;
  }

  // All vector endpoints remain visibly spherical; behavior is communicated by
  // rails, shields, orbit rings, and motion rather than hue changes.
  setMaterialColor(material, SPHERE_COLOR);
}

function replaceGeometry(enemy: ActiveEnemy, geometry: THREE.BufferGeometry): void {
  enemy.mesh.geometry.dispose();
  enemy.mesh.geometry = geometry;
}

function replaceWireShell(enemy: ActiveEnemy, geometry: THREE.BufferGeometry): void {
  const shell = enemy.mesh.children.find((child) => {
    if (!(child instanceof THREE.Mesh)) return false;
    const material = child.material;
    return material instanceof THREE.MeshBasicMaterial && material.wireframe;
  });
  if (!(shell instanceof THREE.Mesh)) {
    geometry.dispose();
    return;
  }
  shell.geometry.dispose();
  shell.geometry = geometry;
}

function setMaterialColor(material: THREE.Material | THREE.Material[], color: number): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) {
    if (entry instanceof THREE.MeshStandardMaterial || entry instanceof THREE.MeshBasicMaterial) {
      entry.color.setHex(color);
      if (entry instanceof THREE.MeshStandardMaterial) entry.emissive.setHex(color);
    }
  }
}
