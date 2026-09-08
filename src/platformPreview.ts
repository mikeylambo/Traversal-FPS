import * as THREE from "three";
import { SVGRenderer } from "three/examples/jsm/renderers/SVGRenderer.js";
import {
  configureTraversalMovingPlatformRenderer,
  createTraversalMovingPlatformEnvironment,
  createTraversalMovingPlatformLookDevLights,
  createTraversalMovingPlatformModel,
  frameTraversalMovingPlatformCamera
} from "./art/procedural/models/createTraversalPlatformModel";

let renderer: THREE.WebGLRenderer | SVGRenderer;
let webglRenderer: THREE.WebGLRenderer | null = null;

try {
  webglRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  webglRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  webglRenderer.shadowMap.enabled = true;
  webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  configureTraversalMovingPlatformRenderer(webglRenderer);
  renderer = webglRenderer;
  document.body.dataset.renderer = "webgl";
} catch (error) {
  console.warn("Platform look-dev is using the silhouette-safe SVG fallback", error);
  renderer = new SVGRenderer();
  renderer.setQuality("high");
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.dataset.renderer = "svg";
}

renderer.setSize(innerWidth, innerHeight);
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
// Keep review captures chromatically neutral so the img2threejs foreground
// segmenter measures the platform instead of treating a saturated backdrop as
// part of the silhouette. The in-game environment remains unchanged.
scene.background = new THREE.Color(0x0a0a0a);
if (webglRenderer) scene.environment = createTraversalMovingPlatformEnvironment(webglRenderer);
scene.add(createTraversalMovingPlatformLookDevLights("reference"));

const model = createTraversalMovingPlatformModel();
if (!webglRenderer) {
  const fallbackMaterial = (materialId?: string, componentId?: string): THREE.MeshBasicMaterial => {
    const color = componentId === "top-panel-x" || componentId === "top-panel-z"
      ? 0x7d8a91
      : materialId === "shell-white"
      ? 0xe7ecef
      : materialId === "emitter-cyan"
        ? 0x26d9f2
        : componentId === "central-cassette" || materialId === "dark-detail"
          ? 0x0a1117
          : 0x17232c;
    return new THREE.MeshBasicMaterial({ color });
  };

  // SVGRenderer does not apply InstancedMesh instance matrices. Expand only
  // in the fallback review scene so the production/WebGL model stays instanced.
  const instancedMeshes: THREE.InstancedMesh[] = [];
  model.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) instancedMeshes.push(object);
  });
  for (const instanced of instancedMeshes) {
    const group = new THREE.Group();
    group.name = `${instanced.name}__svg-fallback`;
    group.position.copy(instanced.position);
    group.quaternion.copy(instanced.quaternion);
    group.scale.copy(instanced.scale);
    const repetitionMaterial = instanced.name.includes("cyan") ? "emitter-cyan" : "dark-detail";
    const material = fallbackMaterial(repetitionMaterial);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < instanced.count; index += 1) {
      const child = new THREE.Mesh(instanced.geometry, material);
      instanced.getMatrixAt(index, matrix);
      matrix.decompose(child.position, child.quaternion, child.scale);
      group.add(child);
    }
    instanced.parent?.add(group);
    instanced.removeFromParent();
  }

  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;
    const component = object.userData.sculptComponent as { id?: string; material?: string } | undefined;
    if (component) object.material = fallbackMaterial(component.material, component.id);
  });
}
model.rotation.y = THREE.MathUtils.degToRad(Number(new URLSearchParams(location.search).get("angle") ?? 24));
scene.add(model);

if (webglRenderer) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ color: 0x0b141b, roughness: 0.92, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.53;
  floor.receiveShadow = true;
  scene.add(floor);
}

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.01, 50);
frameTraversalMovingPlatformCamera(camera, model, { margin: 1.38, azimuthDeg: 24, elevationDeg: 20 });

function render(): void {
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  frameTraversalMovingPlatformCamera(camera, model, { margin: 1.38, azimuthDeg: 24, elevationDeg: 20 });
  renderer.setSize(innerWidth, innerHeight);
});
