import * as THREE from "three";
import type { ContentRuntime } from "../game/ContentRuntime";
import { ROOMS } from "../world/stages";
import { actForSector, buildActEnvironment, buildFinaleGate, FINALE_SECTORS, type ActEnvironment, type FinaleGate } from "./ActEnvironment";

type RuntimeState = {
  roomRoot: THREE.Group;
  roomIndex: number;
  roomKills: number;
  loadRoom: (index: number) => void;
};

/**
 * Campaign fields get their act's architecture (open → interior → deep core →
 * breach) and, on the four act finales, a gate that assembles as you clear the
 * room. Non-collision presentation only; courses keep their clean readability.
 */
export function installCampaignFieldPresentation(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  const originalLoadRoom = state.loadRoom.bind(game);
  let environment: ActEnvironment | null = null;
  let gate: FinaleGate | null = null;

  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    environment = null;
    gate = null;
    if (content.activeForm() !== "campaign-field") return;
    const room = ROOMS[index];
    const sector = Number(/^map-(\d+)/.exec(content.selectedContentId())?.[1] ?? 0);
    if (!room || !sector) return;
    const act = actForSector(sector);
    environment = buildActEnvironment(room, act);
    state.roomRoot.add(environment.group);
    if (FINALE_SECTORS.has(sector)) {
      gate = buildFinaleGate(room, act);
      state.roomRoot.add(gate.group);
    }
  };

  let last = performance.now() / 1000;
  const tick = () => {
    requestAnimationFrame(tick);
    const now = performance.now() / 1000;
    const dt = Math.min(0.1, now - last);
    last = now;
    environment?.update(now, dt);
    if (gate) {
      gate.setProgress(state.roomKills, ROOMS[state.roomIndex]?.requiredKills ?? 1, now);
      gate.update(now, dt);
    }
  };
  requestAnimationFrame(tick);
}
