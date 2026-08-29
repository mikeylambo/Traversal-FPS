import * as THREE from "three";

const starVertex = /* glsl */`
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aIntensity;
  attribute float aSize;
  attribute float aSparkle;
  attribute float aHue;

  uniform float uTime;
  uniform float uTwinkle;

  varying float vBrightness;
  varying float vSparkle;
  varying float vHue;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    float slowWave = sin(uTime * aSpeed + aPhase);
    float fastWave = sin(uTime * (aSpeed * 2.43) + aPhase * 1.71);
    float organicTwinkle = 0.90 + slowWave * 0.07 + fastWave * 0.035;

    float flareWave = max(0.0, sin(uTime * (aSpeed * 0.47) + aPhase * 2.31));
    float rareFlare = pow(flareWave, 18.0) * aSparkle;

    vBrightness = aIntensity * mix(1.0, organicTwinkle + rareFlare * 1.65, uTwinkle);
    vSparkle = aSparkle * (0.2 + rareFlare);
    vHue = aHue;

    float perspective = clamp(210.0 / max(34.0, -mvPosition.z), 0.62, 2.25);
    gl_PointSize = aSize * perspective * (1.0 + rareFlare * 0.42);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starFragment = /* glsl */`
  varying float vBrightness;
  varying float vSparkle;
  varying float vHue;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float core = 1.0 - smoothstep(0.025, 0.46, dist);
    float halo = 1.0 - smoothstep(0.13, 0.5, dist);

    float horizontal = exp(-abs(uv.y) * 42.0) * exp(-abs(uv.x) * 5.2);
    float vertical = exp(-abs(uv.x) * 42.0) * exp(-abs(uv.y) * 5.2);
    float flare = (horizontal + vertical) * vSparkle * 0.7;

    vec3 cool = vec3(0.48, 0.88, 1.0);
    vec3 white = vec3(0.94, 0.99, 1.0);
    vec3 pale = vec3(0.72, 0.86, 1.0);
    vec3 color = mix(cool, white, smoothstep(0.0, 0.62, vHue));
    color = mix(color, pale, smoothstep(0.78, 1.0, vHue) * 0.38);

    float alpha = (core * 0.92 + halo * 0.34 + flare) * vBrightness;
    gl_FragColor = vec4(color * (0.72 + vBrightness * 0.62 + flare), alpha);
  }
`;

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TwinklingStarfield {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly material: THREE.ShaderMaterial;
  private time = 0;

  constructor(scene: THREE.Scene, count = 760) {
    const random = mulberry32(0x7A4A9E1);
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    const intensities = new Float32Array(count);
    const sizes = new Float32Array(count);
    const sparkles = new Float32Array(count);
    const hues = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const layerRoll = random();
      const depthLayer = layerRoll < 0.62 ? 0 : layerRoll < 0.9 ? 1 : 2;
      const depth = depthLayer === 0
        ? 125 + random() * 125
        : depthLayer === 1
          ? 78 + random() * 82
          : 48 + random() * 58;

      // Broad field biased above the traversal plane, with enough lateral width
      // that room-to-room camera travel produces quiet parallax instead of a skybox lock.
      positions[i * 3] = (random() * 2 - 1) * (depth * 1.18);
      positions[i * 3 + 1] = -4 + random() * (depth * 0.72);
      positions[i * 3 + 2] = 18 - depth - random() * 85;

      phases[i] = random() * Math.PI * 2;
      speeds[i] = 0.48 + random() * 1.72;
      intensities[i] = depthLayer === 0
        ? 0.34 + random() * 0.34
        : depthLayer === 1
          ? 0.46 + random() * 0.42
          : 0.58 + random() * 0.46;
      sizes[i] = depthLayer === 0
        ? 1.45 + random() * 1.7
        : depthLayer === 1
          ? 1.9 + random() * 2.4
          : 2.3 + random() * 3.0;

      // Roughly one star in twelve gets a restrained four-point glint.
      sparkles[i] = random() > 0.915 ? 1 : 0;
      hues[i] = random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute("aIntensity", new THREE.BufferAttribute(intensities, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aSparkle", new THREE.BufferAttribute(sparkles, 1));
    geometry.setAttribute("aHue", new THREE.BufferAttribute(hues, 1));
    geometry.computeBoundingSphere();

    this.material = new THREE.ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: {
        uTime: { value: 0 },
        uTwinkle: { value: 0.82 }
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = -20;
    scene.add(this.points);
  }

  update(dt: number, twinkleStrength: number): void {
    this.time += dt;
    this.material.uniforms.uTime.value = this.time;
    this.material.uniforms.uTwinkle.value = THREE.MathUtils.clamp(twinkleStrength, 0, 1.5);
  }
}
