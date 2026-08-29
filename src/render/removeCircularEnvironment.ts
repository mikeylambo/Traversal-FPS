import * as THREE from "three";

type RuntimeState = {
  roomRoot: THREE.Group;
  loadRoom: (index: number) => void;
};

/** Keeps gameplay/target rings, but removes the large ambient torus decorations. */
export function removeCircularEnvironment(game: object): void {
  const state = game as unknown as RuntimeState;
  const originalLoadRoom = state.loadRoom.bind(game);

  state.loadRoom = (index: number) => {
    originalLoadRoom(index);

    for (const child of [...state.roomRoot.children]) {
      if (!(child instanceof THREE.Mesh) || !(child.geometry instanceof THREE.TorusGeometry)) continue;
      state.roomRoot.remove(child);
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  };
}
