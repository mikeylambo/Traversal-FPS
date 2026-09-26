import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { TraversalVisualSettings } from "../game/TraversalSettings";
import { WarpLensPass } from "./WarpLensPass";
import { FinishPass } from "./FinishPass";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";

const surfaceVertex = /* glsl */`
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vViewDepth;
  varying vec3 vLocal;
  varying vec3 vLocalNormal;

  void main() {
    vLocal = position;
    vLocalNormal = normal;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 view = viewMatrix * world;
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

// Walkable (upward-facing) surfaces fill most of the first-person frame and are
// always seen at grazing angles, so the view-rim term washed them to flat cyan.
// Floors keep a quieter rim and albedo and let the tech grid carry them; walls,
// silhouettes and edges are unchanged.
const TOP_FACE_LIGHT = "0.75";
const TOP_GRID_BOOST = "1.45";
const TOP_RIM = "0.22";

const surfaceFragment = /* glsl */`
  #define TOP_FACE_LIGHT ${TOP_FACE_LIGHT}
  #define TOP_GRID_BOOST ${TOP_GRID_BOOST}
  #define TOP_RIM ${TOP_RIM}
  uniform vec3 uBase;
  uniform vec3 uAccent;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uToonStrength;
  uniform float uRimStrength;
  uniform float uGridStrength;
  uniform float uEnergyStrength;
  uniform float uTime;
  uniform float uRoomFocus;
  uniform vec3 uHalf;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vViewDepth;
  varying vec3 vLocal;
  varying vec3 vLocalNormal;

  float hash2(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

  float gridLine(vec2 p, float scale) {
    vec2 coord = p * scale;
    vec2 derivative = max(fwidth(coord), vec2(0.0001));
    vec2 line = abs(fract(coord - 0.5) - 0.5) / derivative;
    return 1.0 - min(min(line.x, line.y), 1.0);
  }

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 lightDir = normalize(vec3(0.42, 0.82, 0.28));
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);

    float ndl = max(dot(n, lightDir), 0.0);
    float bands = floor(ndl * 3.0 + 0.001) / 2.0;
    float lit = mix(ndl, bands, uToonStrength);

    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.7) * uRimStrength;
    float gxz = gridLine(vWorldPosition.xz, 0.34);
    float gxy = gridLine(vWorldPosition.xy, 0.34);
    float gyz = gridLine(vWorldPosition.yz, 0.34);
    vec3 an = abs(n);
    float grid = gxz * an.y + gxy * an.z + gyz * an.x;
    grid *= uGridStrength * (0.55 + uRoomFocus * 0.45);
    float up = smoothstep(0.55, 0.95, n.y);
    grid *= mix(1.0, TOP_GRID_BOOST, up);

    float scan = 0.5 + 0.5 * sin(vWorldPosition.y * 5.5 + uTime * 0.7);
    float micro = smoothstep(0.94, 1.0, scan) * 0.06 * uRoomFocus;

    vec3 base = uBase * (0.28 + lit * 0.82) * mix(1.0, TOP_FACE_LIGHT, up);
    rim *= mix(1.0, TOP_RIM, up);

    // Surface language (object space, so it rides moving platforms): machined
    // edge chamfers, a cavity shadow inside each edge, panel seams with slight
    // per-panel tone variation, and an inset light lip under the top edge.
    float chamfer = 0.0;
    float seam = 0.0;
    float lip = 0.0;
    float panelTone = 0.5;
    if (uHalf.x > 0.0) {
      vec3 ln = abs(vLocalNormal);
      vec3 d = uHalf - abs(vLocal);
      vec2 face;
      vec2 faceHalf;
      float edgeDist;
      if (ln.y > 0.5) { edgeDist = min(d.x, d.z); face = vLocal.xz; faceHalf = uHalf.xz; }
      else if (ln.x > 0.5) { edgeDist = min(d.y, d.z); face = vLocal.zy; faceHalf = uHalf.zy; }
      else { edgeDist = min(d.x, d.y); face = vLocal.xy; faceHalf = uHalf.xy; }

      float bevelWidth = clamp(min(faceHalf.x, faceHalf.y) * 0.25, 0.012, 0.055);
      chamfer = 1.0 - smoothstep(bevelWidth * 0.55, bevelWidth, edgeDist);
      float cavity = smoothstep(bevelWidth, bevelWidth * 5.0, edgeDist);
      base *= mix(0.62, 1.0, cavity);

      // Panels are laid out from the face edge so seams frame the object.
      vec2 panelSize = max(vec2(1.0), floor(faceHalf * 2.0 / 1.7 + 0.5));
      vec2 cell = (face + faceHalf) / (faceHalf * 2.0) * panelSize;
      vec2 fromSeam = abs(fract(cell) - 0.5) * (faceHalf * 2.0 / panelSize);
      vec2 seamDist = (faceHalf * 2.0 / panelSize) * 0.5 - fromSeam;
      vec2 seamPx = seamDist / max(fwidth(face), vec2(1e-4));
      vec2 seamOn = step(vec2(1.5), panelSize);
      seam = max((1.0 - smoothstep(0.6, 1.8, seamPx.x)) * seamOn.x, (1.0 - smoothstep(0.6, 1.8, seamPx.y)) * seamOn.y);
      seam *= smoothstep(bevelWidth * 1.5, bevelWidth * 3.0, edgeDist);
      base *= mix(1.0, 0.35, seam);
      panelTone = hash2(floor(cell) + uBase.rg * 91.0);
      base *= 0.8 + panelTone * 0.4;

      // Inset light lip just under the top edge on side faces.
      if (ln.y < 0.5 && uHalf.y > 0.1) {
        float fromTop = uHalf.y - vLocal.y;
        float lipCenter = min(0.11, uHalf.y * 0.45);
        lip = 1.0 - smoothstep(0.008, 0.02, abs(fromTop - lipCenter));
        lip *= smoothstep(0.02, 0.08, min(d.x, d.z));
      }
    }

    // Lacquered tops: fresnel sheen toward the horizon plus a tight key-light
    // highlight, varied per panel so the floor reads as a material, not a fill.
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 5.0);
    vec3 halfDir = normalize(lightDir + viewDir);
    float gloss = mix(60.0, 180.0, panelTone);
    float spec = pow(max(dot(n, halfDir), 0.0), gloss) * (1.0 - seam);
    vec3 sheen = (uAccent * 0.22 + vec3(0.08, 0.12, 0.16)) * fres * up * (1.0 - seam) + vec3(0.9, 0.97, 1.0) * spec * 0.5;

    vec3 energy = uAccent * (rim * 0.55 + grid * 0.72 + micro + chamfer * (0.35 + up * 0.4) + lip * 1.1) * uEnergyStrength;
    vec3 color = base + energy + uBase * chamfer * 0.8 + sheen;
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vViewDepth * vViewDepth);
    color = mix(color, uFogColor, clamp(fogFactor, 0.0, 1.0));
    gl_FragColor = vec4(color, 1.0);
  }
