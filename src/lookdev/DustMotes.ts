import * as THREE from "three";

/*
 * Drifting dust motes in a box that travels with the camera (wrapped in the
 * shader, so there is no per-frame CPU work). Catches the eye as parallax depth
 * without adding visual noise; amount is a Look Engine slider.
 */
const COUNT = 700;
const BOX = 26;

export class DustMotes {
  private readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor(scene: THREE.Scene, private readonly camera: THREE.Camera) {
    const positions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i += 1) {
      positions[i * 3] = Math.random() * BOX;
      positions[i * 3 + 1] = Math.random() * BOX;
      positions[i * 3 + 2] = Math.random() * BOX;
      seeds[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uCam: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(0xa8eeff) } },
      vertexShader: /* glsl */`
        attribute float aSeed;
        uniform float uTime;
        uniform vec3 uCam;
        varying float vAlpha;
        const float BOX = ${BOX.toFixed(1)};
        void main() {
          vec3 drift = vec3(sin(uTime * 0.07 + aSeed * 40.0), -0.25 - aSeed * 0.2, cos(uTime * 0.05 + aSeed * 23.0)) * uTime * 0.08;
          vec3 p = mod(position + drift - uCam, BOX) - BOX * 0.5 + uCam;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = -mv.z;
          vAlpha = smoothstep(0.4, 2.5, dist) * (1.0 - smoothstep(BOX * 0.3, BOX * 0.5, dist)) * (0.35 + aSeed * 0.65)
                 * (0.6 + 0.4 * sin(uTime * (0.6 + aSeed) + aSeed * 30.0));
          gl_PointSize = clamp(38.0 / dist, 1.0, 5.0) * (0.6 + aSeed * 0.8);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uAmount;
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vAlpha * uAmount;
          gl_FragColor = vec4(uColor * a, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.name = "dust-motes";
    scene.add(this.points);
  }

  update(dt: number, amount: number): void {
    const u = this.points.material.uniforms;
    u.uTime.value += dt;
    u.uAmount.value = amount * 0.6;
    this.camera.getWorldPosition(u.uCam.value);
    this.points.visible = amount > 0.01;
  }
}
