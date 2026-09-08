import * as THREE from "three";
import {
  configureTraversalMovingPlatformRenderer,
  createTraversalMovingPlatformEnvironment,
  createTraversalMovingPlatformLookDevLights,
  createTraversalMovingPlatformModel,
  frameTraversalMovingPlatformCamera
} from "./art/procedural/models/createTraversalPlatformModel";

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
configureTraversalMovingPlatformRenderer(renderer);
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071016);
scene.environment = createTraversalMovingPlatformEnvironment(renderer);
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
