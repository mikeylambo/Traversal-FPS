import { registeredProceduralVisualKeys } from "./ProceduralVisualRegistry";

/**
 * Single boot point for generated/procedural Traversal art.
 *
 * When an img2threejs output is accepted, place its factory under
 * `src/art/procedural/models/`, import it here, and register its stable visual key.
 * Gameplay modules never import generated model files directly.
 *
 * Example:
 *   import { createWarpRifleModel } from "./models/createWarpRifleModel";
 *   import { registerProceduralVisual } from "./ProceduralVisualRegistry";
 *   registerProceduralVisual("weapon.warp-rifle.default", {
 *     factory: createWarpRifleModel,
 *     tier: "hero"
 *   });
 */
export function bootProceduralVisualManifest(): void {
  const keys = registeredProceduralVisualKeys();
  if (keys.length > 0) console.info(`Traversal procedural visuals // ${keys.join(", ")}`);
}
