import * as THREE from "three";
import "../typography.css";
import "../lookdev-mobile.css";
import { DustMotes } from "./DustMotes";
import { LookLab } from "./LookLab";
import { LookRenderer } from "./LookRenderer";
import { NebulaSky } from "./NebulaSky";
import { DEFAULT_LOOK, sanitizeLook, type LookSettings } from "./lookSchema";
import { publishLook } from "./lookRuntime";

/*
 * Look Engine bench (dev only: `npm run dev`, then /lookdev.html).
 * A slowly orbiting set of platforms under the full renderer, with the Lab
 * docked on the right. Tune here without playing; export the look as JSON.
 */
const STORAGE_KEY = "lookdev:bench-look";
let look: LookSettings = (() => {
  try { return sanitizeLook(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")); } catch { return { ...DEFAULT_LOOK }; }
})();
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(look)); } catch { /* ignore */ } };

const canvas = document.getElementById("bench") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020812);
scene.fog = new THREE.FogExp2(0x04111d, 0.012);
scene.add(new THREE.HemisphereLight(0xd7f4ff, 0x182337, 2.35));
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 240);
scene.add(camera);

const rendering = new LookRenderer(renderer, scene, camera);
const nebula = new NebulaSky(scene, camera);
const dust = new DustMotes(scene, camera);

const accent = 0x69e7ff;
const platform = (size: [number, number, number], position: [number, number, number], base = 0x1d3650) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), rendering.createSurfaceMaterial(base, accent, 1, size));
  mesh.position.set(...position);
  scene.add(mesh);
};
platform([4, 0.5, 4], [0, -0.25, 0]);
platform([3, 0.4, 2.2], [3.2, 0.6, -4]);
platform([1.4, 3, 1.4], [-2.4, 1.5, -5]);
platform([6, 0.6, 3], [0.5, -1.6, -9]);
platform([2.2, 0.35, 2.2], [-4.5, 2.2, -1.5]);
platform([0.28, 6, 0.34], [5, 2.5, -7], 0x11283d);
platform([0.28, 6, 0.34], [-5, 2.5, -7], 0x11283d);
platform([10.28, 0.2, 0.34], [0, 5.4, -7], 0x17324a);

const lab = new LookLab(document.getElementById("visual-lab")!, {
  get: () => look,
  set: (key, value) => { look = { ...look, [key]: value }; save(); },
  replace: (next) => { look = { ...next }; save(); }
}, { kicker: "LOOK ENGINE", title: "BENCH", footnote: "Double-click a slider to reset it. Export saves a .look.json you can commit." });
lab.sync();

const resize = () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  rendering.resize(w, h);
};
window.addEventListener("resize", resize);
resize();

let last = performance.now();
let angle = 0.6;
const frame = () => {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  angle += dt * 0.08;
  camera.position.set(Math.sin(angle) * 8.5, 3.2, Math.cos(angle) * 8.5 - 3);
  camera.lookAt(0, 0.4, -3);
  publishLook(look);
  nebula.update(dt, look);
  dust.update(dt, look.dust);
  rendering.update(dt, look);
  rendering.render();
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
