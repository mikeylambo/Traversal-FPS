import * as THREE from "three";

/*
 * Shot FX: the Warp Rifle's discharge.
 *   beam   — camera-facing ribbon with a white-hot core, cyan glow and an
 *            energy pulse racing to the target; narrows as it fades.
 *   muzzle — four-point star flash plus a ring punched out along the barrel.
 *   impact — light flash, surface shock ring and a spray of sparks.
 * All pooled; nothing allocates per shot after warm-up.
 * Strength scales with the Look Engine (`shotPower`) and flashScale().
 */

const BEAM_LIFE = 0.2;
const MUZZLE_LIFE = 0.085;
const IMPACT_LIFE = 0.34;
const SPARKS = 18;

const beamVertex = /* glsl */`
  attribute float aT;
  attribute float aSide;
  uniform vec3 uStart;
  uniform vec3 uEnd;
  uniform float uWidth;
  varying float vT;
  varying float vSide;
  void main() {
    vec3 p = mix(uStart, uEnd, aT);
    vec3 dir = normalize(uEnd - uStart);
    vec3 toCam = normalize(cameraPosition - p);
    vec3 side = normalize(cross(dir, toCam));
    // Taper: thicker at the muzzle, a point at the target.
    float taper = mix(1.0, 0.45, aT);
    p += side * aSide * uWidth * taper;
    vT = aT;
    vSide = aSide;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const beamFragment = /* glsl */`
  uniform vec3 uColor;
  uniform float uLife;
  uniform float uLength;
  uniform float uPower;
  varying float vT;
  varying float vSide;
  void main() {
    float x = abs(vSide);
    float core = exp(-x * x * 90.0);
    float glow = exp(-x * x * 7.0);
    // Energy pulse racing from muzzle to target in the first moments.
    float head = uLife * 3.2;
    float pulse = exp(-pow((vT - head) * uLength * 0.35, 2.0)) * step(uLife, 0.34);
    float fade = pow(1.0 - uLife, 1.15);
    float endFade = smoothstep(0.0, 0.02, vT) * smoothstep(1.0, 0.97, vT);
    vec3 col = vec3(1.0) * core * 1.8 + uColor * glow * 0.9 + uColor * pulse * glow * 2.2;
    float a = (core + glow * 0.6 + pulse * 0.8) * fade * endFade * uPower;
    gl_FragColor = vec4(col * a, a);
  }
`;

const spriteVertex = /* glsl */`
  uniform vec3 uCenter;
  uniform float uSize;
  uniform float uSpin;
  varying vec2 vUv;
  void main() {
    vUv = position.xy;
    vec4 mv = viewMatrix * vec4(uCenter, 1.0);
    float c = cos(uSpin);
    float s = sin(uSpin);
    vec2 q = mat2(c, -s, s, c) * position.xy;
    mv.xy += q * uSize;
    gl_Position = projectionMatrix * mv;
  }
`;

const flashFragment = /* glsl */`
  uniform vec3 uColor;
  uniform float uLife;
  uniform float uPower;
  varying vec2 vUv;
  void main() {
    float r = length(vUv);
    float core = exp(-r * r * 22.0);
    float star = exp(-abs(vUv.x) * 26.0) * exp(-abs(vUv.y) * 2.6) + exp(-abs(vUv.y) * 26.0) * exp(-abs(vUv.x) * 2.6);
    float halo = exp(-r * r * 4.0) * 0.35;
    float fade = 1.0 - uLife;
    vec3 col = vec3(1.0) * core * 2.0 + uColor * (star * 1.2 + halo);
    float a = (core + star * 0.8 + halo) * fade * uPower;
    gl_FragColor = vec4(col * a, a);
  }
