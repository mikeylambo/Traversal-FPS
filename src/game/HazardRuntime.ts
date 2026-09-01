import * as THREE from "three";
import { emitTraversalAudio } from "../audio/TraversalAudio";
import { ROOMS, type HazardSpec, type PuzzleEffect } from "../world/stages";
import { installMovingPlatformRuntime } from "./MovingPlatformRuntime";

type ActiveHazard = {
  spec: HazardSpec;
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  base: THREE.Vector3;
  edges: THREE.LineSegments;
  disabled: boolean;
  apertureOffset: number;
  apertureFrame?: THREE.Object3D;
};

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  roomRoot: THREE.Group;
  platformMeshes: THREE.Mesh[];
  roomIndex: number;
  roomRestarts: number;
  runComplete: boolean;
  loadRoom: (index: number) => void;
  update: (dt: number) => void;
};

type PuzzleActorEvent = CustomEvent<{
  effect?: PuzzleEffect;
}>;

/**
 * World reactivity stays separate from player verbs: hazards can gate, threaten,
 * and intersect a warp, but they never transport the player. Puzzle machinery can
 * alter hazard state through declarative actor effects.
 */
export function installHazardRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  let hazards: ActiveHazard[] = [];
  let hitCooldownUntil = 0;

  window.addEventListener("traversal:puzzle-actor", ((event: Event) => {
    const effect = (event as PuzzleActorEvent).detail?.effect;
    if (!effect) return;

    if (effect.type === "disable-hazard") {
      for (const hazard of hazards) {
        if (!effect.targetIds.includes(hazard.spec.id)) continue;
        hazard.disabled = true;
        hazard.mesh.visible = false;
        hazard.mesh.layers.set(1);
      }
    }

    if (effect.type === "shift-aperture") {
      for (const hazard of hazards) {
        if (!effect.targetIds.includes(hazard.spec.id)) continue;
        hazard.apertureOffset = effect.offset;
        syncApertureFrame(hazard);
      }
    }
  }) as EventListener);

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    hazards = [];
    originalLoadRoom(index);
    const room = ROOMS[index];
    for (const spec of room?.hazards ?? []) {
      const hazard = createHazard(state.roomRoot, spec);
      hazards.push(hazard);
      if (spec.kind === "sightline-gate") state.platformMeshes.push(hazard.mesh);
    }
  };

  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    const now = performance.now();
    const before = state.camera.position.clone();
    updateHazards(hazards, now * 0.001);
    originalUpdate(dt);

    if (
      state.runComplete ||
      now < hitCooldownUntil ||
      document.body.classList.contains("traversal-editor-open")
    ) return;

    const after = state.camera.position.clone();
    const hit = hazards.some((hazard) =>
      !hazard.disabled &&
      hazard.spec.kind !== "sightline-gate" &&
      intersectsPlayerPath(before, after, hazard)
    );
    if (!hit) return;

    hitCooldownUntil = now + 650;
    emitTraversalAudio("hazard.hit");
    document.body.classList.add("hazard-hit");
    window.setTimeout(() => document.body.classList.remove("hazard-hit"), 280);
    state.roomRestarts += 1;
    state.loadRoom(state.roomIndex);
  };

  installMovingPlatformRuntime(game);
}

