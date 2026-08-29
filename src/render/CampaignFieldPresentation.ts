import * as THREE from "three";
import type { ContentRuntime } from "../game/ContentRuntime";

type RuntimeState = {
  roomRoot: THREE.Group;
  loadRoom: (index: number) => void;
};

/** Adds non-collision landmark architecture to Campaign fields without polluting course readability. */
export function installCampaignFieldPresentation(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  const originalLoadRoom = state.loadRoom.bind(game);

  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    if (content.activeForm() !== "campaign-field") return;
    addFieldLandmarks(state.roomRoot);
  };
}

function addFieldLandmarks(root: THREE.Group): void {
  const group = new THREE.Group();
  group.name = "campaign-field-landmarks";

  const solid = new THREE.MeshStandardMaterial({
    color: 0x071624,
    emissive: 0x0a3e55,
    emissiveIntensity: 0.22,
    roughness: 0.7,
    metalness: 0.38
  });
  const line = new THREE.LineBasicMaterial({
    color: 0x70efff,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending
  });

  const slab = (
    size: [number, number, number],
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0]
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), solid.clone());
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    group.add(mesh);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), line.clone());
    edges.position.copy(mesh.position);
    edges.rotation.copy(mesh.rotation);
    group.add(edges);
  };

  // Giant readable silhouettes: architecture as distant landmarks, not puzzle noise.
  slab([3.2, 54, 8], [-48, 22, -46], [0.05, 0.18, -0.12]);
  slab([2.4, 44, 6], [55, 17, -86], [-0.08, -0.14, 0.09]);
  slab([34, 2.2, 4], [-31, 18, -91], [0.08, 0.24, -0.1]);
  slab([29, 1.8, 3], [34, 12, -28], [-0.04, -0.2, 0.08]);
  slab([4, 28, 4], [31, 8, -116], [0.18, 0.1, 0]);
  slab([4, 24, 5], [-26, 6, -119], [-0.14, -0.08, 0.12]);

  const shardData: Array<[[number, number, number], [number, number, number], [number, number, number]]> = [
    [[1.2, 12, 2.2], [-33, 15, -18], [0.35, 0.2, 0.4]],
    [[1.4, 9, 1.8], [39, 10, -48], [-0.25, 0.45, -0.3]],
    [[1.1, 15, 2.5], [-42, 5, -75], [0.5, -0.2, 0.15]],
    [[1.8, 8, 1.4], [45, 20, -105], [-0.35, 0.15, 0.5]],
    [[1.2, 11, 1.6], [-19, 24, -108], [0.28, 0.42, -0.18]],
    [[1.3, 13, 1.9], [26, 27, -70], [-0.42, -0.22, 0.2]]
  ];
  for (const [size, position, rotation] of shardData) slab(size, position, rotation);

  // Long horizon traces imply that the sector extends far beyond the playable slice.
  for (const [y, z, width] of [
    [-7, -35, 110],
    [-11, -80, 136],
    [31, -130, 92]
  ] as Array<[number, number, number]>) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-width * 0.5, y, z),
      new THREE.Vector3(width * 0.5, y, z)
    ]);
    group.add(new THREE.Line(geometry, line.clone()));
  }

  root.add(group);
}
