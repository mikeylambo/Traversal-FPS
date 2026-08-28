import * as THREE from "three";

export interface WarpRifleState {
  anchorReady: boolean;
  warpHeld: boolean;
  transiting: boolean;
}

export class WarpRifle {
  readonly group = new THREE.Group();
  readonly muzzle = new THREE.Object3D();

  private readonly rest = new THREE.Vector3(0.43, -0.34, -0.78);
  private readonly coreMaterial = new THREE.MeshStandardMaterial({
    color: 0xbffcff,
    emissive: 0x20dfff,
    emissiveIntensity: 2.2,
    metalness: 0.18,
    roughness: 0.12
  });
  private readonly glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x69efff,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  private readonly blueMaterial = new THREE.MeshStandardMaterial({
    color: 0x1767c9,
    emissive: 0x0b3f79,
    emissiveIntensity: 0.18,
    metalness: 0.68,
    roughness: 0.2
  });
  private readonly whiteMaterial = new THREE.MeshStandardMaterial({
    color: 0xeaf4ff,
    emissive: 0x183451,
    emissiveIntensity: 0.08,
    metalness: 0.64,
    roughness: 0.19
  });
  private readonly graphiteMaterial = new THREE.MeshStandardMaterial({
    color: 0x101b2a,
    emissive: 0x06101b,
    emissiveIntensity: 0.12,
    metalness: 0.84,
    roughness: 0.24
  });
  private readonly cellMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly sideFins: Array<{ mesh: THREE.Mesh; baseX: number; side: number }> = [];
  private readonly coreSegments: THREE.Mesh[] = [];

  private kick = 0;
  private time = 0;

  constructor(camera: THREE.Camera) {
    this.build();
    this.group.position.copy(this.rest);
    this.group.rotation.set(-0.035, -0.025, -0.045);
    camera.add(this.group);
  }

  fire(): void {
    this.kick = 1;
  }

  update(dt: number, state: WarpRifleState): void {
    this.time += dt;
    this.kick *= Math.pow(0.0018, dt);

    const preview = state.warpHeld && state.anchorReady;
    const loaded = state.anchorReady;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * (preview ? 12 : 5.5));

    this.group.position.copy(this.rest);
    this.group.position.z += this.kick * 0.11;
    this.group.position.y -= this.kick * 0.025;
    if (preview) {
      this.group.position.x -= 0.035;
      this.group.position.y += 0.012;
    }
    if (state.transiting) this.group.position.x -= 0.08;

    this.group.rotation.x = -0.035 + this.kick * 0.055;
    this.group.rotation.y = -0.025 + (preview ? 0.02 : 0);
    this.group.rotation.z = -0.045 - this.kick * 0.022 + (preview ? 0.012 : 0);

    this.coreMaterial.emissiveIntensity = state.transiting
      ? 7.2
      : preview
        ? 4.8 + pulse * 1.4
        : loaded
          ? 3.4 + pulse * 0.55
          : 1.8 + pulse * 0.28;
    this.glowMaterial.opacity = state.transiting ? 1 : preview ? 0.98 : loaded ? 0.78 : 0.42;
    this.blueMaterial.emissiveIntensity = state.transiting ? 0.85 : preview ? 0.48 : loaded ? 0.3 : 0.18;

    this.cellMaterials.forEach((material, index) => {
      const phase = Math.max(0, Math.sin(this.time * 7.5 - index * 0.55));
      material.emissiveIntensity = loaded ? 2.8 + phase * (preview ? 2.4 : 0.8) : 0.32;
      material.color.setHex(loaded ? 0xa7fbff : 0x31566d);
    });

    this.sideFins.forEach(({ mesh, baseX, side }) => {
      const spread = preview ? 0.055 : loaded ? 0.018 : 0;
      mesh.position.x = baseX + spread * side;
      mesh.rotation.z = side * (preview ? 0.16 : loaded ? 0.055 : 0.02);
    });

