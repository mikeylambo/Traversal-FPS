import * as THREE from "three";

export interface WarpRifleVisualState {
  anchorReady?: boolean;
  warpHeld?: boolean;
  transiting?: boolean;
}

const WHITE = 0xf3f5f4;
const WHITE_EDGE = 0xd8e0e2;
const GRAPHITE = 0x202832;
const DARK = 0x0a0f15;
const CYAN = 0x61efff;

function material(color: number, metalness: number, roughness: number, emissive = 0x000000, emissiveIntensity = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity });
}

function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const w = width * 0.5;
  const h = height * 0.5;
  const r = Math.min(radius, w, h);
  const s = new THREE.Shape();
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r);
  s.quadraticCurveTo(-w, -h, -w + r, -h);
  return s;
}

function roundedBlock(
  parent: THREE.Object3D,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  mat: THREE.Material,
  rotation: readonly [number, number, number] = [0, 0, 0],
  radius = 0.04,
  name?: string
): THREE.Mesh {
  const geometry = new THREE.ExtrudeGeometry(roundedRectShape(size[0], size[1], radius), {
    depth: size[2],
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: Math.min(radius * 0.35, 0.018),
    bevelThickness: Math.min(radius * 0.35, 0.018),
    curveSegments: 3
  });
  geometry.translate(0, 0, -size[2] * 0.5);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function box(
  parent: THREE.Object3D,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  mat: THREE.Material,
  rotation: readonly [number, number, number] = [0, 0, 0],
  name?: string
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function taperedBlock(
  parent: THREE.Object3D,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  mat: THREE.Material,
  frontScale = 0.72,
  rotation: readonly [number, number, number] = [0, 0, 0],
  name?: string
): THREE.Mesh {
  const g = new THREE.BoxGeometry(...size);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i += 1) {
    if (p.getZ(i) < 0) {
      p.setX(i, p.getX(i) * frontScale);
      p.setY(i, p.getY(i) * frontScale);
    }
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function arcSegment(radius: number, tube: number, start: number, length: number, mat: THREE.Material): THREE.Mesh {
  const geometry = new THREE.TorusGeometry(radius, tube, 10, 28, length);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.rotation.z = start;
  return mesh;
}

function addTraversalMark(parent: THREE.Object3D, position: readonly [number, number, number], rotation: readonly [number, number, number]): void {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.055);
  shape.lineTo(-0.05, -0.035);
  shape.lineTo(0.05, -0.035);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(0, 0.026);
  hole.lineTo(-0.021, -0.014);
  hole.lineTo(0.021, -0.014);
  hole.closePath();
  shape.holes.push(hole);
  const mark = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: GRAPHITE, side: THREE.DoubleSide }));
  mark.position.set(...position);
  mark.rotation.set(...rotation);
  mark.name = "traversal-mark";
  parent.add(mark);
}

/**
 * Approved Traversal Warp Rifle v2.
 * Reconstructed from the approved concept as presentation-only procedural geometry.
 * Gameplay targeting, muzzle authority, recoil timing and warp state remain outside this factory.
 */