function createHazard(root: THREE.Group, spec: HazardSpec): ActiveHazard {
  const sweep = spec.kind === "sweep";
  const gate = spec.kind === "sightline-gate";
  const aperture = spec.kind === "aperture-wall";
  const color = gate ? 0x73e7ff : aperture ? 0xff7895 : sweep ? 0xff5f7a : 0xff9a5d;
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: aperture ? 0.13 : gate ? 0.5 : sweep ? 0.32 : 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...spec.size), material);
  mesh.position.set(...spec.center);
  mesh.userData.traversalHazard = spec.kind;
  mesh.userData.traversalHazardId = spec.id;

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({
      color: gate ? 0xd7fbff : aperture ? 0xffd7df : sweep ? 0xffd0d8 : 0xffb476,
      transparent: true,
      opacity: gate ? 0.9 : sweep ? 0.92 : aperture ? 0.82 : 0.62,
      blending: THREE.AdditiveBlending
    })
  );
  mesh.add(edges);

  if (sweep) {
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(0.08, spec.size[0] * 0.18),
        spec.size[1] * 1.02,
        spec.size[2] * 1.02
      ),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    mesh.add(core);
  }

  if (gate) {
    const bars = 5;
    for (let i = 0; i < bars; i += 1) {
      const y = -spec.size[1] * 0.4 + (i / Math.max(1, bars - 1)) * spec.size[1] * 0.8;
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(spec.size[0] * 1.01, 0.035, spec.size[2] * 1.03),
        new THREE.MeshBasicMaterial({
          color: 0xe9ffff,
          transparent: true,
          opacity: 0.48,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      bar.position.y = y;
      mesh.add(bar);
    }
  }

  let apertureFrame: THREE.Object3D | undefined;
  if (aperture && spec.aperture) {
    apertureFrame = createApertureFrame(spec);
    mesh.add(apertureFrame);
  }

  root.add(mesh);
  return {
    spec,
    mesh,
    base: mesh.position.clone(),
    edges,
    disabled: false,
    apertureOffset: 0,
    apertureFrame
  };
}

function createApertureFrame(spec: HazardSpec): THREE.Object3D {
  const aperture = spec.aperture!;
  const group = new THREE.Group();
  const width = aperture.axis === "x" ? aperture.span : apertureSecondarySpan(spec);
  const height = aperture.axis === "y" ? aperture.span : apertureSecondarySpan(spec);
  const depth = Math.max(0.08, spec.size[2] * 1.35);

  // The safe region must visually read as absence, not merely another colored
  // rectangle painted over a lethal plane. This mask occludes the hazard fill while
  // the bright frame communicates the exact collision-safe bounds.
  const voidPanel = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.96, height * 0.96, depth * 1.02),
    new THREE.MeshBasicMaterial({
      color: 0x0b1420,
      transparent: true,
      opacity: 0.96,
      depthTest: false,
      depthWrite: false
    })
  );
  voidPanel.renderOrder = 20;
  group.add(voidPanel);

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthTest: false,
      blending: THREE.AdditiveBlending
    })
  );
  frame.renderOrder = 21;
  group.add(frame);

  group.userData.apertureAxis = aperture.axis;
  group.userData.apertureCenter = aperture.center;
  setApertureFramePosition(group, aperture.axis, aperture.center);
  return group;
}

function apertureSecondarySpan(spec: HazardSpec): number {
  if (!spec.aperture) return 4.8;
  return spec.aperture.axis === "x"
    ? Math.min(spec.size[1] * 0.5, 4.8)
    : Math.min(spec.size[0] * 0.42, 4.8);
}

function syncApertureFrame(hazard: ActiveHazard): void {
  if (!hazard.apertureFrame || !hazard.spec.aperture) return;
  const aperture = hazard.spec.aperture;
  setApertureFramePosition(
    hazard.apertureFrame,
    aperture.axis,
    aperture.center + hazard.apertureOffset
  );
}

function setApertureFramePosition(
  frame: THREE.Object3D,
  axis: "x" | "y",
  value: number
): void {
  frame.position.set(0, 0, 0);
  frame.position[axis] = value;
}

