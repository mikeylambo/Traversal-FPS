import * as THREE from "three";
import { emitTraversalAudioAt, startTraversalAudioLoop, type TraversalAudioLoopHandle } from "../audio/TraversalAudio";

type RuntimeState = { platformMeshes: THREE.Mesh[]; update(dt: number): void };
type Track = { position: THREE.Vector3; loop: TraversalAudioLoopHandle | null; moving: boolean; quietFrames: number };

export function installPlatformMotionAudioRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  const originalUpdate = state.update.bind(game);
  const tracks = new Map<string, Track>();
  const world = new THREE.Vector3();

  state.update = (dt: number) => {
    originalUpdate(dt);
    const live = new Set<string>();
    const safeDt = Math.max(1 / 240, Math.min(0.1, dt || 1 / 60));

    for (const mesh of state.platformMeshes ?? []) {
      const id = mesh.uuid;
      live.add(id);
      mesh.getWorldPosition(world);
      let track = tracks.get(id);
      if (!track) {
        tracks.set(id, { position: world.clone(), loop: null, moving: false, quietFrames: 0 });
        continue;
      }

      const distance = track.position.distanceTo(world);
      const speed = distance / safeDt;
      track.position.copy(world);

      // Room rebuilds/teleports are not physical platform travel.
      if (distance > 2.5) {
        track.loop?.stop();
        track.loop = null;
        track.moving = false;
        track.quietFrames = 0;
        continue;
      }

      if (speed > 0.045) {
        track.quietFrames = 0;
        track.moving = true;
        if (!track.loop) track.loop = startTraversalAudioLoop("platform.travel", world);
        track.loop?.setPosition(world.x, world.y, world.z);
        track.loop?.setIntensity(Math.max(0.28, Math.min(1, speed / 4.5)));
      } else if (track.moving) {
        track.quietFrames += 1;
        if (track.quietFrames >= 3) {
          track.loop?.stop();
          track.loop = null;
          track.moving = false;
          track.quietFrames = 0;
          emitTraversalAudioAt("platform.lock", world);
        }
      }
    }

    for (const [id, track] of tracks) {
      if (live.has(id)) continue;
      track.loop?.stop();
      tracks.delete(id);
    }
  };
}