export function createWarpRifleModel(): THREE.Group {
  const root = new THREE.Group();
  root.name = "warp-rifle-approved-v2";

  const white = material(WHITE, 0.46, 0.25, 0x27323a, 0.24);
  const whiteEdge = material(WHITE_EDGE, 0.5, 0.21, 0x1c2a33, 0.16);
  const graphite = material(GRAPHITE, 0.78, 0.24, 0x09131b, 0.16);
  const dark = material(DARK, 0.7, 0.31);
  const energy = material(0xc8fcff, 0.14, 0.12, CYAN, 3.5);
  const energySoft = new THREE.MeshBasicMaterial({
    color: CYAN,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });

  const recoilPivot = new THREE.Group();
  recoilPivot.name = "recoil-pivot";
  root.add(recoilPivot);

  // Dark structural spine.
  roundedBlock(recoilPivot, [0.30, 0.18, 1.78], [0, 0.015, -0.02], dark, [0, 0, 0], 0.05, "structural-spine");

  // Rear stock: compact and elevated so first-person view does not become a slab.
  taperedBlock(recoilPivot, [0.42, 0.23, 0.47], [0, 0.08, 0.82], white, 0.88, [0.01, 0, 0], "rear-stock-shell");
  roundedBlock(recoilPivot, [0.32, 0.10, 0.38], [0, -0.075, 0.83], graphite, [0, 0, 0], 0.03);
  roundedBlock(recoilPivot, [0.34, 0.065, 0.12], [0, 0.215, 0.76], graphite, [0, 0, 0], 0.025);
  roundedBlock(recoilPivot, [0.28, 0.035, 0.18], [0, 0.145, 0.585], energySoft, [0, 0, 0], 0.012);

  // Receiver shell: layered white masses with a recessed dark waist.
  taperedBlock(recoilPivot, [0.49, 0.27, 0.56], [0, 0.115, 0.43], white, 0.88, [0.01, 0, 0], "receiver-main-shell");
  taperedBlock(recoilPivot, [0.41, 0.115, 0.47], [0, -0.08, 0.43], graphite, 0.86, [0, 0, 0]);
  roundedBlock(recoilPivot, [0.43, 0.045, 0.27], [0, 0.265, 0.42], whiteEdge, [0, 0, 0], 0.025);
  roundedBlock(recoilPivot, [0.24, 0.026, 0.17], [0, 0.295, 0.40], graphite, [0, 0, 0], 0.012);

  // Grip and lower brace.
  const grip = taperedBlock(recoilPivot, [0.16, 0.34, 0.19], [0, -0.255, 0.55], graphite, 0.78, [-0.22, 0, 0], "grip");
  roundedBlock(grip, [0.115, 0.22, 0.025], [0, -0.01, 0.102], dark, [0, 0, 0], 0.02);
  roundedBlock(recoilPivot, [0.038, 0.048, 0.61], [-0.175, -0.255, 0.58], whiteEdge, [0.01, 0.08, -0.16], 0.016, "lower-brace-left");
  roundedBlock(recoilPivot, [0.038, 0.048, 0.61], [0.175, -0.255, 0.58], whiteEdge, [0.01, -0.08, 0.16], 0.016, "lower-brace-right");

  // Warp core: exposed circular machine with shell interruptions.
  const corePivot = new THREE.Group();
  corePivot.name = "core-spin-pivot";
  corePivot.position.set(0, 0.045, -0.12);
  recoilPivot.add(corePivot);

  const coreDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.21, 40), graphite);
  coreDrum.rotation.x = Math.PI / 2;
  coreDrum.name = "warp-core-drum";
  corePivot.add(coreDrum);

  const outerCoreRing = new THREE.Mesh(new THREE.TorusGeometry(0.247, 0.029, 12, 48), energy);
  outerCoreRing.name = "warp-core-ring";
  corePivot.add(outerCoreRing);

  const innerCoreRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.013, 10, 42), energySoft);
  innerCoreRing.name = "warp-core-inner-ring";
  corePivot.add(innerCoreRing);

  const hubDark = new THREE.Mesh(new THREE.CylinderGeometry(0.084, 0.084, 0.235, 24), dark);
  hubDark.rotation.x = Math.PI / 2;
  corePivot.add(hubDark);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.25, 24), energy);
  hub.rotation.x = Math.PI / 2;
  hub.name = "warp-core-hub";
  corePivot.add(hub);

  // Four white floating armour arcs from the approved concept.
  const ringSegments = new THREE.Group();
  ringSegments.name = "floating-ring-segments";
  corePivot.add(ringSegments);
  for (let i = 0; i < 4; i += 1) {
    const start = Math.PI * 0.16 + i * Math.PI * 0.5;
    const backing = arcSegment(0.33, 0.055, start, Math.PI * 0.28, graphite);
    backing.position.z = 0.005;
    ringSegments.add(backing);
    const shell = arcSegment(0.34, 0.043, start, Math.PI * 0.28, white);
    shell.position.z = -0.005;
    shell.name = `floating-ring-segment-${i}`;
    ringSegments.add(shell);
    const seam = arcSegment(0.34, 0.012, start + 0.01, Math.PI * 0.25, energySoft);
    seam.position.z = -0.052;
    ringSegments.add(seam);
  }

  // Transition collar behind the emitter.
  roundedBlock(recoilPivot, [0.42, 0.20, 0.25], [0, 0.06, -0.36], graphite, [0, 0, 0], 0.055, "forward-collar");
  roundedBlock(recoilPivot, [0.34, 0.055, 0.30], [0, 0.19, -0.39], white, [0.01, 0, 0], 0.03);

  // Long forked muzzle. White shells are offset outward so the glowing channel stays visible.
  const muzzleAssembly = new THREE.Group();
  muzzleAssembly.name = "muzzle-assembly";
  muzzleAssembly.position.z = -0.58;
  recoilPivot.add(muzzleAssembly);

  [-1, 1].forEach((side) => {
    taperedBlock(muzzleAssembly, [0.15, 0.13, 0.83], [side * 0.175, 0.055, -0.30], white, 0.62, [0.012, side * 0.018, side * 0.018], `muzzle-fork-${side}`);
    taperedBlock(muzzleAssembly, [0.078, 0.075, 0.79], [side * 0.112, 0.028, -0.31], graphite, 0.62, [0, side * 0.012, 0]);
    roundedBlock(muzzleAssembly, [0.024, 0.026, 0.68], [side * 0.098, 0.062, -0.31], energySoft, [0, 0, 0], 0.01);
  });

  taperedBlock(muzzleAssembly, [0.17, 0.075, 0.76], [0, 0.005, -0.31], dark, 0.68, [0, 0, 0], "energy-channel-housing");
  roundedBlock(muzzleAssembly, [0.065, 0.045, 0.72], [0, 0.012, -0.33], energy, [0, 0, 0], 0.02, "energy-channel");
  roundedBlock(muzzleAssembly, [0.035, 0.014, 0.80], [0, 0.085, -0.30], energySoft, [0, 0, 0], 0.008);

  // Small shell caps at the muzzle create the four-prong precision-instrument look.
  [-1, 1].forEach((side) => {
    roundedBlock(muzzleAssembly, [0.13, 0.07, 0.16], [side * 0.178, 0.115, -0.72], whiteEdge, [0.02, side * 0.025, 0], 0.025);
    roundedBlock(muzzleAssembly, [0.12, 0.055, 0.16], [side * 0.178, -0.065, -0.72], whiteEdge, [-0.02, side * 0.025, 0], 0.025);
  });

  // Side accent bars and brand mark.
  roundedBlock(recoilPivot, [0.025, 0.05, 0.19], [-0.247, 0.10, 0.28], energySoft, [0, 0, 0], 0.01);
  roundedBlock(recoilPivot, [0.025, 0.05, 0.19], [0.247, 0.10, 0.28], energySoft, [0, 0, 0], 0.01);
  addTraversalMark(recoilPivot, [0.252, 0.105, 0.48], [0, -Math.PI * 0.5, 0]);

  const muzzleSocket = new THREE.Object3D();
  muzzleSocket.name = "muzzle-socket";
  muzzleSocket.position.set(0, 0.012, -1.69);
  recoilPivot.add(muzzleSocket);

  root.userData.warpRifleMaterials = { energy, energySoft };
  root.userData.warpRifleParts = { recoilPivot, corePivot, ringSegments, muzzleAssembly, muzzleSocket };
  return root;
}

