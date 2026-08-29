import { CAMPAIGN_MAPS } from "../world/campaign";
import { ROOMS, type RoomSpec } from "../world/stages";

export type TraversalContentId = "training" | string;

export interface ContentRuntime {
  selectedContentId(): TraversalContentId;
  activeRooms(): RoomSpec[];
  activeParKills(): number;
  setSelectedMap(id: string): void;
}

export function installContentRuntime(shell: any): ContentRuntime {
  const trainingRooms = structuredClone(ROOMS) as RoomSpec[];
  let selectedMapId = "map-01";
  let activeId: TraversalContentId = "training";

  const selectRooms = (): RoomSpec[] => {
    const modeId = shell.modes.active()?.id ?? "training";
    if (modeId === "training") {
      activeId = "training";
      return structuredClone(trainingRooms) as RoomSpec[];
    }

    const map = CAMPAIGN_MAPS.find((entry) => entry.id === selectedMapId && entry.implemented)
      ?? CAMPAIGN_MAPS.find((entry) => entry.implemented);
    activeId = map?.id ?? "map-01";
    return structuredClone(map?.rooms ?? []) as RoomSpec[];
  };

  shell.events.on("level:loaded", () => {
    const next = selectRooms();
    ROOMS.splice(0, ROOMS.length, ...next);
  });

  return {
    selectedContentId: () => activeId,
    activeRooms: () => ROOMS,
    activeParKills: () => ROOMS.reduce((sum, room) => sum + room.requiredKills, 0),
    setSelectedMap(id: string) {
      const map = CAMPAIGN_MAPS.find((entry) => entry.id === id);
      if (map?.implemented) selectedMapId = id;
    }
  };
}
