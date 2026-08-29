import { CAMPAIGN_MAPS } from "../world/campaign";
import { ROOMS, type RoomSpec } from "../world/stages";

export type TraversalContentId = "training" | string;
export type TraversalContentForm = "training" | "campaign-field" | "course";

export interface ContentRuntime {
  selectedContentId(): TraversalContentId;
  activeForm(): TraversalContentForm;
  activeRooms(): RoomSpec[];
  activeParKills(): number;
  setSelectedMap(id: string): void;
}

export function installContentRuntime(shell: any): ContentRuntime {
  const trainingRooms = structuredClone(ROOMS) as RoomSpec[];
  let selectedMapId = "map-01";
  let activeId: TraversalContentId = "training";
  let activeForm: TraversalContentForm = "training";

  const selectRooms = (): RoomSpec[] => {
    const modeId = shell.modes.active()?.id ?? "training";
    if (modeId === "training") {
      activeId = "training";
      activeForm = "training";
      return structuredClone(trainingRooms) as RoomSpec[];
    }

    const map = CAMPAIGN_MAPS.find((entry) => entry.id === selectedMapId && entry.implemented)
      ?? CAMPAIGN_MAPS.find((entry) => entry.implemented);
    activeId = map?.id ?? "map-01";

    if (modeId === "standard") {
      activeForm = "campaign-field";
      return structuredClone(map?.campaignRooms ?? []) as RoomSpec[];
    }

    activeForm = "course";
    return structuredClone(map?.courseRooms ?? []) as RoomSpec[];
  };

  shell.events.on("level:loaded", () => {
    const next = selectRooms();
    ROOMS.splice(0, ROOMS.length, ...next);
  });

  return {
    selectedContentId: () => activeId,
    activeForm: () => activeForm,
    activeRooms: () => ROOMS,
    activeParKills: () => ROOMS.reduce((sum, room) => sum + room.requiredKills, 0),
    setSelectedMap(id: string) {
      const map = CAMPAIGN_MAPS.find((entry) => entry.id === id);
      if (map?.implemented) selectedMapId = id;
    }
  };
}
