import * as THREE from "three";

export interface WarpRifleVisualState {
  anchorReady?: boolean;
  warpHeld?: boolean;
  transiting?: boolean;
}

/*
 * Approved Traversal Warp Rifle (v3).
 *
 * Reconstructed from the approved concept sheet: white ceramic shell over a
 * graphite chassis, a circular warp core with a segmented halo of floating
 * armour, a forked emitter carrying a cyan energy channel, a raked grip and a
 * thumbhole stock. Silhouettes are authored as side profiles (z = barrel axis,
 * -z forward, y up) and extruded with hard chamfers so they read cleanly at
 * first-person distance.
 *
 * Presentation only. Gameplay muzzle authority, recoil timing and warp state
 * live in WarpRifle.ts; this factory exposes named pivots/sockets for them:
 *   recoil-pivot, core-spin-pivot, floating-ring-segments, muzzle-socket.
 */

type P2 = readonly [number, number];

const WHITE = 0xaab3ba;
const WHITE_EDGE = 0x98a2aa;
const GRAPHITE = 0x2a3139;
const DARK = 0x0b0f14;
const CYAN = 0x4fe6ff;

let sharedEnvironment: THREE.DataTexture | null = null;

/**
 * Tiny procedural studio environment so the ceramic shell carries soft
 * highlights and graphite reads as metal without relying on scene setup.
 */
function studioEnvironment(): THREE.DataTexture {
  if (sharedEnvironment) return sharedEnvironment;
  const width = 64;
  const height = 32;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1); // 0 = bottom, 1 = top
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      let r = 14 + v * 34;
      let g = 20 + v * 44;
      let b = 30 + v * 58;
      // Overhead softbox and a cool rim strip.
      const softbox = Math.exp(-((v - 0.86) ** 2) / 0.004) * Math.exp(-((u - 0.3) ** 2) / 0.03);
      const rim = Math.exp(-((v - 0.55) ** 2) / 0.002) * (0.5 + 0.5 * Math.cos((u - 0.8) * Math.PI * 2));
      r += softbox * 235 + rim * 60;
      g += softbox * 240 + rim * 150;
      b += softbox * 245 + rim * 190;
      const i = (y * width + x) * 4;
      data[i] = Math.min(255, r);
      data[i + 1] = Math.min(255, g);
      data[i + 2] = Math.min(255, b);
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  sharedEnvironment = texture;
  return texture;
}

function surface(color: number, metalness: number, roughness: number, envMapIntensity: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, envMap: studioEnvironment(), envMapIntensity });
}

function shapeFrom(points: readonly P2[]): THREE.Shape {
  const shape = new THREE.Shape();
  points.forEach(([u, v], index) => (index === 0 ? shape.moveTo(u, v) : shape.lineTo(u, v)));
  shape.closePath();
  return shape;
}

interface SlabOptions {
  x?: number;
  bevel?: number;
  /** Cross-section taper: x scale at the top (1 = square, <1 = chamfered crown). */
  crown?: number;
  /** Cross-section taper at the bottom. */
  keel?: number;
  /** x scale at the forward-most end of the profile (plan-view taper). */
  nose?: number;
  name?: string;
}

/**
 * Side-profile slab: `points` are (z, y) pairs, extruded symmetrically across x
 * with a single-segment chamfer. Optional crown/keel/nose scale x per vertex to
 * give faceted, hard-surface cross sections.
 */
function slab(parent: THREE.Object3D, points: readonly P2[], width: number, mat: THREE.Material, options: SlabOptions = {}): THREE.Mesh {
  const bevel = options.bevel ?? 0.012;
  const depth = Math.max(0.002, width - bevel * 2);
  const geometry = new THREE.ExtrudeGeometry(shapeFrom(points), {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 4
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateY(-Math.PI / 2);

  const crown = options.crown ?? 1;
  const keel = options.keel ?? 1;
  const nose = options.nose ?? 1;
  if (crown !== 1 || keel !== 1 || nose !== 1) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i += 1) {
      const ty = (p.getY(i) - box.min.y) / Math.max(1e-6, box.max.y - box.min.y);
      const tz = (box.max.z - p.getZ(i)) / Math.max(1e-6, box.max.z - box.min.z);
      const vertical = ty > 0.5 ? THREE.MathUtils.lerp(1, crown, (ty - 0.5) * 2) : THREE.MathUtils.lerp(1, keel, (0.5 - ty) * 2);
      p.setX(i, p.getX(i) * vertical * THREE.MathUtils.lerp(1, nose, tz * tz));
    }
    p.needsUpdate = true;
  }
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.x = options.x ?? 0;
  if (options.name) mesh.name = options.name;
  parent.add(mesh);
  return mesh;
}

