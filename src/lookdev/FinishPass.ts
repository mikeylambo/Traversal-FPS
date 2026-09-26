import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/*
 * Final display-space finish: colour grade (contrast, saturation, warmth),
 * vignette and film grain. Runs after tone mapping so every slider reads the
 * way it looks on screen. All values come from the Visual Lab settings.
 */
const FinishShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uContrast: { value: 1 },
    uSaturation: { value: 1 },
    uWarmth: { value: 0 },
    uVignette: { value: 0 },
    uGrain: { value: 0 },
    uChromatic: { value: 0 },
    uAspect: { value: 16 / 9 },
    uTime: { value: 0 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uWarmth;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uChromatic;
    uniform float uAspect;
    uniform float uTime;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 col = src.rgb;
      // Lens fringe: red/blue split growing toward the frame edge.
      vec2 off = (vUv - 0.5) * dot(vUv - 0.5, vUv - 0.5) * uChromatic * 0.035;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.b = texture2D(tDiffuse, vUv - off).b;
      col += vec3(0.05, 0.012, -0.05) * uWarmth;
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, uSaturation);
      col = (col - 0.42) * uContrast + 0.42;
      vec2 c = (vUv - 0.5) * vec2(uAspect, 1.0);
      col *= 1.0 - uVignette * 0.7 * smoothstep(0.35, 1.05, length(c));
      float n = hash(floor(vUv * vec2(1920.0, 1080.0)) + fract(uTime) * 91.0) - 0.5;
      col += n * uGrain * 0.09 * (0.35 + 0.65 * (1.0 - luma));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), src.a);
    }
  `
};

export interface FinishSettings {
  contrast: number;
  saturation: number;
  warmth: number;
  vignette: number;
  grain: number;
  chromatic: number;
}

export class FinishPass extends ShaderPass {
  constructor() {
    super(FinishShader);
  }

  apply(settings: FinishSettings, time: number): void {
    const u = this.uniforms as typeof FinishShader.uniforms;
    u.uContrast.value = settings.contrast;
    u.uSaturation.value = settings.saturation;
    u.uWarmth.value = settings.warmth;
    u.uVignette.value = settings.vignette;
    u.uGrain.value = settings.grain;
    u.uChromatic.value = settings.chromatic;
    u.uTime.value = time;
  }

  setAspect(aspect: number): void {
    (this.uniforms as typeof FinishShader.uniforms).uAspect.value = aspect;
  }
}
