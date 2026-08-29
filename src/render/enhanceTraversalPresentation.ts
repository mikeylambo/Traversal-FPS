import * as THREE from "three";
import type { TraversalSettingsStore } from "../game/TraversalSettings";
import { ROOMS, type EnemySpec, type PlatformSpec } from "../world/stages";
import { VectorRendering } from "./VectorRendering";
import { VisualLab } from "./VisualLab";
import { TwinklingStarfield } from "./TwinklingStarfield";
import { TargetResolveFx } from "./TargetResolveFx";

const ROOM_ACCENTS = [0x69e7ff, 0xffcf66, 0xff78c8, 0xff9d67, 0xa1ff91];

type RuntimeState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clock: THREE.Clock;
  roomRoot: THREE.Group;
  platformMeshes: THREE.Mesh[];
  enemies: Array<{ spec: EnemySpec; mesh: THREE.Mesh; base: THREE.Vector3; alive: boolean }>;
  roomIndex: number;
  weapon: { vectorWritten(): void };
  input: {
    consumePause(): boolean;
    consumeWarpFraction(): number | null;
  };
  warp: {
    setSelectionFraction(value: number): void;
    hasAnchor(): boolean;
    selectionPercent(): number;
    write(origin: THREE.Vector3, target: THREE.Vector3): void;
  };
  flow: { showPause(): void };
  frame: () => void;
  update: (dt: number) => void;
  loadRoom: (index: number) => void;
  addPlatform: (spec: PlatformSpec) => void;
  addEnemy: (spec: EnemySpec) => void;
  addKillFx: (position: THREE.Vector3, kind: EnemySpec["kind"]) => void;
  updateHUD: () => void;
  syncPhase: (phase: string) => void;
};