`;

const nodeVertex = /* glsl */`
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vViewDepth;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 view = viewMatrix * world;
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

const nodeFragment = /* glsl */`
  uniform vec3 uColor;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uRimStrength;
  uniform float uEnergyStrength;
  uniform float uTime;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vViewDepth;

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float facing = max(dot(n, viewDir), 0.0);
    float fresnel = pow(1.0 - facing, 2.1);
    float scan = 0.72 + 0.28 * sin(vWorldPosition.y * 13.0 - uTime * 5.0);
    float lattice = 0.88 + 0.12 * sin((vWorldPosition.x + vWorldPosition.z) * 18.0 + uTime * 2.0);
    vec3 color = uColor * (0.48 + facing * 0.44 + fresnel * uRimStrength * 1.35);
    color += uColor * scan * lattice * 0.36 * uEnergyStrength;
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vViewDepth * vViewDepth);
    color = mix(color, uFogColor, clamp(fogFactor, 0.0, 1.0) * 0.82);
    gl_FragColor = vec4(color, 1.0);
  }
`;

type StylizedMaterial = THREE.ShaderMaterial & {
  uniforms: {
    uToonStrength?: { value: number };
    uRimStrength: { value: number };
    uGridStrength?: { value: number };
    uEnergyStrength: { value: number };
    uFogDensity: { value: number };
    uFogColor: { value: THREE.Color };
    uTime: { value: number };
    uRoomFocus?: { value: number };
  };
};

