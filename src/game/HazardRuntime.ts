import * as THREE from "three";
import { ROOMS, type HazardSpec } from "../world/stages";

type ActiveHazard = {
  spec: HazardSpec;
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  base: THREE.Vector3;
  edges: THREE.LineSegments;
};

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  roomRoot: THREE.Group;
  roomIndex: number;
  roomRestarts: number;
  runComplete: boolean;
  loadRoom: (index: number) => void;
  update: (dt: number) => void;
};

/**
 * World reactivity stays separate from player verbs: hazards can gate, threaten, and
 * intersect a warp, but they never transport the player.
 */
export function installHazardRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  let hazards: ActiveHazard[] = [];
  let hitCooldownUntil = 0;

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    hazards = [];
    originalLoadRoom(index);
    const room = ROOMS[index];
    for (const spec of room?.hazards ?? []) hazards.push(createHazard(state.roomRoot, spec));
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
    const hit = hazards.some((hazard) => intersectsPlayerPath(before, after, hazard));
    if (!hit) return;

    hitCooldownUntil = now + 650;
    document.body.classList.add("hazard-hit");
    window.setTimeout(() => document.body.classList.remove("hazard-hit"), 280);
    state.roomRestarts += 1;
    state.loadRoom(state.roomIndex);
  };
}

function createHazard(root: THREE.Group, spec: HazardSpec): ActiveHazard {
  const sweep = spec.kind === "sweep";
  const color = sweep ? 0xff5f7a : 0xff9a5d;
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: sweep ? 0.32 : 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...spec.size), material);
  mesh.position.set(...spec.center);
  mesh.userData.traversalHazard = spec.kind;

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({
      color: sweep ? 0xffd0d8 : 0xffb476,
      transparent: true,
      opacity: sweep ? 0.92 : 0.62,
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

  root.add(mesh);
  return { spec, mesh, base: mesh.position.clone(), edges };
}

function updateHazards(hazards: ActiveHazard[], time: number): void {
  for (const hazard of hazards) {
    hazard.mesh.position.copy(hazard.base);
    const drift = hazard.spec.drift;
    if (drift) {
      const offset = Math.sin(time * drift.speed * Math.PI * 2 + (drift.phase ?? 0)) * drift.amplitude;
      hazard.mesh.position[drift.axis] += offset;
    }
    const pulse = 0.78 + Math.sin(time * 7.5 + hazard.base.z * 0.13) * 0.22;
    hazard.mesh.material.opacity = (hazard.spec.kind === "sweep" ? 0.28 : 0.12) * pulse;
    const lineMaterial = hazard.edges.material as THREE.LineBasicMaterial;
    lineMaterial.opacity = (hazard.spec.kind === "sweep" ? 0.78 : 0.48) + pulse * 0.16;
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
  return segmentIntersectsAabb(playerFrom, playerTo, min, max);
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
