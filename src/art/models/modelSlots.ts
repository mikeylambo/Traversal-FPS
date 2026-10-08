import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { replaceProceduralVisual, type ProceduralVisualKey, type ProceduralVisualRegistration } from "../procedural/ProceduralVisualRegistry";

/**
 * Model slots: authored GLB art (Meshy, Blender, anything that exports glTF)
 * for a visual key. Drop the file in public/models/, set `enabled: true`, and it
 * replaces the procedural fallback as soon as it loads. A missing or broken file
 * leaves the procedural version in place, so slots are safe to switch on early.
 *
 * Every source arrives at its own scale and facing, so each slot normalises it:
 * centred on its bounds, turned so `forward` points down -Z (into the screen for
 * the rifle), and scaled so its longest side is `length` metres.
 */
export interface ModelSlot {
  key: ProceduralVisualKey;
  file: string;
  enabled: boolean;
  /** Longest side after normalising, in metres (the procedural rifle is ~1.2). */
  length: number;
  /** Which way the source model points. */
  forward?: "+x" | "-x" | "+z" | "-z";
  /** Fine placement after normalising, in the anchor's space. */
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Materials whose name contains this glow with the weapon's energy state. */
  energyMaterial?: string;
  tier?: ProceduralVisualRegistration["tier"];
}

export const MODEL_SLOTS: ModelSlot[] = [
  { key: "weapon.warp-rifle.default", file: "warp-rifle.glb", enabled: false, length: 1.25, forward: "-z", position: [0.02, -0.04, -0.52], energyMaterial: "energy", tier: "hero" },
  { key: "exit.gravity-ring.default", file: "gravity-ring.glb", enabled: false, length: 2.6, tier: "standard" },
  { key: "actor.cube.default", file: "cube-shell.glb", enabled: false, length: 1.6 },
  { key: "actor.diamond.default", file: "diamond-shell.glb", enabled: false, length: 2.2 },
  { key: "actor.prism.default", file: "prism-shell.glb", enabled: false, length: 2.4 },
  // Campaign architecture (src/render/ActEnvironment.ts sizes each instance itself).
  { key: "environment.act-i.pylon", file: "act1-pylon.glb", enabled: false, length: 1, tier: "background" },
  { key: "environment.act-ii.drum", file: "act2-drum.glb", enabled: false, length: 1, rotation: [0, 0, Math.PI / 2], tier: "background" },
  { key: "environment.act-iii.piston", file: "act3-piston.glb", enabled: false, length: 1, tier: "background" },
  { key: "environment.act-iv.ring", file: "act4-ring.glb", enabled: false, length: 1, tier: "background" },
  { key: "environment.finale.frame", file: "finale-frame.glb", enabled: false, length: 1, tier: "background" }
];

const FORWARD_YAW: Record<NonNullable<ModelSlot["forward"]>, number> = { "-z": 0, "+z": Math.PI, "+x": Math.PI / 2, "-x": -Math.PI / 2 };

function normalise(source: THREE.Object3D, slot: ModelSlot): THREE.Group {
  const pivot = new THREE.Group();
  pivot.add(source);
  source.rotation.y = FORWARD_YAW[slot.forward ?? "-z"];
  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source);
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const scale = slot.length / Math.max(size.x, size.y, size.z, 1e-6);
  source.position.sub(centre);
  const root = new THREE.Group();
  pivot.scale.setScalar(scale);
  root.add(pivot);
  return root;
}

function energyUpdate(slot: ModelSlot): ProceduralVisualRegistration["update"] {
  if (!slot.energyMaterial) return undefined;
  return (visual, dt, time) => {
    const state = (visual.parent?.userData.traversalWeaponState ?? {}) as { anchorReady?: boolean; warpHeld?: boolean; transiting?: boolean };
    const kick = (visual.parent?.userData.traversalFireKick as number | undefined) ?? 0;
    const level = state.transiting ? 7 : state.anchorReady && state.warpHeld ? 4.6 + Math.sin(time * 10) * 0.8 : state.anchorReady ? 3.4 : 2.4 + Math.sin(time * 1.4) * 0.2;
    // Parts named "*spin*" (e.g. Meshy ring segments split into their own mesh)
    // turn about the barrel, faster as the weapon charges.
    const spin = state.transiting ? 9 : state.anchorReady && state.warpHeld ? 5 : state.anchorReady ? 1.6 : 0.5;
    visual.traverse((object) => {
      if (object.name.toLowerCase().includes("spin")) object.rotation.z += dt * (spin + kick * 12);
      const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!material?.name?.toLowerCase().includes(slot.energyMaterial!)) return;
      material.emissiveIntensity = level * (1 + kick * 2.2);
    });
  };
}

export function loadModelSlots(base = `${import.meta.env.BASE_URL}models/`): void {
  const loader = new GLTFLoader();
  for (const slot of MODEL_SLOTS) {
    if (!slot.enabled) continue;
    loader.load(`${base}${slot.file}`, (gltf) => {
      const template = normalise(gltf.scene, slot);
      replaceProceduralVisual(slot.key, {
        factory: () => {
          const copy = template.clone(true);
          // Materials are shared by clone(); give each mount its own so energy
          // glow and disposal on unmount never touch another instance.
          copy.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
          });
          return copy;
        },
        options: { position: slot.position, rotation: slot.rotation },
        update: energyUpdate(slot),
        tier: slot.tier
      });
      console.info(`Traversal model slot // ${slot.key} <- ${slot.file}`);
    }, undefined, () => console.warn(`Traversal model slot // ${slot.file} not loaded; keeping the procedural ${slot.key}`));
  }
}
