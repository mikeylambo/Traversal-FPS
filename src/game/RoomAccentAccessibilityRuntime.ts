import * as THREE from "three";
import { traversalAccessibility } from "./TraversalAccessibility";
import type { ColorProfile } from "./TraversalSettings";

type RuntimeState = {
  roomIndex: number;
  roomRoot: THREE.Group;
  platformMeshes: THREE.Mesh[];
  loadRoom(index: number): void;
};

const ROOM_ACCENT_PALETTES: Record<ColorProfile, readonly number[]> = {
  // The Standard profile preserves the authored campaign palette exactly.
  standard: [0x69e7ff, 0xffcf66, 0xff78c8, 0xff9d67, 0xa1ff91],
  // Red/green-deficient profiles lean on blue/yellow, violet and luminance.
  deuteranopia: [0x69d5ff, 0xffd35a, 0xb8a2ff, 0xf4f5ff, 0x77e6ff],
  protanopia: [0x5fc9ff, 0xffdc64, 0xb39cff, 0xf5f5ff, 0x72e7ff],
  // Tritanopia shifts decorative separation toward red/green plus white.
  tritanopia: [0x6bffc8, 0xff6f72, 0xffffff, 0xff9b9d, 0x82ff72]
};

/**
 * ROOM_ACCENTS are decorative, but once a player selects a colour profile the
 * decorative language should not fight that profile. Keep HUD accent, platform
 * emissive and platform edge lines in the same accessible palette.
 */
export function installRoomAccentAccessibilityRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  const originalLoadRoom = state.loadRoom.bind(game);

  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    applyRoomAccent(state, index);
    // Presentation runtimes installed later may refine platform materials during
    // the same room load. Re-apply once after the current task so the profile wins.
    window.setTimeout(() => applyRoomAccent(state, state.roomIndex), 0);
  };

  window.addEventListener("traversal:accessibility-changed", () => {
    applyRoomAccent(state, state.roomIndex);
  });

  applyRoomAccent(state, state.roomIndex);
}

function applyRoomAccent(state: RuntimeState, roomIndex: number): void {
  const palette = ROOM_ACCENT_PALETTES[traversalAccessibility().colorProfile];
  const accent = palette[roomIndex % palette.length]!;
  const color = new THREE.Color(accent);

  document.documentElement.style.setProperty("--hud-accent", `#${color.getHexString()}`);

  for (const platform of state.platformMeshes) {
    const materials = Array.isArray(platform.material) ? platform.material : [platform.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial) material.emissive.setHex(accent);
    }
  }

  // Base room platform outlines are direct LineSegments children of roomRoot.
  // Actor geometry uses nested children, so this does not recolour actor identity.
  for (const child of state.roomRoot.children) {
    if (!(child instanceof THREE.LineSegments)) continue;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material instanceof THREE.LineBasicMaterial) material.color.setHex(accent);
    }
  }
}
