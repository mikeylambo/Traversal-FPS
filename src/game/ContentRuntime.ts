import { CAMPAIGN_MAPS } from "../world/campaign";
import { CONTROLS_ROOM } from "../world/onboarding";
import { SPATIAL_ACTOR_TRAINING } from "../world/trainingSpatial";
import { ROOMS, type RoomSpec } from "../world/stages";

export type TraversalContentId = "controls" | "training" | string;
export type TraversalContentForm = "controls" | "training" | "campaign-field" | "course";
export type TrainingPath = "controls" | "grammar";

export interface ContentRuntime {
  selectedContentId(): TraversalContentId;
  activeForm(): TraversalContentForm;
  activeRooms(): RoomSpec[];
  activeParKills(): number;
  setSelectedMap(id: string): void;
  reloadSelected(): void;
  setTrainingPath(path: TrainingPath): void;
  enterGrammar(): void;
}

export function installContentRuntime(shell: any): ContentRuntime {
  const trainingRooms = structuredClone([...ROOMS, ...SPATIAL_ACTOR_TRAINING]) as RoomSpec[];
  let selectedMapId = "map-01";
  let selectedTrainingPath: TrainingPath = "controls";
  let activeId: TraversalContentId = "training";
  let activeForm: TraversalContentForm = "training";

  const loadGrammarRooms = (): RoomSpec[] => structuredClone(trainingRooms) as RoomSpec[];

  const selectRooms = (): RoomSpec[] => {
    const modeId = shell.modes.active()?.id ?? "training";
    if (modeId === "training") {
      if (selectedTrainingPath === "controls") {
        activeId = "controls";
        activeForm = "controls";
        return [structuredClone(CONTROLS_ROOM) as RoomSpec];
      }
      activeId = "training";
      activeForm = "training";
      return loadGrammarRooms();
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

  const reloadSelected = () => {
    const next = selectRooms();
    ROOMS.splice(0, ROOMS.length, ...next);
  };

  shell.events.on("level:loaded", reloadSelected);

  return {
    selectedContentId: () => activeId,
    activeForm: () => activeForm,
    activeRooms: () => ROOMS,
    activeParKills: () => ROOMS.reduce((sum, room) => sum + room.requiredKills, 0),
    setSelectedMap(id: string) {
      const map = CAMPAIGN_MAPS.find((entry) => entry.id === id);
      if (map?.implemented) selectedMapId = id;
    },
    reloadSelected,
    setTrainingPath(path: TrainingPath) {
      selectedTrainingPath = path;
    },
    enterGrammar() {
      activeId = "training";
      activeForm = "training";
      selectedTrainingPath = "grammar";
      ROOMS.splice(0, ROOMS.length, ...loadGrammarRooms());
    }
  };
}