export function updateWarpRifleModel(visual: THREE.Group, dt: number, time: number): void {
  const parts = visual.userData.warpRifleParts as {
    corePivot?: THREE.Group;
    ringSegments?: THREE.Group;
    muzzleAssembly?: THREE.Group;
  } | undefined;
  const materials = visual.userData.warpRifleMaterials as {
    energy?: THREE.MeshStandardMaterial;
    energySoft?: THREE.MeshBasicMaterial;
  } | undefined;
  const state = (visual.parent?.userData.traversalWeaponState ?? {}) as WarpRifleVisualState;
  const preview = Boolean(state.anchorReady && state.warpHeld);

  if (parts?.corePivot) parts.corePivot.rotation.z += dt * (state.transiting ? 5.2 : preview ? 2.6 : 0.55);
  if (parts?.ringSegments) {
    parts.ringSegments.rotation.z = Math.sin(time * 0.85) * 0.022;
    const breathe = 1 + Math.sin(time * (preview ? 7.5 : 2.2)) * (preview ? 0.025 : 0.007);
    parts.ringSegments.scale.setScalar(breathe);
  }
  if (parts?.muzzleAssembly) {
    parts.muzzleAssembly.position.y = Math.sin(time * 1.6) * 0.0025;
  }

  if (materials?.energy) {
    materials.energy.emissiveIntensity = state.transiting
      ? 7.6
      : preview
        ? 5.2 + Math.sin(time * 10) * 0.9
        : state.anchorReady
          ? 3.9 + Math.sin(time * 4.4) * 0.28
          : 3.0;
  }
  if (materials?.energySoft) {
    materials.energySoft.opacity = state.transiting ? 1 : preview ? 0.96 : state.anchorReady ? 0.82 : 0.64;
  }
}
