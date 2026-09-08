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
scene.background = new THREE.Color(0x071016);
if (webglRenderer) scene.environment = createTraversalMovingPlatformEnvironment(webglRenderer);
scene.add(createTraversalMovingPlatformLookDevLights("reference"));

const model = createTraversalMovingPlatformModel();
model.rotation.y = THREE.MathUtils.degToRad(Number(new URLSearchParams(location.search).get("angle") ?? 24));
scene.add(model);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 8),
  new THREE.MeshStandardMaterial({ color: 0x0b141b, roughness: 0.92, metalness: 0.05 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.53;
floor.receiveShadow = true;
scene.add(floor);

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
