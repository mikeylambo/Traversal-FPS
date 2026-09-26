import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/*
 * Warp Lens — the signature screen-space moment of the Warp Rifle.
 *
 * Three beats, all driven from gameplay state (never the other way round):
 *   charge  — warp held with an anchor: space leans toward the aim point, the
 *             frame edge cools and fringes. Quiet; it can be held for seconds.
 *   transit — the jump itself (often 0.1–0.3 s): chromatic zoom tunnel, radial
 *             light streaks, white-cyan core. Lingers a beat after arrival so
 *             even the shortest warps read.
 *   arrival — a refractive shockwave ring expands from the centre of view.
 *
 * Distortion scales with motionScale(), light with flashScale(); both come from
 * the accessibility settings so Reduce Motion / Reduce Flash cap the excursion
 * without removing the cue.
 */

const WarpLensShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uCharge: { value: 0 },
    uTransit: { value: 0 },
    uArrival: { value: 1 },
    uAspect: { value: 16 / 9 },
    uTime: { value: 0 },
    uMotion: { value: 1 },
    uFlash: { value: 1 }
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
    uniform float uCharge;
    uniform float uTransit;
    uniform float uArrival;
    uniform float uAspect;
    uniform float uTime;
    uniform float uMotion;
    uniform float uFlash;
    varying vec2 vUv;

    float hash(float n) { return fract(sin(n) * 43758.5453123); }

    vec3 chroma(vec2 uv, vec2 shift) {
      return vec3(
        texture2D(tDiffuse, uv + shift).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - shift).b
      );
    }

    void main() {
      vec2 c = vUv - 0.5;
      vec2 ca = vec2(c.x * uAspect, c.y);
      float r = length(ca);
      vec2 dir = r > 1e-4 ? ca / r : vec2(0.0);
      vec2 toUv = vec2(1.0 / uAspect, 1.0);

      // Arrival shockwave: a thin refractive ring racing outward.
      float p = clamp(uArrival, 0.0, 1.0);
      float front = mix(0.02, 1.15, 1.0 - pow(1.0 - p, 3.0));
      float fade = (1.0 - p) * (1.0 - p);
      float ring = exp(-pow((r - front) / (0.022 + p * 0.03), 2.0)) * fade;

      // Charge pinch: the edge of the world leans toward the aim point.
      float pinch = uCharge * 0.02 * smoothstep(0.25, 0.95, r);
      float bend = (-pinch + ring * 0.03) * uMotion;
      vec2 uv = vUv + dir * bend * toUv;

      float fringe = (uCharge * 0.0022 + uTransit * 0.011 + ring * 0.008) * r * uMotion;
      vec2 shift = dir * fringe * toUv;

      vec3 col;
      if (uTransit > 0.002) {
        // Zoom tunnel: accumulate samples pulled toward the centre.
        float blur = uTransit * 0.16 * uMotion;
        vec3 acc = vec3(0.0);
        float wsum = 0.0;
        for (int i = 0; i < 12; i++) {
          float t = float(i) / 11.0;
          float w = 1.0 - t * 0.55;
          vec2 suv = 0.5 + (uv - 0.5) * (1.0 - blur * t);
          acc += chroma(suv, shift * (1.0 + t)) * w;
          wsum += w;
        }
        col = acc / wsum;
      } else {
        col = chroma(uv, shift);
      }

      // Transit light: cool tunnel walls, radial streaks, white-cyan core.
      float edge = smoothstep(0.12, 0.85, r);
      col = mix(col, col * vec3(0.32, 0.62, 1.05), uTransit * edge);
      float angle = atan(ca.y, ca.x);
      float lanes = angle * 96.0;
      float lane = floor(lanes);
      float thin = 1.0 - smoothstep(0.0, 0.16, abs(fract(lanes) - 0.5));
      float seed = hash(lane + floor(uTime * 30.0) * 7.13);
      float streak = step(0.78, seed) * thin;
      float reach = 0.18 + hash(lane * 3.1) * 0.5;
      streak *= smoothstep(reach, reach + 0.35, r);
      col += vec3(0.45, 0.9, 1.0) * streak * uTransit * 0.55 * uFlash;
      col += vec3(0.7, 0.96, 1.0) * exp(-r * r * 30.0) * uTransit * 0.32 * uFlash;

      // Arrival light: the ring's leading edge and a short core flash.
      col += vec3(0.4, 0.9, 1.0) * ring * 0.28 * uFlash;
      col += vec3(0.7, 0.96, 1.0) * exp(-r * r * 14.0) * fade * fade * 0.12 * uFlash;

      // Charge: a cool rim closes in from the frame edge.
      col += vec3(0.04, 0.26, 0.42) * uCharge * smoothstep(0.6, 1.1, r) * 0.3 * uFlash;

      gl_FragColor = vec4(col, 1.0);
    }
  `
};

export interface WarpLensInput {
  charging: boolean;
  transiting: boolean;
  motion: number;
  flash: number;
}

export class WarpLensPass extends ShaderPass {
  private charge = 0;
  private transit = 0;
  private arrival = 1;
  private wasTransiting = false;
  private time = 0;
  private override: { charge: number; transit: number; arrival: number } | null = null;

  constructor() {
    super(WarpLensShader);
  }

  /** QA hook: pin the lens to a fixed state for captures. Pass null to release. */
  setOverride(state: { charge: number; transit: number; arrival: number } | null): void {
    this.override = state;
  }

  tick(dt: number, input: WarpLensInput): void {
    this.time += dt;
    const chargeTarget = input.charging && !input.transiting ? 1 : 0;
    this.charge += (chargeTarget - this.charge) * (1 - Math.exp(-dt / 0.12));

    if (input.transiting) {
      // Hard attack so a 0.1 s warp still peaks.
      this.transit = Math.min(1, this.transit + dt / 0.035);
    } else {
      this.transit *= Math.exp(-dt / 0.085);
      if (this.transit < 0.002) this.transit = 0;
    }
    if (this.wasTransiting && !input.transiting) this.arrival = 0;
    this.wasTransiting = input.transiting;
    this.arrival = Math.min(1, this.arrival + dt / 0.55);

    const state = this.override ?? { charge: this.charge, transit: this.transit, arrival: this.arrival };
    const u = this.uniforms as typeof WarpLensShader.uniforms;
    u.uCharge.value = state.charge;
    u.uTransit.value = state.transit;
    u.uArrival.value = state.arrival;
    u.uTime.value = this.time;
    u.uMotion.value = input.motion;
    u.uFlash.value = input.flash;
    // Skip the full-screen pass entirely when idle.
    this.enabled = state.charge > 0.002 || state.transit > 0.002 || state.arrival < 0.999;
  }

  setAspect(aspect: number): void {
    (this.uniforms as typeof WarpLensShader.uniforms).uAspect.value = aspect;
  }
}