`;

const ringFragment = /* glsl */`
  uniform vec3 uColor;
  uniform float uLife;
  uniform float uPower;
  varying vec2 vUv;
  void main() {
    float r = length(vUv);
    float radius = mix(0.15, 0.95, 1.0 - pow(1.0 - uLife, 3.0));
    float band = exp(-pow((r - radius) * 18.0, 2.0));
    float fade = pow(1.0 - uLife, 1.4);
    float a = band * fade * uPower;
    gl_FragColor = vec4((uColor + vec3(0.3)) * a, a);
  }
`;

interface Beam { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; age: number; }
interface Sprite { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; age: number; life: number; size0: number; size1: number; }
interface Sparks { points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>; velocities: Float32Array; age: number; }

function additive(vertexShader: string, fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  });
}

export class ShotFx {
  private readonly beams: Beam[] = [];
  private readonly sprites: Sprite[] = [];
  private readonly sparks: Sparks[] = [];
  private readonly light = new THREE.PointLight(0x9ff4ff, 0, 7, 2);
  private lightAge = 1;
  private power = 1;

  constructor(private readonly scene: THREE.Scene) {
    this.light.name = "shot-impact-light";
    scene.add(this.light);
  }

  /** 0..2 look multiplier × accessibility flash scale. */
  setPower(power: number): void {
    this.power = power;
  }

  muzzle(position: THREE.Vector3, color = 0x9ff4ff): void {
    this.spawnSprite(position, flashFragment, color, MUZZLE_LIFE, 0.22, 0.34, Math.random() * Math.PI);
    this.spawnSprite(position, ringFragment, color, MUZZLE_LIFE * 1.6, 0.05, 0.13, 0);
  }

  beam(start: THREE.Vector3, end: THREE.Vector3, color = 0x8ff3ff): void {
    const beam = this.beams.find((b) => b.age >= 1) ?? this.createBeam();
    const u = beam.mesh.material.uniforms;
    (u.uStart.value as THREE.Vector3).copy(start);
    (u.uEnd.value as THREE.Vector3).copy(end);
    (u.uColor.value as THREE.Color).setHex(color);
    u.uLength.value = start.distanceTo(end);
    u.uPower.value = this.power;
    beam.age = 0;
    beam.mesh.visible = true;
  }

  impact(position: THREE.Vector3, towardShooter: THREE.Vector3, color = 0x9edcff): void {
    this.spawnSprite(position, flashFragment, color, IMPACT_LIFE * 0.5, 0.6, 1.05, Math.random() * Math.PI);
    this.spawnSprite(position, ringFragment, color, IMPACT_LIFE, 0.3, 1.9, 0);
    this.light.position.copy(position).addScaledVector(towardShooter, 0.4);
    this.light.color.setHex(color);
    this.lightAge = 0;

    const burst = this.sparks.find((s) => s.age >= 1) ?? this.createSparks();
    const positions = burst.points.geometry.attributes.position as THREE.BufferAttribute;
    const back = towardShooter.clone().normalize();
    for (let i = 0; i < SPARKS; i += 1) {
      positions.setXYZ(i, position.x, position.y, position.z);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
        .multiplyScalar(0.6).add(back).normalize().multiplyScalar(4 + Math.random() * 7);
      burst.velocities.set([v.x, v.y, v.z], i * 3);
    }
    positions.needsUpdate = true;
    burst.points.material.color.setHex(color);
    burst.age = 0;
    burst.points.visible = true;
  }

  update(dt: number): void {
    for (const beam of this.beams) {
      if (beam.age >= 1) continue;
      beam.age = Math.min(1, beam.age + dt / BEAM_LIFE);
      const u = beam.mesh.material.uniforms;
      u.uLife.value = beam.age;
      u.uWidth.value = 0.12 * (1 - beam.age * 0.45);
      beam.mesh.visible = beam.age < 1;
    }
    for (const sprite of this.sprites) {
      if (sprite.age >= 1) continue;
      sprite.age = Math.min(1, sprite.age + dt / sprite.life);
      const u = sprite.mesh.material.uniforms;
      u.uLife.value = sprite.age;
      u.uSize.value = THREE.MathUtils.lerp(sprite.size0, sprite.size1, 1 - Math.pow(1 - sprite.age, 2));
      sprite.mesh.visible = sprite.age < 1;
    }
    for (const burst of this.sparks) {
      if (burst.age >= 1) continue;
      burst.age = Math.min(1, burst.age + dt / IMPACT_LIFE);
      const positions = burst.points.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < SPARKS; i += 1) {
        burst.velocities[i * 3 + 1]! -= 9 * dt;
        positions.setXYZ(i,
          positions.getX(i) + burst.velocities[i * 3]! * dt,
          positions.getY(i) + burst.velocities[i * 3 + 1]! * dt,
          positions.getZ(i) + burst.velocities[i * 3 + 2]! * dt);
        burst.velocities[i * 3]! *= 0.9;
        burst.velocities[i * 3 + 2]! *= 0.9;
      }
      positions.needsUpdate = true;
      burst.points.material.opacity = (1 - burst.age) * Math.min(1, this.power);
      burst.points.visible = burst.age < 1;
    }
    this.lightAge = Math.min(1, this.lightAge + dt / 0.12);
    this.light.intensity = (1 - this.lightAge) * (1 - this.lightAge) * 14 * this.power;
  }

  private createBeam(): Beam {
    const segments = 24;
    const positions: number[] = [];
    const t: number[] = [];
    const side: number[] = [];
    const index: number[] = [];
    for (let i = 0; i <= segments; i += 1) {
      for (const s of [-1, 1]) { positions.push(0, 0, 0); t.push(i / segments); side.push(s); }
      if (i < segments) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aT", new THREE.Float32BufferAttribute(t, 1));
    geometry.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
    geometry.setIndex(index);
    const material = additive(beamVertex, beamFragment, {
      uStart: { value: new THREE.Vector3() }, uEnd: { value: new THREE.Vector3() }, uWidth: { value: 0.11 },
      uColor: { value: new THREE.Color() }, uLife: { value: 1 }, uLength: { value: 1 }, uPower: { value: 1 }
    });
    material.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    this.scene.add(mesh);
    const beam = { mesh, age: 1 };
    this.beams.push(beam);
    return beam;
  }

  private spawnSprite(center: THREE.Vector3, fragment: string, color: number, life: number, size0: number, size1: number, spin: number): void {
    const sprite = this.sprites.find((s) => s.age >= 1 && s.mesh.material.fragmentShader === fragment) ?? this.createSprite(fragment);
    const u = sprite.mesh.material.uniforms;
    (u.uCenter.value as THREE.Vector3).copy(center);
    (u.uColor.value as THREE.Color).setHex(color);
    u.uSpin.value = spin;
    u.uPower.value = this.power;
    u.uSize.value = size0;
    u.uLife.value = 0;
    Object.assign(sprite, { age: 0, life, size0, size1 });
    sprite.mesh.visible = true;
  }

  private createSprite(fragment: string): Sprite {
    const material = additive(spriteVertex, fragment, {
      uCenter: { value: new THREE.Vector3() }, uSize: { value: 0.3 }, uSpin: { value: 0 },
      uColor: { value: new THREE.Color() }, uLife: { value: 1 }, uPower: { value: 1 }
    });
    material.depthTest = fragment !== flashFragment;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 11;
    this.scene.add(mesh);
    const sprite = { mesh, age: 1, life: 0.1, size0: 0.2, size1: 0.3 };
    this.sprites.push(sprite);
    return sprite;
  }

  private createSparks(): Sparks {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(SPARKS * 3), 3));
    const material = new THREE.PointsMaterial({
      color: 0x9edcff, size: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    this.scene.add(points);
    const burst = { points, velocities: new Float32Array(SPARKS * 3), age: 1 };
    this.sparks.push(burst);
    return burst;
  }
}