export function enhanceTraversalPresentation(game: object, settings: TraversalSettingsStore): void {
  const state = game as unknown as RuntimeState;
  const rendering = new VectorRendering(state.renderer, state.scene, state.camera);
  const visualLab = new VisualLab(settings);
  const targetResolve = new TargetResolveFx(state.scene);
  const touchCapable = navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;
  const starfield = new TwinklingStarfield(state.scene, state.camera, touchCapable ? 850 : 1300);

  state.scene.background = new THREE.Color(0x020812);
  if (state.scene.fog instanceof THREE.FogExp2) state.scene.fog.color.setHex(0x04111d);

  if (touchCapable) state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
  rendering.resize(window.innerWidth, window.innerHeight);
  window.addEventListener("resize", () => rendering.resize(window.innerWidth, window.innerHeight));

  state.addPlatform = (spec: PlatformSpec) => {
    const accent = ROOM_ACCENTS[state.roomIndex % ROOM_ACCENTS.length]!;
    const roomFocus = state.roomIndex === 0 ? 1 : 0.76;
    const base = state.roomIndex === 0 ? 0x1d3650 : 0x20374d;
    const material = rendering.createSurfaceMaterial(base, accent, roomFocus);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...spec.size), material);
    mesh.position.set(...spec.center);
    state.roomRoot.add(mesh);
    state.platformMeshes.push(mesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({
        color: accent,
        transparent: true,
        opacity: state.roomIndex === 0 ? 0.82 : 0.64,
        blending: THREE.AdditiveBlending
      })
    );
    edges.position.copy(mesh.position);
    state.roomRoot.add(edges);

    const topRailMaterial = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: state.roomIndex === 0 ? 0.72 : 0.44,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const railLength = Math.max(0.1, spec.size[2] - 0.7);
    if (spec.size[0] > 1.2 && railLength > 0.4) {
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, railLength), topRailMaterial.clone());
        rail.position.set(
          spec.center[0] + side * (spec.size[0] * 0.5 - 0.32),
          spec.center[1] + spec.size[1] * 0.5 + 0.018,
          spec.center[2]
        );
        state.roomRoot.add(rail);
      }
    }
  };

  state.addEnemy = (spec: EnemySpec) => {
    const color = spec.kind === "shield"
      ? 0xffad66
      : spec.kind === "drifter"
        ? 0xff78c8
        : 0x7cefff;
    const radius = spec.radius ?? 0.72;
    const material = rendering.createNodeMaterial(color);
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 3), material);
    mesh.position.set(...spec.position);

    const shellMaterial = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.2, 1), shellMaterial);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.38, 0.018, 6, 48), ringMaterial);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.52, 0.012, 6, 48), ringMaterial.clone());
    ringA.rotation.x = Math.PI * 0.5;
    ringA.rotation.z = 0.4;
    ringB.rotation.y = Math.PI * 0.5;
    ringB.rotation.x = 0.62;

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(radius * 0.31, 0),
      new THREE.MeshBasicMaterial({
        color: 0xf4ffff,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    const light = new THREE.PointLight(color, state.roomIndex === 0 ? 3.4 : 2.5, 7, 2);

    mesh.add(shell, ringA, ringB, core, light);
    state.roomRoot.add(mesh);
    state.enemies.push({ spec, mesh, base: mesh.position.clone(), alive: true });
  };

  // Replace the old generic burst with a readable matter -> coordinate resolve.
  state.addKillFx = (position: THREE.Vector3, kind: EnemySpec["kind"]) => {
    targetResolve.resolve(position, kind);
  };

  // The live WarpSystem still owns gameplay geometry. This brighter pass makes the
  // creation event visible, then hands off to the persistent selectable vector.
  const originalWarpWrite = state.warp.write.bind(state.warp);
  state.warp.write = (origin: THREE.Vector3, target: THREE.Vector3) => {
    targetResolve.write(origin, target);
    state.weapon.vectorWritten();
    originalWarpWrite(origin, target);
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    targetResolve.clear();
    disposeRoomObjects(state.roomRoot, rendering);
    originalLoadRoom(index);
    addRoomEnvironment(state, rendering, index);
  };

  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    if (state.input.consumePause()) {
      state.flow.showPause();
      return;
    }
    const fraction = state.input.consumeWarpFraction();
    if (fraction !== null) state.warp.setSelectionFraction(fraction);
    originalUpdate(dt);

    const range = document.getElementById("mobile-range") as HTMLInputElement | null;
    if (range && state.warp.hasAnchor()) range.value = String(state.warp.selectionPercent());
  };

  const originalHUD = state.updateHUD.bind(game);
  state.updateHUD = () => {
    originalHUD();
    if (!touchCapable) return;
    const warpHint = document.getElementById("warp-hint");
    if (warpHint) warpHint.textContent = "HOLD WARP // SET RANGE // RELEASE TO COMMIT";
  };

  const originalSyncPhase = state.syncPhase.bind(game);
  state.syncPhase = (phase: string) => {
    if (phase !== "playing") visualLab.close();
    originalSyncPhase(phase);
  };

  let lastPresentationTime = performance.now();
  const originalFrame = state.frame.bind(game);
  state.frame = () => {
    const now = performance.now();
    const dt = Math.min((now - lastPresentationTime) / 1000, 0.05);
    lastPresentationTime = now;

    const rendererAny = state.renderer as unknown as { render: (...args: unknown[]) => void };
    const nativeRender = rendererAny.render;
    rendererAny.render = () => undefined;
    try {
      originalFrame();
    } finally {
      rendererAny.render = nativeRender;
    }

    targetResolve.update(dt);
    starfield.update(dt, settings.value.visual.starTwinkle);
    rendering.update(dt, settings.value.visual);
    rendering.render();
  };
}

function disposeRoomObjects(root: THREE.Group, rendering: VectorRendering): void {
  root.traverse((object) => {
    const drawable = object as THREE.Mesh | THREE.LineSegments | THREE.Points;
    const geometry = drawable.geometry as THREE.BufferGeometry | undefined;
    geometry?.dispose?.();
    const material = drawable.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    for (const item of materials) {
      rendering.markDisposed(item);
      item.dispose();
    }
  });
  rendering.clearDisposableMaterials();
}

