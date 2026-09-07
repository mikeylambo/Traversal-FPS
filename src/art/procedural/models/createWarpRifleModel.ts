import * as THREE from "three";

export interface WarpRifleVisualState {
  anchorReady?: boolean;
  warpHeld?: boolean;
  transiting?: boolean;
}

const WHITE = 0xe8edf0;
const GRAPHITE = 0x10151b;
const DARK = 0x070b10;
const CYAN = 0x61efff;

function standardMaterial(color: number, metalness: number, roughness: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function emissiveMaterial(intensity = 3.2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xbafaff,
    emissive: CYAN,
    emissiveIntensity: intensity,
    metalness: 0.18,
    roughness: 0.14,
    toneMapped: false
  });
}

function box(
  parent: THREE.Object3D,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  material: THREE.Material,
  rotation: readonly [number, number, number] = [0, 0, 0],
  name?: string
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function wedge(
  parent: THREE.Object3D,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  material: THREE.Material,
  rotationZ = 0,
  name?: string
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(...size);
  const positionAttribute = geometry.attributes.position;
  for (let i = 0; i < positionAttribute.count; i += 1) {
    const z = positionAttribute.getZ(i);
    const y = positionAttribute.getY(i);
    const taper = THREE.MathUtils.mapLinear(z, -size[2] * 0.5, size[2] * 0.5, 0.78, 1.08);
    positionAttribute.setY(i, y * taper);
  }
  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.z = rotationZ;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function addTraversalMark(parent: THREE.Object3D, z = 0.006): void {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.055);
  shape.lineTo(-0.048, -0.035);
  shape.lineTo(0.048, -0.035);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(0, 0.025);
  hole.lineTo(-0.02, -0.015);
  hole.lineTo(0.02, -0.015);
  hole.closePath();
  shape.holes.push(hole);
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: GRAPHITE, side: THREE.DoubleSide })
  );
  mesh.name = "traversal-mark";
  mesh.position.set(0.162, 0.065, z);
  mesh.rotation.y = -Math.PI / 2;
  parent.add(mesh);
}

/**
 * Approved Traversal Warp Rifle v1.
 * Presentation only: gameplay, targeting, recoil authority and muzzle logic remain in WarpRifle.
 */