export class VectorRendering {
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  readonly warpLens = new WarpLensPass();
  private readonly finish = new FinishPass();
  private readonly ao: GTAOPass;
  private readonly materials: StylizedMaterial[] = [];
  private time = 0;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.ao = new GTAOPass(scene, camera, 1, 1);
    this.ao.updateGtaoMaterial({ radius: 1.4, distanceExponent: 1.6, thickness: 2, scale: 1 });
    this.composer.addPass(this.ao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.62, 0.72);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.warpLens);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.finish);
  }

  /** `size` (box dimensions) enables the edge/panel surface language; omit for plain surfaces. */
  createSurfaceMaterial(base: number, accent: number, roomFocus = 0, size?: readonly [number, number, number]): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader: surfaceFragment,
      uniforms: {
        uBase: { value: new THREE.Color(base) },
        uAccent: { value: new THREE.Color(accent) },
        uFogColor: { value: new THREE.Color(0x071522) },
        uFogDensity: { value: 0.0105 },
        uToonStrength: { value: 0.72 },
        uRimStrength: { value: 1.15 },
        uGridStrength: { value: 0.42 },
        uEnergyStrength: { value: 1.15 },
        uTime: { value: 0 },
        uRoomFocus: { value: roomFocus },
        uHalf: { value: size ? new THREE.Vector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5) : new THREE.Vector3() }
      }
    }) as StylizedMaterial;
    this.materials.push(material);
    return material;
  }

  createNodeMaterial(color: number): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
      vertexShader: nodeVertex,
      fragmentShader: nodeFragment,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uFogColor: { value: new THREE.Color(0x071522) },
        uFogDensity: { value: 0.0105 },
        uRimStrength: { value: 1.15 },
        uEnergyStrength: { value: 1.15 },
        uTime: { value: 0 }
      }
    }) as StylizedMaterial;
    this.materials.push(material);
    return material;
  }

  update(dt: number, visual: TraversalVisualSettings): void {
    this.time += dt;
    this.renderer.toneMappingExposure = visual.exposure;
    this.bloom.strength = visual.bloomStrength;
    this.bloom.radius = 0.56;
    this.bloom.threshold = 0.71;
    this.ao.enabled = visual.ambientOcclusion > 0.01;
    this.ao.blendIntensity = visual.ambientOcclusion;
    this.finish.apply(visual, this.time);

    const fog = this.scene.fog;
    if (fog instanceof THREE.FogExp2) fog.density = visual.fogDensity;

    for (const material of this.materials) {
      material.uniforms.uTime.value = this.time;
      material.uniforms.uFogDensity.value = visual.fogDensity;
      material.uniforms.uRimStrength.value = visual.rimStrength;
      material.uniforms.uEnergyStrength.value = visual.energyStrength;
      if (material.uniforms.uToonStrength) material.uniforms.uToonStrength.value = visual.toonStrength;
      if (material.uniforms.uGridStrength) material.uniforms.uGridStrength.value = visual.gridStrength;
    }
  }

  render(): void {
    this.composer.render();
  }

  resize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.warpLens.setAspect(width / Math.max(1, height));
    this.finish.setAspect(width / Math.max(1, height));
  }

  clearDisposableMaterials(): void {
    for (let index = this.materials.length - 1; index >= 0; index -= 1) {
      if (this.materials[index]!.userData.disposed === true) this.materials.splice(index, 1);
    }
  }

  markDisposed(material: THREE.Material): void {
    if (material instanceof THREE.ShaderMaterial) material.userData.disposed = true;
  }
}
