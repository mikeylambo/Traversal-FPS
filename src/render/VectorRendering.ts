import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { TraversalVisualSettings } from "../game/TraversalSettings";

const surfaceVertex = /* glsl */`
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

const surfaceFragment = /* glsl */`
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

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vViewDepth;

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

    float scan = 0.5 + 0.5 * sin(vWorldPosition.y * 5.5 + uTime * 0.7);
    float micro = smoothstep(0.94, 1.0, scan) * 0.06 * uRoomFocus;

    vec3 base = uBase * (0.28 + lit * 0.82);
    vec3 energy = uAccent * (rim * 0.55 + grid * 0.72 + micro) * uEnergyStrength;
    vec3 color = base + energy;
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
  private readonly materials: StylizedMaterial[] = [];
  private time = 0;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.62, 0.72);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  createSurfaceMaterial(base: number, accent: number, roomFocus = 0): THREE.ShaderMaterial {
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
        uRoomFocus: { value: roomFocus }
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
