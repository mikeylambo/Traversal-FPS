import * as THREE from "three";
import {
  emitTraversalAudio,
  emitTraversalAudioAt,
  preloadTraversalAudioEvents,
  type TraversalAudioEvent
} from "../audio/TraversalAudio";
import { flashScale, hazardCue, onAccessibilityChange } from "./TraversalAccessibility";
import { ROOMS, type HazardKind, type HazardSpec, type PuzzleEffect } from "../world/stages";
import { installMovingPlatformRuntime } from "./MovingPlatformRuntime";

type ActiveHazard = {
  spec: HazardSpec;
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  base: THREE.Vector3;
  edges: THREE.LineSegments;
  /** Non-colour identity: chevrons on a sweep, hatching on a lethal field. */
  shapeCue?: THREE.LineSegments;
  disabled: boolean;
  apertureOffset: number;
  apertureFrame?: THREE.Object3D;
  active: boolean;
  /** Previous frame's state, so cycle edges can be sounded exactly once. */
  wasActive: boolean;
  /** Sign of the drift velocity, so a sweep sounds at each end of its travel. */
  driftSign: number;
  soundedAt: number;
};

/** Deferred cues a room only needs if it actually contains the hazard. */
const HAZARD_CUES: Record<HazardKind, TraversalAudioEvent[]> = {
  "sweep": ["hazard.sweep"],
  "lethal-field": ["hazard.field-on", "hazard.field-off"],
  "sightline-gate": ["hazard.gate-open", "hazard.gate-close"],
  "aperture-wall": ["hazard.aperture-shift"]
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
        hazard.active = false;
        hazard.mesh.visible = false;
        hazard.mesh.layers.set(1);
      }
    }

    if (effect.type === "shift-aperture") {
      for (const hazard of hazards) {
        if (!effect.targetIds.includes(hazard.spec.id)) continue;
        hazard.apertureOffset = effect.offset;
        syncApertureFrame(hazard);
        emitTraversalAudioAt("hazard.aperture-shift", hazard.mesh.position);
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

    // Hazard audio is fetched with the room that needs it, not at boot.
    const cues = [...new Set((room?.hazards ?? []).flatMap((spec) => HAZARD_CUES[spec.kind]))];
    if (cues.length > 0) void preloadTraversalAudioEvents(cues);
  };

  // A live Settings change has to reach hazards already in the room; they are the
  // objects the colour profile and flash cap exist for.
  onAccessibilityChange(() => {
    for (const hazard of hazards) applyHazardPalette(hazard);
  });

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
      hazard.active &&
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
  const cue = hazardCue(spec.kind);
  const material = new THREE.MeshBasicMaterial({
    color: cue.fill,
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
      color: cue.edge,
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

  // Priority 3: every hazard carries a non-colour signature as well as a hue, the
  // same way utility actors already carry a ring geometry as well as a colour.
  const shapeCue = createShapeCue(spec);
  if (shapeCue) mesh.add(shapeCue);

  root.add(mesh);
  return {
    spec,
    mesh,
    base: mesh.position.clone(),
    edges,
    shapeCue: shapeCue ?? undefined,
    disabled: false,
    apertureOffset: 0,
    apertureFrame,
    active: true,
    wasActive: true,
    driftSign: 0,
    soundedAt: 0
  };
}

function applyHazardPalette(hazard: ActiveHazard): void {
  const cue = hazardCue(hazard.spec.kind);
  hazard.mesh.material.color.setHex(cue.fill);
  (hazard.edges.material as THREE.LineBasicMaterial).color.setHex(cue.edge);
}

/**
 * The two axes a flat hazard reads across, largest first. Hazards are box slabs, so
 * the smallest extent is the face normal and the other two carry any pattern.
 */
function majorAxes(size: readonly [number, number, number]): ["x" | "y" | "z", "x" | "y" | "z", "x" | "y" | "z"] {
  const order = (["x", "y", "z"] as const)
    .map((axis, index) => ({ axis, extent: size[index]! }))
    .sort((a, b) => b.extent - a.extent);
  return [order[0]!.axis, order[1]!.axis, order[2]!.axis];
}

function axisIndex(axis: "x" | "y" | "z"): 0 | 1 | 2 {
  return axis === "x" ? 0 : axis === "y" ? 1 : 2;
}

/**
 * Sweeps get chevrons pointing along their travel; lethal fields get diagonal
 * hatching. Both are high-luminance and hue-independent, so the two hazards stay
 * tellable apart in greyscale, in any colour profile, and at any flash cap.
 */
function createShapeCue(spec: HazardSpec): THREE.LineSegments | null {
  if (spec.kind !== "sweep" && spec.kind !== "lethal-field") return null;

  const [majorAxis, minorAxis, normalAxis] = majorAxes(spec.size);
  const major = spec.size[axisIndex(majorAxis)]!;
  const minor = spec.size[axisIndex(minorAxis)]!;
  const normalOffset = spec.size[axisIndex(normalAxis)]! * 0.52;
  const vertices: number[] = [];

  const push = (aStart: number, bStart: number, aEnd: number, bEnd: number, side: number) => {
    for (const point of [[aStart, bStart], [aEnd, bEnd]]) {
      const vertex: [number, number, number] = [0, 0, 0];
      vertex[axisIndex(majorAxis)] = point[0]!;
      vertex[axisIndex(minorAxis)] = point[1]!;
      vertex[axisIndex(normalAxis)] = side * normalOffset;
      vertices.push(...vertex);
    }
  };

  if (spec.kind === "sweep") {
    // Chevrons: ">>>" repeated along the blade, pointing the way it travels.
    const count = Math.max(2, Math.min(7, Math.round(major / 1.6)));
    const step = major / (count + 1);
    const wing = Math.min(step * 0.42, minor * 0.3);
    for (let i = 1; i <= count; i += 1) {
      const centre = -major * 0.5 + step * i;
      for (const side of [-1, 1]) {
        push(centre - wing, -wing, centre, 0, side);
        push(centre, 0, centre - wing, wing, side);
      }
    }
  } else {
    // Hatching: slow diagonal bars, visually the opposite of a chevron.
    const count = Math.max(3, Math.min(10, Math.round(major / 1.3)));
    const step = major / count;
    for (let i = 0; i <= count; i += 1) {
      const start = -major * 0.5 + step * i;
      for (const side of [-1, 1]) {
        push(start, -minor * 0.42, start + minor * 0.84, minor * 0.42, side);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
}

function createApertureFrame(spec: HazardSpec): THREE.Object3D {
  const aperture = spec.aperture!;
  const group = new THREE.Group();
  const width = aperture.axis === "x" ? aperture.span : apertureSecondarySpan(spec);
  const height = aperture.axis === "y" ? aperture.span : apertureSecondarySpan(spec);
  const depth = Math.max(0.08, spec.size[2] * 1.35);

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
  if (!spec.aperture) return 6.2;
  // Apertures are judged against the player's body path, which sits below camera
  // height. Keep the rendered void and collision-safe void identical, with enough
  // vertical clearance that a visually centered warp cannot clip an invisible rim.
  return spec.aperture.axis === "x"
    ? Math.min(spec.size[1] * 0.62, 6.2)
    : Math.min(spec.size[0] * 0.5, 6.2);
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

function cycleIsOpen(cycle: NonNullable<HazardSpec["cycle"]>, time: number): boolean {
  const period = Math.max(0.25, cycle.period);
  const phase = ((time + (cycle.phase ?? 0)) % period + period) % period;
  return phase < Math.min(period, Math.max(0.05, cycle.openFor));
}

function updateHazards(hazards: ActiveHazard[], time: number): void {
  // Reduce Flash caps how far a warning pulse may swing. The pulse stays — it is
  // the rate, not the depth, that identifies the hazard — it just stops strobing.
  const flash = flashScale();

  for (const hazard of hazards) {
    if (hazard.disabled) {
      hazard.active = false;
      hazard.wasActive = false;
      hazard.mesh.visible = false;
      hazard.mesh.layers.set(1);
      continue;
    }

    hazard.mesh.position.copy(hazard.base);
    const drift = hazard.spec.drift;
    if (drift) {
      const phase = time * drift.speed * Math.PI * 2 + (drift.phase ?? 0);
      hazard.mesh.position[drift.axis] += Math.sin(phase) * drift.amplitude;
      soundSweepTravel(hazard, Math.cos(phase), time);
    }

    const cue = hazardCue(hazard.spec.kind);

    if (hazard.spec.kind === "sightline-gate") {
      const cycle = hazard.spec.cycle ?? { period: 2.4, openFor: 0.85, phase: 0 };
      const open = cycleIsOpen(cycle, time);
      hazard.active = !open;
      hazard.mesh.visible = !open;
      hazard.mesh.layers.set(open ? 1 : 0);
      hazard.mesh.material.opacity = 0.42 + Math.sin(time * cue.pulseRate) * 0.06 * flash;
      soundCycleEdge(hazard, "hazard.gate-close", "hazard.gate-open");
      continue;
    }

    if (hazard.spec.kind === "lethal-field" && hazard.spec.cycle) {
      const safeWindow = cycleIsOpen(hazard.spec.cycle, time);
      hazard.active = !safeWindow;
      hazard.mesh.visible = !safeWindow;
      hazard.mesh.layers.set(safeWindow ? 1 : 0);
      soundCycleEdge(hazard, "hazard.field-on", "hazard.field-off");
      if (safeWindow) continue;
    } else {
      hazard.active = true;
      hazard.wasActive = true;
      hazard.mesh.visible = true;
      hazard.mesh.layers.set(0);
    }

    const depth = 0.22 * flash;
    const pulse = (1 - depth) + Math.sin(time * cue.pulseRate + hazard.base.z * 0.13) * depth;
    hazard.mesh.material.opacity = hazard.spec.kind === "aperture-wall"
      ? 0.1 + pulse * 0.045
      : (hazard.spec.kind === "sweep" ? 0.28 : 0.12) * pulse;
    const lineMaterial = hazard.edges.material as THREE.LineBasicMaterial;
    lineMaterial.opacity = hazard.spec.kind === "aperture-wall"
      ? 0.72 + pulse * 0.18
      : (hazard.spec.kind === "sweep" ? 0.78 : 0.48) + pulse * 0.16;
    if (hazard.shapeCue) {
      (hazard.shapeCue.material as THREE.LineBasicMaterial).opacity = 0.46 + pulse * 0.22;
    }
  }
}

/**
 * Sounds a hazard the moment its cycle flips, panned to the hazard itself. This is
 * the second information channel the timing puzzles are built around: the rhythm
 * and rough bearing of a cycle should be readable without looking at it.
 */
function soundCycleEdge(
  hazard: ActiveHazard,
  onActive: TraversalAudioEvent,
  onClear: TraversalAudioEvent
): void {
  if (hazard.active === hazard.wasActive) return;
  hazard.wasActive = hazard.active;
  emitTraversalAudioAt(hazard.active ? onActive : onClear, hazard.mesh.position);
}

/** A sweep sounds at each end of its travel, which is where its rhythm is legible. */
function soundSweepTravel(hazard: ActiveHazard, velocity: number, time: number): void {
  if (hazard.spec.kind !== "sweep") return;
  const sign = velocity >= 0 ? 1 : -1;
  const previous = hazard.driftSign;
  hazard.driftSign = sign;
  if (previous === 0 || previous === sign) return;
  if (time - hazard.soundedAt < 0.25) return;
  hazard.soundedAt = time;
  emitTraversalAudioAt("hazard.sweep", hazard.mesh.position);
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