function updateHazards(hazards: ActiveHazard[], time: number): void {
  for (const hazard of hazards) {
    if (hazard.disabled) {
      hazard.mesh.visible = false;
      hazard.mesh.layers.set(1);
      continue;
    }

    hazard.mesh.position.copy(hazard.base);
    const drift = hazard.spec.drift;
    if (drift) {
      const offset = Math.sin(time * drift.speed * Math.PI * 2 + (drift.phase ?? 0)) * drift.amplitude;
      hazard.mesh.position[drift.axis] += offset;
    }

    if (hazard.spec.kind === "sightline-gate") {
      const cycle = hazard.spec.cycle ?? { period: 2.4, openFor: 0.85, phase: 0 };
      const period = Math.max(0.25, cycle.period);
      const phase = ((time + (cycle.phase ?? 0)) % period + period) % period;
      const open = phase < Math.min(period, Math.max(0.05, cycle.openFor));
      hazard.mesh.visible = !open;
      hazard.mesh.layers.set(open ? 1 : 0);
      hazard.mesh.material.opacity = 0.42 + Math.sin(time * 8) * 0.06;
      continue;
    }

    hazard.mesh.visible = true;
    hazard.mesh.layers.set(0);
    const pulse = 0.78 + Math.sin(time * 7.5 + hazard.base.z * 0.13) * 0.22;
    hazard.mesh.material.opacity = hazard.spec.kind === "aperture-wall"
      ? 0.1 + pulse * 0.045
      : (hazard.spec.kind === "sweep" ? 0.28 : 0.12) * pulse;
    const lineMaterial = hazard.edges.material as THREE.LineBasicMaterial;
    lineMaterial.opacity = hazard.spec.kind === "aperture-wall"
      ? 0.72 + pulse * 0.18
      : (hazard.spec.kind === "sweep" ? 0.78 : 0.48) + pulse * 0.16;
  }
}

function intersectsPlayerPath(from: THREE.Vector3, to: THREE.Vector3, hazard: ActiveHazard): boolean {
  const half = new THREE.Vector3(
    hazard.spec.size[0] * 0.5 + 0.34,
    hazard.spec.size[1] * 0.5 + 0.82,
    hazard.spec.size[2] * 0.5 + 0.34
  );
  const center = hazard.mesh.position;
  const min = center.clone().sub(half);
  const max = center.clone().add(half);

  const playerFrom = from.clone().add(new THREE.Vector3(0, -0.72, 0));
  const playerTo = to.clone().add(new THREE.Vector3(0, -0.72, 0));

  if (hazard.spec.kind === "aperture-wall" && hazard.spec.aperture) {
    const crossing = wallCrossingPoint(playerFrom, playerTo, center, hazard.spec.size);
    if (crossing) {
      const aperture = hazard.spec.aperture;
      const primaryLocal = crossing[aperture.axis] - center[aperture.axis];
      const safeCenter = aperture.center + hazard.apertureOffset;
      const primarySafe = Math.abs(primaryLocal - safeCenter) <= aperture.span * 0.5;
      const secondaryAxis = aperture.axis === "x" ? "y" : "x";
      const secondaryLocal = crossing[secondaryAxis] - center[secondaryAxis];
      const secondarySafe = Math.abs(secondaryLocal) <= apertureSecondarySpan(hazard.spec) * 0.5;
      if (primarySafe && secondarySafe) return false;
    }
  }

  return segmentIntersectsAabb(playerFrom, playerTo, min, max);
}

function wallCrossingPoint(
  start: THREE.Vector3,
  end: THREE.Vector3,
  center: THREE.Vector3,
  size: readonly [number, number, number]
): THREE.Vector3 | null {
  const thinAxis = size[0] <= size[1] && size[0] <= size[2]
    ? "x"
    : size[1] <= size[2]
      ? "y"
      : "z";
  const delta = end[thinAxis] - start[thinAxis];
  if (Math.abs(delta) < 1e-6) return null;
  const t = (center[thinAxis] - start[thinAxis]) / delta;
  if (t < 0 || t > 1) return null;
  return start.clone().lerp(end, t);
}

function segmentIntersectsAabb(
  start: THREE.Vector3,
  end: THREE.Vector3,
  min: THREE.Vector3,
  max: THREE.Vector3
): boolean {
  const direction = end.clone().sub(start);
  let tMin = 0;
  let tMax = 1;

  for (const axis of ["x", "y", "z"] as const) {
    const origin = start[axis];
    const delta = direction[axis];
    if (Math.abs(delta) < 1e-7) {
      if (origin < min[axis] || origin > max[axis]) return false;
      continue;
    }

    let a = (min[axis] - origin) / delta;
    let b = (max[axis] - origin) / delta;
    if (a > b) [a, b] = [b, a];
    tMin = Math.max(tMin, a);
    tMax = Math.min(tMax, b);
    if (tMin > tMax) return false;
  }

  return true;
}
