import * as THREE from "three";
import { emitTraversalAudioAt } from "../audio/TraversalAudio";
import { roomTime } from "./RoomClock";
import { ROOMS, type PlatformSpec } from "../world/stages";

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  platformMeshes: THREE.Mesh[];
  roomIndex: number;
  loadRoom(index: number): void;
  update(dt: number): void;
};

type Collapsing = {
  spec: PlatformSpec;
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  top: number;
  armedAt: number | null;
  leftAt: number | null;
  fallingAt: number | null;
  home: THREE.Vector3;
};

const WARNING = 0xffb46b;
const LEAVE_GRACE = 0.3;
const FALL_TIME = 0.7;
/** Collapsed floors park far above the room so collision, warps and the fall-reset floor all ignore them. */
const PARKED_Y = 100000;

/**
 * Collapsing floors turn a landing into a commitment. They wear amber edges
 * from the start (you always know which floors will not hold), pulse once you
 * are on them, and drop away on their timer or when you step off.
 */
export function installCollapseRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  let floors: Collapsing[] = [];

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    floors = [];
    ROOMS[index]?.platforms.forEach((spec, platformIndex) => {
      const mesh = state.platformMeshes[platformIndex];
      if (!spec.collapse || !mesh || spec.motion) return;
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(...spec.size)),
        new THREE.LineBasicMaterial({ color: WARNING, transparent: true, opacity: 0.8, depthWrite: false })
      );
      edges.scale.setScalar(1.004);
      mesh.add(edges);
      floors.push({
        spec, mesh, edges,
        top: spec.center[1] + spec.size[1] / 2,
        armedAt: null, leftAt: null, fallingAt: null,
        home: mesh.position.clone()
      });
    });
  };

  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    originalUpdate(dt);
    const t = roomTime();
    const p = state.camera.position;
    for (const floor of floors) {
      const [sx, , sz] = floor.spec.size;
      const standing = floor.fallingAt === null &&
        Math.abs(p.x - floor.home.x) <= sx / 2 + 0.2 &&
        Math.abs(p.z - floor.home.z) <= sz / 2 + 0.2 &&
        p.y - floor.top > 0.9 && p.y - floor.top < 1.85;

      if (standing && floor.armedAt === null) floor.armedAt = t;
      if (floor.armedAt !== null && floor.fallingAt === null) {
        floor.leftAt = standing ? null : floor.leftAt ?? t;
        const delay = floor.spec.collapse!.delay;
        const due = delay === "leave"
          ? floor.leftAt !== null && t - floor.leftAt >= LEAVE_GRACE
          : t - floor.armedAt >= delay;
        if (due) {
          floor.fallingAt = t;
          emitTraversalAudioAt("platform.lock", floor.home);
        }
      }

      const material = floor.edges.material as THREE.LineBasicMaterial;
      if (floor.fallingAt !== null) {
        const f = Math.min(1, (t - floor.fallingAt) / FALL_TIME);
        floor.mesh.position.set(floor.home.x, floor.home.y - f * f * 9, floor.home.z);
        floor.mesh.rotation.z = f * 0.18;
        material.opacity = 0.8 * (1 - f);
        if (f >= 1) {
          floor.mesh.visible = false;
          floor.mesh.position.y = PARKED_Y;
        }
      } else if (floor.armedAt !== null) {
        // Armed: the edge pulses faster as the timer runs out.
        const delay = floor.spec.collapse!.delay;
        const urgency = delay === "leave" ? 0.5 : Math.min(1, (t - floor.armedAt) / delay);
        material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(t * (6 + urgency * 14)));
        floor.mesh.position.set(floor.home.x + Math.sin(t * 40) * 0.015 * urgency, floor.home.y, floor.home.z);
      }
    }
  };
}