export function createWarpRifleModel(): THREE.Group {
  const root = new THREE.Group();
  root.name = "warp-rifle-approved-v1";

  const white = standardMaterial(WHITE, 0.56, 0.24);
  const graphite = standardMaterial(GRAPHITE, 0.82, 0.2);
  const dark = standardMaterial(DARK, 0.72, 0.3);
  const energy = emissiveMaterial();
  const energySoft = new THREE.MeshBasicMaterial({
    color: CYAN,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });

  const recoilPivot = new THREE.Group();
  recoilPivot.name = "recoil-pivot";
  root.add(recoilPivot);

  // Rear stock and receiver: broad immaculate white masses over a dark structural spine.
  box(recoilPivot, [0.33, 0.24, 0.48], [0, 0.03, 0.35], dark);
  wedge(recoilPivot, [0.41, 0.22, 0.52], [0, 0.12, 0.26], white, 0, "receiver-shell");
  box(recoilPivot, [0.38, 0.19, 0.36], [0, 0.065, 0.68], white, [0.02, 0, 0], "rear-stock");
  box(recoilPivot, [0.28, 0.055, 0.34], [0, -0.075, 0.68], graphite);
  box(recoilPivot, [0.22, 0.035, 0.18], [0, 0.205, 0.32], graphite);

  // Grip and lower support rail.
  box(recoilPivot, [0.15, 0.31, 0.17], [0, -0.245, 0.36], graphite, [-0.18, 0, 0], "grip");
  box(recoilPivot, [0.11, 0.25, 0.12], [0, -0.255, 0.35], dark, [-0.18, 0, 0]);
  box(recoilPivot, [0.035, 0.045, 0.58], [-0.16, -0.25, 0.47], white, [0.02, 0.08, -0.14]);
  box(recoilPivot, [0.035, 0.045, 0.58], [0.16, -0.25, 0.47], white, [0.02, -0.08, 0.14]);

  // Warp core housing.
  const corePivot = new THREE.Group();
  corePivot.name = "core-spin-pivot";
  corePivot.position.set(0, 0.045, -0.18);
  recoilPivot.add(corePivot);

  const coreDark = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.18, 28), graphite);
  coreDark.rotation.x = Math.PI / 2;
  corePivot.add(coreDark);

  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.026, 10, 42), energy);
  coreRing.name = "warp-core-ring";
  corePivot.add(coreRing);

  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.012, 8, 36), energySoft);
  innerRing.name = "warp-core-inner-ring";
  corePivot.add(innerRing);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.057, 0.057, 0.21, 18), energy);
  hub.name = "warp-core-hub";
  hub.rotation.x = Math.PI / 2;
  corePivot.add(hub);

  // Four suspended armor arcs surrounding the core.
  const ringSegments = new THREE.Group();
  ringSegments.name = "floating-ring-segments";
  corePivot.add(ringSegments);
  for (let i = 0; i < 4; i += 1) {
    const angle = i * Math.PI * 0.5 + Math.PI * 0.25;
    const segment = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.037, 8, 16, Math.PI * 0.28), white);
    segment.name = `floating-ring-segment-${i}`;
    segment.rotation.z = angle - Math.PI * 0.14;
    segment.position.set(Math.cos(angle) * 0.025, Math.sin(angle) * 0.025, 0);
    ringSegments.add(segment);
  }

  // Forward chassis creates the distinctive forked, precision-instrument silhouette.
  box(recoilPivot, [0.22, 0.13, 0.64], [0, 0.035, -0.58], graphite);
  wedge(recoilPivot, [0.24, 0.1, 0.55], [0, 0.17, -0.58], white, 0);

  [-1, 1].forEach((side) => {
    const fork = wedge(recoilPivot, [0.105, 0.105, 0.62], [side * 0.145, 0.02, -0.84], white, side * 0.025, `muzzle-fork-${side}`);
    fork.rotation.y = side * 0.01;
    box(recoilPivot, [0.045, 0.052, 0.57], [side * 0.115, 0.008, -0.86], graphite);
    box(recoilPivot, [0.018, 0.022, 0.53], [side * 0.091, 0.058, -0.88], energySoft);
  });

  // Central energy channel.
  box(recoilPivot, [0.105, 0.064, 0.83], [0, 0.01, -0.72], dark, [0, 0, 0], "energy-channel-housing");
  box(recoilPivot, [0.048, 0.035, 0.78], [0, 0.014, -0.75], energy, [0, 0, 0], "energy-channel");
  box(recoilPivot, [0.025, 0.014, 0.88], [0, 0.075, -0.71], energySoft);

  // Small restrained side accents.
  box(recoilPivot, [0.025, 0.045, 0.16], [-0.205, 0.09, 0.14], energySoft);
  box(recoilPivot, [0.025, 0.045, 0.16], [0.205, 0.09, 0.14], energySoft);
  addTraversalMark(recoilPivot);

  const muzzleSocket = new THREE.Object3D();
  muzzleSocket.name = "muzzle-socket";
  muzzleSocket.position.set(0, 0.01, -1.18);
  recoilPivot.add(muzzleSocket);

  root.userData.warpRifleMaterials = { energy, energySoft };
  root.userData.warpRifleParts = { recoilPivot, corePivot, ringSegments, muzzleSocket };
  return root;
}

export function updateWarpRifleModel(visual: THREE.Group, dt: number, time: number): void {
  const parts = visual.userData.warpRifleParts as {
    corePivot?: THREE.Group;
    ringSegments?: THREE.Group;
  } | undefined;
  const materials = visual.userData.warpRifleMaterials as {
    energy?: THREE.MeshStandardMaterial;
    energySoft?: THREE.MeshBasicMaterial;
  } | undefined;
  const state = (visual.parent?.userData.traversalWeaponState ?? {}) as WarpRifleVisualState;
  const preview = Boolean(state.anchorReady && state.warpHeld);

  if (parts?.corePivot) parts.corePivot.rotation.z += dt * (state.transiting ? 5.5 : preview ? 2.8 : 0.7);
  if (parts?.ringSegments) {
    parts.ringSegments.rotation.z = Math.sin(time * 0.9) * 0.025;
    parts.ringSegments.scale.setScalar(1 + Math.sin(time * (preview ? 7 : 2.4)) * (preview ? 0.025 : 0.008));
  }

  if (materials?.energy) {
    materials.energy.emissiveIntensity = state.transiting
      ? 7.2
      : preview
        ? 4.8 + Math.sin(time * 10) * 0.8
        : state.anchorReady
          ? 3.7 + Math.sin(time * 4.5) * 0.25
          : 2.6;
  }
  if (materials?.energySoft) materials.energySoft.opacity = state.transiting ? 1 : preview ? 0.92 : state.anchorReady ? 0.76 : 0.58;
}
