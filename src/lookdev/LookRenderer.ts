import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { LookSettings } from "./lookSchema";
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
// Floors keep a quieter rim and albedo and let the tech grid carry them.
const TOP_FACE_LIGHT = "0.75";
const TOP_GRID_BOOST = "1.45";
const TOP_RIM = "0.22";

/*
 * Surface language. Object-space (rides moving platforms) and driven by the
 * Look Engine: machined chamfers, cavity shadow, panel seams with per-panel
 * tone, an inset light lip, lacquered sheen — and the ceramic frame: a dark
 * body wearing light ceramic corner brackets and edge trim with a glowing
 * seam where the two materials meet.
 */
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

  uniform vec3 uLightDir;
  uniform float uHueShift;
  uniform float uGridFreq;
  uniform float uPanelSize;
  uniform float uSeamDepth;
  uniform float uToneVar;
  uniform float uGloss;
  uniform float uChamfer;
  uniform float uEdgeLight;
  uniform float uLip;
  uniform float uCeramic;
  uniform float uFrameWidth;
  uniform float uCorner;
  uniform float uFrameRun;
  uniform float uFrameSeam;
  uniform float uBodyDark;
  uniform float uHeightFog;
  uniform float uHeightFogLevel;

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

  vec3 hueShift(vec3 c, float degrees) {
    float a = radians(degrees);
    const vec3 k = vec3(0.57735);
    float cosA = cos(a);
    return c * cosA + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - cosA);
  }

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 lightDir = normalize(uLightDir);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 accent = max(hueShift(uAccent, uHueShift), vec3(0.0));

    float ndl = max(dot(n, lightDir), 0.0);
    float bands = floor(ndl * 3.0 + 0.001) / 2.0;
    float lit = mix(ndl, bands, uToonStrength);

    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.7) * uRimStrength;
    float gxz = gridLine(vWorldPosition.xz, uGridFreq);
    float gxy = gridLine(vWorldPosition.xy, uGridFreq);
    float gyz = gridLine(vWorldPosition.yz, uGridFreq);
    vec3 an = abs(n);
    float grid = gxz * an.y + gxy * an.z + gyz * an.x;
    grid *= uGridStrength * (0.55 + uRoomFocus * 0.45);
    float up = smoothstep(0.55, 0.95, n.y);
    grid *= mix(1.0, TOP_GRID_BOOST, up);

    float scan = 0.5 + 0.5 * sin(vWorldPosition.y * 5.5 + uTime * 0.7);
    float micro = smoothstep(0.94, 1.0, scan) * 0.06 * uRoomFocus;

    vec3 base = uBase * (0.28 + lit * 0.82) * mix(1.0, TOP_FACE_LIGHT, up);
    rim *= mix(1.0, TOP_RIM, up);

    float chamfer = 0.0;
    float seam = 0.0;
    float lip = 0.0;
    float panelTone = 0.5;
    float ceramic = 0.0;
    float frameGlow = 0.0;
    if (uHalf.x > 0.0) {
      vec3 ln = abs(vLocalNormal);
      vec3 d = uHalf - abs(vLocal);
      vec2 face;
      vec2 faceHalf;
      if (ln.y > 0.5) { face = vLocal.xz; faceHalf = uHalf.xz; }
      else if (ln.x > 0.5) { face = vLocal.zy; faceHalf = uHalf.zy; }
      else { face = vLocal.xy; faceHalf = uHalf.xy; }
      vec2 e = faceHalf - abs(face);          // distance to this face's edges, per axis
      float edgeDist = min(e.x, e.y);
      float aa = max(fwidth(edgeDist), 1e-4) * 1.2;

      float bevelWidth = clamp(min(faceHalf.x, faceHalf.y) * 0.25, 0.012, 0.055) * uChamfer;
      chamfer = uChamfer > 0.0 ? 1.0 - smoothstep(bevelWidth * 0.55, bevelWidth + aa, edgeDist) : 0.0;
      float cavity = smoothstep(bevelWidth, bevelWidth * 5.0 + 1e-3, edgeDist);
      base *= mix(0.62, 1.0, cavity);

      // Ceramic frame: L-shaped corner brackets plus an optional edge run.
      float fw = min(uFrameWidth, min(faceHalf.x, faceHalf.y) * 0.45);
      float band = 1.0 - smoothstep(fw - aa, fw, edgeDist);
      float nearCornerX = 1.0 - smoothstep(uCorner - aa, uCorner, e.x);
      float nearCornerY = 1.0 - smoothstep(uCorner - aa, uCorner, e.y);
      float onEdgeX = 1.0 - smoothstep(fw - aa, fw, e.x);
      float onEdgeY = 1.0 - smoothstep(fw - aa, fw, e.y);
      float bracket = max(onEdgeX * nearCornerY, onEdgeY * nearCornerX);
      float frameMask = max(bracket, band * uFrameRun);
      ceramic = clamp(frameMask, 0.0, 1.0) * uCeramic;
      float boundary = 1.0 - smoothstep(0.0, aa * 2.0 + 0.004, abs(edgeDist - fw));
      float boundaryOn = max(max(nearCornerX, nearCornerY), step(0.01, uFrameRun));
      frameGlow = boundary * boundaryOn * uCeramic * step(fw + aa, min(faceHalf.x, faceHalf.y) * 2.0);

      // Panels laid out from the face edge so seams frame the object.
      vec2 panelCount = max(vec2(1.0), floor(faceHalf * 2.0 / uPanelSize + 0.5));
      vec2 cell = (face + faceHalf) / (faceHalf * 2.0) * panelCount;
      vec2 fromSeam = abs(fract(cell) - 0.5) * (faceHalf * 2.0 / panelCount);
      vec2 seamDist = (faceHalf * 2.0 / panelCount) * 0.5 - fromSeam;
      vec2 seamPx = seamDist / max(fwidth(face), vec2(1e-4));
      vec2 seamOn = step(vec2(1.5), panelCount);
      seam = max((1.0 - smoothstep(0.6, 1.8, seamPx.x)) * seamOn.x, (1.0 - smoothstep(0.6, 1.8, seamPx.y)) * seamOn.y);
      seam *= smoothstep(bevelWidth * 1.5, bevelWidth * 3.0 + 1e-3, edgeDist) * (1.0 - ceramic);
      base *= mix(1.0, 1.0 - uSeamDepth, seam);
      panelTone = hash2(floor(cell) + uBase.rg * 91.0);
      base *= 1.0 + (panelTone - 0.5) * uToneVar;

      // Inset light lip just under the top edge on side faces.
      if (ln.y < 0.5 && uHalf.y > 0.1) {
        float fromTop = uHalf.y - vLocal.y;
        float lipCenter = min(0.11, uHalf.y * 0.45);
        lip = 1.0 - smoothstep(0.008, 0.02, abs(fromTop - lipCenter));
        lip *= smoothstep(0.02, 0.08, min(d.x, d.z)) * (1.0 - ceramic);
      }
    }

    // Dark body under the ceramic trim.
    base *= 1.0 - uBodyDark * 0.7 * uCeramic;

    // Lacquered sheen and key-light highlight, varied per panel.
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 5.0);
    vec3 halfDir = normalize(lightDir + viewDir);
    float glossPow = mix(60.0, 180.0, panelTone);
    float spec = pow(max(dot(n, halfDir), 0.0), glossPow) * (1.0 - seam);
    vec3 sheen = ((accent * 0.22 + vec3(0.08, 0.12, 0.16)) * fres * up * (1.0 - seam) + vec3(0.9, 0.97, 1.0) * spec * 0.5) * uGloss;

    // Ceramic: matte-satin light material with its own soft highlight.
    vec3 ceramicCol = vec3(0.86, 0.89, 0.92) * (0.5 + lit * 1.1) + vec3(1.0) * pow(max(dot(n, halfDir), 0.0), 40.0) * 0.25 * uGloss;

    float gridMask = 1.0 - ceramic;
    vec3 energy = accent * (rim * 0.55 + grid * 0.72 * gridMask + micro + chamfer * (0.16 + up * 0.18) * uEdgeLight * (1.0 - ceramic) + lip * 1.1 * uLip + frameGlow * 0.9 * uFrameSeam) * uEnergyStrength;
    vec3 surface = mix(base + uBase * chamfer * 0.8 * uEdgeLight + sheen, ceramicCol, ceramic);
    vec3 color = surface + energy;

    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vViewDepth * vViewDepth);
    color = mix(color, uFogColor, clamp(fogFactor, 0.0, 1.0));
    // Height fog: haze pooling below the playfield, thicker with distance.
    float below = 1.0 - smoothstep(uHeightFogLevel - 14.0, uHeightFogLevel, vWorldPosition.y);
    float haze = uHeightFog * below * (1.0 - exp(-vViewDepth * 0.06));
    color = mix(color, uFogColor * 1.8 + accent * 0.035, clamp(haze, 0.0, 0.92));
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