/** Faceted body of revolution around the barrel axis: profile is (z, radius). */
function faceted(parent: THREE.Object3D, profile: readonly P2[], sides: number, mat: THREE.Material, name?: string): THREE.Mesh {
  const lathe = new THREE.LatheGeometry(profile.map(([z, r]) => new THREE.Vector2(r, z)), sides);
  lathe.rotateY(Math.PI / sides);
  lathe.rotateX(Math.PI / 2);
  const geometry = lathe.toNonIndexed();
  lathe.dispose();
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat);
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

/** Chamfered annular sector in the XY plane (ring axis = z). */
function annulus(inner: number, outer: number, start: number, length: number, depth: number, bevel = 0.008): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, start, start + length, false);
  shape.absarc(0, 0, inner, start + length, start, true);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.002, depth - bevel * 2),
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: Math.max(6, Math.round(length * 18))
  });
  geometry.translate(0, 0, -(depth - bevel * 2) / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function fullRing(inner: number, outer: number, depth: number, bevel = 0.008): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.002, depth - bevel * 2),
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 40
  });
  geometry.translate(0, 0, -(depth - bevel * 2) / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function strip(parent: THREE.Object3D, size: readonly [number, number, number], position: readonly [number, number, number], mat: THREE.Material, name?: string): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function decalTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  draw(ctx, w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function addDecal(parent: THREE.Object3D, texture: THREE.Texture | null, size: readonly [number, number], position: readonly [number, number, number], side: 1 | -1, name: string): void {
  if (!texture) return;
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
  mesh.position.set(...position);
  mesh.rotation.y = side * Math.PI * 0.5;
  mesh.name = name;
  parent.add(mesh);
}

export function createWarpRifleModel(): THREE.Group {
  const root = new THREE.Group();
  root.name = "warp-rifle-approved-v3";

  const white = surface(WHITE, 0.04, 0.46, 0.55);
  const whiteEdge = surface(WHITE_EDGE, 0.06, 0.42, 0.55);
  const graphite = surface(GRAPHITE, 0.72, 0.36, 1.1);
  const dark = surface(DARK, 0.55, 0.5, 0.7);
  const gripPad = surface(0x151a20, 0.2, 0.82, 0.4);
  const energy = new THREE.MeshStandardMaterial({ color: 0xd8fdff, emissive: CYAN, emissiveIntensity: 3, metalness: 0, roughness: 0.2 });
  const energySoft = new THREE.MeshBasicMaterial({
    color: CYAN,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });

  const recoilPivot = new THREE.Group();
  recoilPivot.name = "recoil-pivot";
  root.add(recoilPivot);

  // ── Rear stock ────────────────────────────────────────────────────────────
  slab(recoilPivot, [[0.66, 0.0], [0.66, 0.232], [1.12, 0.232], [1.12, -0.108], [0.97, -0.108], [0.82, -0.04]], 0.25, white, { crown: 0.86, keel: 0.9, bevel: 0.016, name: "rear-stock-shell" });
  slab(recoilPivot, [[1.11, 0.215], [1.15, 0.215], [1.15, -0.09], [1.11, -0.09]], 0.2, whiteEdge, { crown: 0.9, bevel: 0.01, name: "stock-butt-cap" });
  strip(recoilPivot, [0.21, 0.26, 0.012], [0, 0.06, 1.108], graphite); // butt seam
  strip(recoilPivot, [0.262, 0.012, 0.3], [0, 0.17, 0.88], dark); // panel seam
  strip(recoilPivot, [0.256, 0.01, 0.012], [0, 0.1, 0.72], dark);
  strip(recoilPivot, [0.254, 0.008, 0.26], [0, -0.005, 0.95], dark);
  strip(recoilPivot, [0.254, 0.1, 0.008], [0, 0.07, 1.055], dark);

  // ── Receiver: white upper shell over a graphite lower ─────────────────────
  slab(recoilPivot, [[-0.04, 0.195], [0.1, 0.275], [0.76, 0.275], [0.76, 0.03], [-0.04, 0.03]], 0.31, white, { crown: 0.78, bevel: 0.018, name: "receiver-upper-shell" });
  slab(recoilPivot, [[0.0, 0.045], [0.7, 0.045], [0.7, -0.085], [0.06, -0.085]], 0.27, graphite, { keel: 0.85, name: "receiver-lower" });
  slab(recoilPivot, [[0.2, 0.29], [0.62, 0.29], [0.62, 0.262], [0.2, 0.262]], 0.16, dark, { bevel: 0.006, name: "top-vent" });
  strip(recoilPivot, [0.318, 0.012, 0.012], [0, 0.2, 0.31], dark);
  strip(recoilPivot, [0.318, 0.012, 0.012], [0, 0.14, 0.64], dark);
  [-1, 1].forEach((side) => slab(recoilPivot, [[0.02, 0.19], [0.1, 0.235], [0.2, 0.235], [0.2, 0.08], [0.02, 0.08]], 0.02, graphite, { x: side * 0.148, bevel: 0.004 }));
  strip(recoilPivot, [0.32, 0.03, 0.22], [0, 0.0, 0.26], energySoft, "receiver-light-bar");

  // ── Grip and thumbhole brace ──────────────────────────────────────────────
  const grip = slab(recoilPivot, [[0.42, -0.05], [0.64, -0.05], [0.56, -0.335], [0.37, -0.335], [0.35, -0.29]], 0.13, graphite, { bevel: 0.018, name: "grip" });
  slab(grip, [[0.44, -0.1], [0.58, -0.1], [0.52, -0.3], [0.4, -0.3]], 0.15, gripPad, { bevel: 0.01 });
  slab(recoilPivot, [
    [0.28, -0.07], [0.34, -0.07], [0.34, -0.3], [0.37, -0.318], [0.95, -0.318], [0.99, -0.28], [0.99, -0.1],
    [1.07, -0.1], [1.07, -0.3], [1.0, -0.378], [0.36, -0.378], [0.28, -0.33]
  ], 0.075, white, { bevel: 0.014, name: "thumbhole-brace" });

  // ── Mid body: faceted pressure hull between receiver and core ─────────────
  faceted(recoilPivot, [[-0.54, 0.0], [-0.54, 0.19], [-0.47, 0.245], [-0.3, 0.268], [-0.06, 0.252], [0.04, 0.2], [0.04, 0.0]], 8, white, "mid-hull");
  faceted(recoilPivot, [[-0.6, 0.0], [-0.6, 0.2], [-0.5, 0.215], [-0.5, 0.0]], 16, graphite, "core-collar");
  const collarGlow = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.009, 8, 48), energySoft);
  collarGlow.position.z = -0.605;
  recoilPivot.add(collarGlow);
  [-1, 1].forEach((side) => {
    strip(recoilPivot, [0.02, 0.036, 0.13], [side * 0.244, 0.0, -0.2], energy, `hull-slot-${side}`);
    strip(recoilPivot, [0.012, 0.012, 0.44], [side * 0.232, 0.1, -0.27], dark);
  });

  // ── Warp core ─────────────────────────────────────────────────────────────
  const coreAnchor = new THREE.Group();
  coreAnchor.name = "warp-core";
  coreAnchor.position.set(0, 0, -0.76);
  recoilPivot.add(coreAnchor);

  const coreHousing = new THREE.Mesh(fullRing(0.225, 0.29, 0.15), graphite);
  coreHousing.name = "warp-core-housing";
  coreAnchor.add(coreHousing);
  // Segmented white shell over the housing, with four machined gaps.
  for (let i = 0; i < 4; i += 1) {
    const seg = new THREE.Mesh(annulus(0.262, 0.34, Math.PI * 0.03 + i * Math.PI * 0.5, Math.PI * 0.44, 0.18, 0.016), white);
    seg.name = `warp-core-shell-${i}`;
    coreAnchor.add(seg);
  }
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.24, 40), dark);
  face.position.z = -0.05;
  face.rotation.y = Math.PI;
  coreAnchor.add(face);
  const rearFace = new THREE.Mesh(new THREE.CircleGeometry(0.24, 40), dark);
  rearFace.position.z = 0.05;
  coreAnchor.add(rearFace);

  const corePivot = new THREE.Group();
  corePivot.name = "core-spin-pivot";
  coreAnchor.add(corePivot);
  [-1, 1].forEach((side) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 10, 64), energy);
    ring.position.z = side * 0.055;
    ring.name = side < 0 ? "warp-core-ring" : "warp-core-ring-rear";
    corePivot.add(ring);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.006, 8, 48, Math.PI * 1.55), energySoft);
    inner.position.z = side * 0.056;
    corePivot.add(inner);
  });
  for (let i = 0; i < 3; i += 1) {
    const spoke = strip(corePivot, [0.022, 0.19, 0.09], [0, 0, 0], graphite);
    spoke.rotation.z = (i / 3) * Math.PI * 2;
    spoke.geometry.translate(0, 0.1, 0);
  }
  const hubShell = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.15, 24), graphite);
  hubShell.rotation.x = Math.PI / 2;
  corePivot.add(hubShell);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 14), energy);
  hub.scale.z = 1.9;
  hub.name = "warp-core-hub";
  corePivot.add(hub);

  // Floating armour halo: six chamfered arcs with a cyan inner edge.
  const ringSegments = new THREE.Group();
  ringSegments.name = "floating-ring-segments";
  coreAnchor.add(ringSegments);
  const arc = Math.PI * 0.2;
  for (let i = 0; i < 6; i += 1) {
    const centre = Math.PI * 0.5 + (i - 0.5) * (Math.PI / 3);
    const segment = new THREE.Group();
    segment.name = `floating-ring-segment-${i}`;
    segment.userData.baseAngle = centre;
    const shell = new THREE.Mesh(annulus(0.435, 0.5, centre - arc / 2, arc, 0.085, 0.012), white);
    const under = new THREE.Mesh(annulus(0.42, 0.445, centre - arc * 0.44, arc * 0.88, 0.06, 0.006), dark);
    const glow = new THREE.Mesh(annulus(0.414, 0.424, centre - arc * 0.36, arc * 0.72, 0.03, 0.003), energy);
    segment.add(shell, under, glow);
    ringSegments.add(segment);
  }

  // ── Forward shroud and forked emitter ─────────────────────────────────────
  const muzzleAssembly = new THREE.Group();
  muzzleAssembly.name = "muzzle-assembly";
  recoilPivot.add(muzzleAssembly);

  // Dark spine that carries the emitter from the core forward.
  slab(muzzleAssembly, [[-1.4, 0.07], [-0.8, 0.1], [-0.8, -0.1], [-1.35, -0.075]], 0.17, dark, { name: "emitter-spine" });

  [-1, 1].forEach((side) => {
    // Upper white shroud blade, crowned and pinched toward the nose.
    slab(muzzleAssembly, [[-1.47, 0.085], [-1.38, 0.175], [-0.84, 0.215], [-0.84, 0.045], [-1.42, 0.04]], 0.11, white, { x: side * 0.085, crown: 0.72, nose: 0.7, bevel: 0.014, name: `shroud-upper-${side}` });
    // Lower white shroud blade.
    slab(muzzleAssembly, [[-1.37, -0.04], [-0.84, -0.045], [-0.84, -0.17], [-1.24, -0.135]], 0.1, white, { x: side * 0.08, keel: 0.72, nose: 0.75, bevel: 0.014, name: `shroud-lower-${side}` });
    // Fork prongs: graphite tines with white caps.
    slab(muzzleAssembly, [[-1.75, 0.07], [-1.7, 0.105], [-1.3, 0.1], [-1.3, 0.042], [-1.72, 0.04]], 0.065, graphite, { x: side * 0.06, crown: 0.8, name: `fork-upper-${side}` });
    slab(muzzleAssembly, [[-1.73, -0.035], [-1.33, -0.035], [-1.33, -0.1], [-1.68, -0.106], [-1.73, -0.075]], 0.065, graphite, { x: side * 0.062, keel: 0.8, name: `fork-lower-${side}` });
    slab(muzzleAssembly, [[-1.69, 0.108], [-1.64, 0.125], [-1.46, 0.12], [-1.46, 0.1], [-1.69, 0.098]], 0.055, whiteEdge, { x: side * 0.06, bevel: 0.006 });
    // Side energy channel: the signature glowing blade between the shrouds.
    slab(muzzleAssembly, [[-1.62, 0.022], [-1.56, 0.03], [-1.06, 0.03], [-1.02, 0.0], [-1.06, -0.03], [-1.56, -0.03], [-1.62, -0.022]], 0.02, energy, { x: side * 0.118, bevel: 0.004, name: `energy-channel-${side}` });
    strip(muzzleAssembly, [0.03, 0.08, 0.5], [side * 0.105, 0.0, -1.3], energySoft);
    // Small status light on the upper shroud.
    strip(muzzleAssembly, [0.012, 0.022, 0.08], [side * 0.142, 0.12, -1.02], energy);
  });
  strip(muzzleAssembly, [0.07, 0.04, 0.62], [0, 0.0, -1.34], energy, "energy-channel");
  strip(muzzleAssembly, [0.12, 0.012, 0.36], [0, 0.205, -1.02], dark); // top seam

  const muzzleGlow = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 28), energySoft);
  muzzleGlow.position.set(0, 0.0, -1.7);
  muzzleGlow.name = "muzzle-glow";
  muzzleAssembly.add(muzzleGlow);

  // ── Brand marks (both flanks) ────────────────────────────────────────────
  const wordmark = decalTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#39414a";
    ctx.font = "500 40px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const letters = "TRAVERSAL".split("");
    const spacing = w / (letters.length + 1);
    letters.forEach((letter, i) => ctx.fillText(letter, spacing * (i + 1), h / 2));
  }, 512, 64);
  const emblem = decalTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#39414a";
    ctx.lineWidth = w * 0.09;
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.2);
    ctx.lineTo(w * 0.88, h * 0.2);
    ctx.lineTo(w * 0.5, h * 0.86);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "#39414a";
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.2);
    ctx.lineTo(w * 0.62, h * 0.2);
    ctx.lineTo(w * 0.5, h * 0.62);
    ctx.closePath();
    ctx.fill();
  }, 128, 128);
  [-1, 1].forEach((side) => {
    const s = side as 1 | -1;
    addDecal(recoilPivot, wordmark, [0.26, 0.0325], [s * 0.158, 0.13, 0.46], s, `wordmark-${side}`);
    addDecal(recoilPivot, emblem, [0.075, 0.075], [s * 0.128, 0.075, 0.93], s, `emblem-${side}`);
  });

  const muzzleSocket = new THREE.Object3D();
  muzzleSocket.name = "muzzle-socket";
  muzzleSocket.position.set(0, 0, -1.76);
  recoilPivot.add(muzzleSocket);

  root.userData.warpRifleMaterials = { energy, energySoft };
  root.userData.warpRifleParts = { recoilPivot, coreAnchor, corePivot, ringSegments, muzzleAssembly, muzzleSocket };
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

  if (parts?.corePivot) parts.corePivot.rotation.z += dt * (state.transiting ? 6 : preview ? 2.8 : 0.6);

  if (parts?.ringSegments) {
    // Halo drifts slowly and opens outward while a warp is primed.
    const spread = state.transiting ? 0.07 : preview ? 0.04 + Math.sin(time * 9) * 0.006 : state.anchorReady ? 0.012 : 0;
    parts.ringSegments.rotation.z = Math.sin(time * 0.7) * 0.03;
    parts.ringSegments.children.forEach((segment, index) => {
      const angle = segment.userData.baseAngle as number;
      const bob = Math.sin(time * 1.9 + index * 1.1) * 0.004;
      const target = spread + bob;
      const ease = 1 - Math.exp(-dt * 10);
      const current = (segment.userData.offset as number | undefined) ?? 0;
      const offset = current + (target - current) * ease;
      segment.userData.offset = offset;
      segment.position.set(Math.cos(angle) * offset, Math.sin(angle) * offset, 0);
    });
  }

  if (parts?.muzzleAssembly) parts.muzzleAssembly.position.y = Math.sin(time * 1.6) * 0.002;

  if (materials?.energy) {
    materials.energy.emissiveIntensity = state.transiting
      ? 7
      : preview
        ? 4.6 + Math.sin(time * 10) * 0.8
        : state.anchorReady
          ? 3.4 + Math.sin(time * 4.4) * 0.25
          : 2.6;
  }
  if (materials?.energySoft) {
    materials.energySoft.opacity = state.transiting ? 1 : preview ? 0.95 : state.anchorReady ? 0.78 : 0.6;
  }
}