    this.coreSegments.forEach((segment, index) => {
      const scale = 0.94 + Math.sin(this.time * 8 - index * 0.6) * (preview ? 0.08 : 0.025);
      segment.scale.y = scale;
    });
  }

  muzzleWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    this.group.updateWorldMatrix(true, true);
    return this.muzzle.getWorldPosition(target);
  }

  private build(): void {
    const makeBox = (
      size: [number, number, number],
      position: [number, number, number],
      material: THREE.Material,
      rotation: [number, number, number] = [0, 0, 0]
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      this.group.add(mesh);
      return mesh;
    };

    // Dark internal chassis — visible through the white/blue armor gaps.
    makeBox([0.19, 0.15, 1.18], [0, 0.005, -0.18], this.graphiteMaterial);
    makeBox([0.15, 0.23, 0.28], [0, -0.17, 0.19], this.graphiteMaterial, [-0.22, 0, 0]);
    makeBox([0.09, 0.09, 0.42], [0, 0.005, -0.91], this.graphiteMaterial);

    // Long precision-rifle armor silhouette.
    makeBox([0.31, 0.09, 0.54], [0, 0.115, 0.12], this.whiteMaterial, [0.015, 0, 0]);
    makeBox([0.34, 0.075, 0.46], [0, 0.095, -0.34], this.blueMaterial, [-0.015, 0, 0]);
    makeBox([0.25, 0.08, 0.35], [0, 0.07, -0.72], this.whiteMaterial, [0.025, 0, 0]);
    makeBox([0.15, 0.055, 0.46], [0, -0.085, -0.45], this.blueMaterial);

    // Layered side plates give the hand-built cel-shaded reference silhouette.
    makeBox([0.055, 0.14, 0.65], [-0.17, 0.015, -0.18], this.blueMaterial, [0, 0, -0.05]);
    makeBox([0.055, 0.14, 0.65], [0.17, 0.015, -0.18], this.blueMaterial, [0, 0, 0.05]);
    makeBox([0.045, 0.09, 0.42], [-0.145, -0.035, -0.66], this.whiteMaterial, [0, 0, -0.08]);
    makeBox([0.045, 0.09, 0.42], [0.145, -0.035, -0.66], this.whiteMaterial, [0, 0, 0.08]);

    // Exposed cyan vector rail running through the body.
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.86, 10), this.coreMaterial);
    core.rotation.x = Math.PI / 2;
    core.position.set(0, 0.018, -0.29);
    this.group.add(core);

    [-0.48, -0.26, -0.04, 0.18].forEach((z, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: 0x31566d,
        emissive: 0x22dfff,
        emissiveIntensity: 0.32,
        metalness: 0.25,
        roughness: 0.12
      });
      this.cellMaterials.push(material);
      const cell = makeBox([0.105, 0.025, 0.13], [0, 0.158, z], material);
      cell.rotation.x = index % 2 === 0 ? 0.025 : -0.025;
    });

    // Thin emissive veins.
    [-1, 1].forEach((side) => {
      const rail = makeBox([0.018, 0.028, 0.64], [0.112 * side, 0.104, -0.27], this.glowMaterial);
      rail.rotation.z = side * 0.025;
    });

    // Split muzzle aperture + reactive side fins.
    const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.014, 8, 28), this.glowMaterial);
    muzzleRing.position.set(0, 0.004, -1.12);
    this.group.add(muzzleRing);
    [-1, 1].forEach((side) => {
      const fin = makeBox([0.08, 0.08, 0.29], [0.115 * side, 0.015, -0.96], this.blueMaterial, [0, 0, side * 0.02]);
      this.sideFins.push({ mesh: fin, baseX: fin.position.x, side });
    });
    makeBox([0.05, 0.055, 0.31], [0, 0.105, -0.96], this.whiteMaterial);

    // Segmented glowing chamber visible beneath the top shell.
    [-0.56, -0.42, -0.28].forEach((z) => {
      const segment = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.095, 10), this.coreMaterial);
      segment.rotation.x = Math.PI / 2;
      segment.position.set(0, -0.045, z);
      this.group.add(segment);
      this.coreSegments.push(segment);
    });

    // Grip and open lower brace.
    makeBox([0.12, 0.31, 0.16], [0, -0.22, 0.2], this.graphiteMaterial, [-0.23, 0, 0]);
    makeBox([0.045, 0.05, 0.34], [-0.11, -0.19, 0.03], this.whiteMaterial, [0, 0.08, -0.2]);
    makeBox([0.045, 0.05, 0.34], [0.11, -0.19, 0.03], this.blueMaterial, [0, -0.08, 0.2]);

    this.muzzle.position.set(0, 0.005, -1.16);
    this.group.add(this.muzzle);
  }
}
