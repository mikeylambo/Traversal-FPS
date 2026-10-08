import { registeredProceduralVisualKeys, registerProceduralVisual } from "./ProceduralVisualRegistry";
import { createWarpRifleModel, updateWarpRifleModel } from "./models/createWarpRifleModel";
import { loadModelSlots } from "../models/modelSlots";

registerProceduralVisual("weapon.warp-rifle.default", {
  factory: createWarpRifleModel,
  update: updateWarpRifleModel,
  tier: "hero",
  options: {
    scale: 0.52,
    position: [0.05, -0.06, -0.18],
    rotation: [-0.03, 0.05, 0.012]
  }
});

/**
 * Single boot point for generated/procedural Traversal art.
 *
 * Procedural factories register here as the guaranteed fallback. Authored GLB
 * art (Meshy, Blender) lives in src/art/models/modelSlots.ts and replaces a key
 * once its file loads. Gameplay modules never import model files directly.
 */
loadModelSlots();

export function bootProceduralVisualManifest(): void {
  const keys = registeredProceduralVisualKeys();
  if (keys.length > 0) console.info(`Traversal procedural visuals // ${keys.join(", ")}`);
}
