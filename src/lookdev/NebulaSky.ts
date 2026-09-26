import * as THREE from "three";

/*
 * Procedural backdrop: a faint two-tone nebula, a low horizon glow and a band
 * of distant haze, drawn first behind everything (no depth, no fog). Gives the
 * void depth without competing with the neon geometry or the starfield.
 */
const vertexShader = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const fragmentShader = /* glsl */`
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uHorizon;
  uniform float uScale;
  uniform float uDrift;
  uniform float uHorizonGlow;
  varying vec3 vDir;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(17.1, 113.7, 51.3))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    vec3 q = d * uScale + vec3(0.0, 0.0, uTime * 0.004 * uDrift);
    float warp = fbm(q + fbm(q * 1.7) * 1.3);
    float cloud = smoothstep(0.42, 0.85, warp);
    float wisps = smoothstep(0.55, 0.9, fbm(q * 3.4 + 7.0));
    vec3 col = mix(uColorA, uColorB, smoothstep(0.3, 0.8, fbm(q * 0.8 + 3.0))) * (cloud * 0.8 + wisps * 0.35);
    // Horizon glow and the deep below.
    float h = d.y;
    col += uHorizon * exp(-abs(h) * 9.0) * 0.55 * uHorizonGlow;
    col *= smoothstep(-0.55, 0.05, h) * 0.85 + 0.15;
    gl_FragColor = vec4(col * uIntensity * 2.4, 1.0);
  }
`;

export class NebulaSky {
  private readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;

  constructor(scene: THREE.Scene, private readonly camera: THREE.Camera) {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1 },
        uColorA: { value: new THREE.Color(0x0a3a58) },
        uColorB: { value: new THREE.Color(0x2a1450) },
        uHorizon: { value: new THREE.Color(0x0b3550) },
        uScale: { value: 2.2 },
        uDrift: { value: 1 },
        uHorizonGlow: { value: 1 }
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), material);
    this.mesh.name = "nebula-sky";
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(dt: number, look: { nebula: number; nebulaHueA: number; nebulaHueB: number; nebulaScale: number; nebulaDrift: number; horizonGlow: number }): void {
    this.mesh.position.copy(this.camera.getWorldPosition(new THREE.Vector3()));
    const u = this.mesh.material.uniforms;
    u.uTime.value += dt;
    u.uIntensity.value = look.nebula;
    u.uScale.value = look.nebulaScale;
    u.uDrift.value = look.nebulaDrift;
    u.uHorizonGlow.value = look.horizonGlow;
    (u.uColorA.value as THREE.Color).setHSL(look.nebulaHueA / 360, 0.78, 0.19, THREE.SRGBColorSpace);
    (u.uColorB.value as THREE.Color).setHSL(look.nebulaHueB / 360, 0.6, 0.19, THREE.SRGBColorSpace);
    (u.uHorizon.value as THREE.Color).setHSL(look.nebulaHueA / 360, 0.75, 0.18, THREE.SRGBColorSpace);
  }

}
