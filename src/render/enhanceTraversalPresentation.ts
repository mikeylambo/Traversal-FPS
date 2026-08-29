import * as THREE from "three";
import type { TraversalSettingsStore } from "../game/TraversalSettings";
import type { EnemySpec, PlatformSpec } from "../world/stages";
import { VectorRendering } from "./VectorRendering";
import { VisualLab } from "./VisualLab";
import { TwinklingStarfield } from "./TwinklingStarfield";

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
  input: {
    consumePause(): boolean;
    consumeWarpFraction(): number | null;
  };
  warp: {
    setSelectionFraction(value: number): void;
    hasAnchor(): boolean;
    selectionPercent(): number;
  };
  flow: { showPause(): void };
  frame: () => void;
  update: (dt: number) => void;
  loadRoom: (index: number) => void;
  addPlatform: (spec: PlatformSpec) => void;
  addEnemy: (spec: EnemySpec) => void;
  updateHUD: () => void;
  syncPhase: (phase: string) => void;
};

export function enhanceTraversalPresentation(game: object, settings: TraversalSettingsStore): void {
  const state = game as unknown as RuntimeState;
  const rendering = new VectorRendering(state.renderer, state.scene, state.camera);
  const visualLab = new VisualLab(settings);
  const touchCapable = navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;
  const starfield = new TwinklingStarfield(state.scene, touchCapable ? 520 : 760);

  state.scene.background = new THREE.Color(0x020812);
  if (state.scene.fog instanceof THREE.FogExp2) state.scene.fog.color.setHex(0x04111d);

  if (touchCapable) state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
  rendering.resize(window.innerWidth, window.innerHeight);
  window.addEventListener("resize", () => rendering.resize(window.innerWidth, window.innerHeight));

  state.addPlatform = (spec: PlatformSpec) => {
    const accent = ROOM_ACCENTS[state.roomIndex % ROOM_ACCENTS.length]!;
    const roomFocus = state.roomIndex === 0 ? 1 : 0.32;
    const base = state.roomIndex === 0 ? 0x1d3650 : 0x26384f;
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
        opacity: state.roomIndex === 0 ? 0.82 : 0.54,
        blending: state.roomIndex === 0 ? THREE.AdditiveBlending : THREE.NormalBlending
      })
    );
    edges.position.copy(mesh.position);
    state.roomRoot.add(edges);

    if (state.roomIndex === 0) {
      const topRailMaterial = new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const railLength = Math.max(0.1, spec.size[2] - 0.7);
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
    const light = new THREE.PointLight(color, state.roomIndex === 0 ? 3.4 : 2.2, 7, 2);

    mesh.add(shell, ringA, ringB, core, light);
    state.roomRoot.add(mesh);
    state.enemies.push({ spec, mesh, base: mesh.position.clone(), alive: true });
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    disposeRoomObjects(state.roomRoot, rendering);
    originalLoadRoom(index);
    if (index === 0) addRoomOneLookdev(state, rendering);
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

function addRoomOneLookdev(state: RuntimeState, rendering: VectorRendering): void {
  const accent = ROOM_ACCENTS[0]!;
  const structure = (size: [number, number, number], position: [number, number, number], base = 0x11283d) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      rendering.createSurfaceMaterial(base, accent, 1)
    );
    mesh.position.set(...position);
    state.roomRoot.add(mesh);
    return mesh;
  };

  for (const zoneZ of [5, -22]) {
    structure([0.34, 7.2, 0.42], [-5.55, 3.05, zoneZ]);
    structure([0.34, 7.2, 0.42], [5.55, 3.05, zoneZ]);
    structure([11.45, 0.25, 0.42], [0, 6.52, zoneZ]);
    structure([8.4, 0.12, 0.26], [0, 4.25, zoneZ], 0x17324a);
  }

  const glow = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  for (const z of [-1, -7, -13, -19]) {
    const frame = new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.028, 6, 72), glow.clone());
    frame.position.set(0, 2.5, z);
    frame.rotation.x = Math.PI * 0.5;
    state.roomRoot.add(frame);
  }

  const gate = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.055, 8, 64), glow.clone());
  gate.position.set(0, 2.25, -24.2);
  state.roomRoot.add(gate);
}