/**
 * Look Engine renderer: stylised surface/node materials plus the full post
 * stack (AO → bloom → warp lens → tone map → finish), all driven by a
 * LookSettings object each frame.
 */
export class LookRenderer {
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  readonly warpLens = new WarpLensPass();
  private readonly finish = new FinishPass();
  private readonly ao: GTAOPass;
  private readonly materials: StylizedMaterial[] = [];
  private time = 0;
  /** Look-driven uniforms shared by reference across every surface material. */
  private readonly lookUniforms = {
    uLightDir: { value: new THREE.Vector3(0.42, 0.82, 0.28) },
    uHueShift: { value: 0 },
    uGridFreq: { value: 0.34 },
    uPanelSize: { value: 1.7 },
    uSeamDepth: { value: 0.65 },
    uToneVar: { value: 0.4 },
    uGloss: { value: 1 },
    uChamfer: { value: 1 },
    uEdgeLight: { value: 1 },
    uLip: { value: 1 },
    uCeramic: { value: 0 },
    uFrameWidth: { value: 0.14 },
    uCorner: { value: 0.55 },
    uFrameRun: { value: 0.35 },
    uFrameSeam: { value: 1 },
    uBodyDark: { value: 0.35 },
    uHeightFog: { value: 0 },
    uHeightFogLevel: { value: -3 }
  };

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
        uHalf: { value: size ? new THREE.Vector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5) : new THREE.Vector3() },
        ...this.lookUniforms
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

  update(dt: number, visual: LookSettings): void {
    this.time += dt;
    this.renderer.toneMappingExposure = visual.exposure;
    this.bloom.strength = visual.bloomStrength;
    this.bloom.radius = 0.56;
    this.bloom.threshold = visual.bloomThreshold;
    this.ao.enabled = visual.ambientOcclusion > 0.01;
    this.ao.blendIntensity = visual.ambientOcclusion;
    this.finish.apply(visual, this.time);

    const u = this.lookUniforms;
    const az = THREE.MathUtils.degToRad(visual.keyAzimuth);
    const el = THREE.MathUtils.degToRad(visual.keyElevation);
    u.uLightDir.value.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    u.uHueShift.value = visual.accentHue;
    u.uGridFreq.value = 1 / visual.gridScale;
    u.uPanelSize.value = visual.panelSize;
    u.uSeamDepth.value = visual.seamDepth;
    u.uToneVar.value = visual.toneVariation;
    u.uGloss.value = visual.gloss;
    u.uChamfer.value = visual.chamferWidth;
    u.uEdgeLight.value = visual.edgeLight;
    u.uLip.value = visual.lipStrength;
    u.uCeramic.value = visual.ceramicFrame;
    u.uFrameWidth.value = visual.frameWidth;
    u.uCorner.value = visual.cornerSize;
    u.uFrameRun.value = visual.frameRun;
    u.uFrameSeam.value = visual.frameSeamGlow;
    u.uBodyDark.value = visual.bodyDarkness;
    u.uHeightFog.value = visual.heightFog;
    u.uHeightFogLevel.value = visual.heightFogLevel;

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