function addRoomEnvironment(state: RuntimeState, rendering: VectorRendering, index: number): void {
  const room = ROOMS[index]!;
  const accent = ROOM_ACCENTS[index % ROOM_ACCENTS.length]!;
  const focus = index === 0 ? 1 : 0.82;
  const zValues = [room.spawn[2], room.goal[2], ...room.platforms.map((item) => item.center[2]), ...room.enemies.map((item) => item.position[2])];
  const xValues = [room.spawn[0], room.goal[0], ...room.platforms.map((item) => item.center[0]), ...room.enemies.map((item) => item.position[0])];
  const minZ = Math.min(...zValues);
  const maxZ = Math.max(...zValues);
  const midZ = (minZ + maxZ) * 0.5;
  const outerX = Math.max(6.2, Math.max(...xValues.map((x) => Math.abs(x))) + 5.4);

  const structure = (size: [number, number, number], position: [number, number, number], base = 0x11283d) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), rendering.createSurfaceMaterial(base, accent, focus));
    mesh.position.set(...position);
    state.roomRoot.add(mesh);
    return mesh;
  };

  // Calibration gates establish scale and keep every puzzle visually authored.
  const gatePositions = index === 0 ? [maxZ + 1.5, midZ, minZ - 1.5] : [maxZ + 1.2, midZ, minZ - 1.2];
  gatePositions.forEach((z, gateIndex) => {
    const height = 6.2 + ((index + gateIndex) % 3) * 0.7;
    structure([0.28, height, 0.34], [-outerX, height * 0.5 - 0.5, z]);
    structure([0.28, height, 0.34], [outerX, height * 0.5 - 0.5, z]);
    structure([outerX * 2 + 0.28, 0.2, 0.34], [0, height - 0.5, z], 0x17324a);
  });

  const glow = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: index === 0 ? 0.7 : 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  // Distant coordinate monuments keep the void from feeling empty while preserving clean routes.
  for (let i = 0; i < 5; i += 1) {
    const z = THREE.MathUtils.lerp(maxZ + 4, minZ - 8, i / 4);
    const side = i % 2 === 0 ? -1 : 1;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2 + (i % 3) * 0.8, 0.024, 6, 72), glow.clone());
    ring.position.set(side * (outerX + 4 + (i % 2) * 2), 3.2 + (i % 3) * 2.1, z);
    ring.rotation.set(Math.PI * (0.15 + (i % 2) * 0.35), i * 0.37, i * 0.22);
    state.roomRoot.add(ring);

    const spine = structure([0.11, 5.5 + (i % 2) * 2.2, 0.16], [side * (outerX + 7.2), 2.2 + (i % 3), z - 3], 0x0e2134);
    spine.rotation.z = side * (0.08 + index * 0.012);
  }

  // Thin path-adjacent coordinate hoops make the traversal line feel embedded in a larger machine.
  const hoopCount = index === 0 ? 4 : 3;
  for (let i = 0; i < hoopCount; i += 1) {
    const z = THREE.MathUtils.lerp(maxZ - 2, minZ + 2, hoopCount === 1 ? 0.5 : i / (hoopCount - 1));
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(Math.min(5.2, outerX * 0.72), 0.022, 6, 72), glow.clone());
    hoop.position.set(0, 2.7 + (i % 2) * 0.55, z);
    hoop.rotation.x = Math.PI * 0.5;
    hoop.rotation.z = (index * 0.11 + i * 0.08);
    state.roomRoot.add(hoop);
  }

  // Exit gets a distant concentric echo so goals read as part of the same coordinate system.
  for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.15 + i * 0.32, 0.032 - i * 0.006, 6, 64), glow.clone());
    ring.position.set(room.goal[0], room.goal[1], room.goal[2] - 0.45 - i * 0.18);
    ring.rotation.z = i * 0.24;
    state.roomRoot.add(ring);
  }
}
