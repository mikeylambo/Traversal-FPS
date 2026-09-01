import { CAMPAIGN_MAPS, type CampaignMapDefinition } from "../world/campaign";
import { buildChallengeSuite, buildTimeTrialSuite } from "../world/modeSuites";
import { CONTROLS_ROOM } from "../world/onboarding";
import { SPATIAL_ACTOR_TRAINING } from "../world/trainingSpatial";
import { ROOMS, type RoomSpec } from "../world/stages";

export type TraversalContentId = "controls" | "training" | "suite-time-trial" | "suite-challenge" | string;
export type TraversalContentForm = "controls" | "training" | "campaign-field" | "course";
export type TrainingPath = "controls" | "grammar";
export type ModeSuite = "time-trial" | "challenge" | null;

type ExtendedCampaignMap = CampaignMapDefinition & {
  timeTrialRooms?: RoomSpec[];
  challengeRooms?: RoomSpec[];
};

export interface ContentRuntime {
  selectedContentId(): TraversalContentId;
  activeForm(): TraversalContentForm;
  activeRooms(): RoomSpec[];
  activeParKills(): number;
  setSelectedMap(id: string): void;
  setModeSuite(suite: ModeSuite): void;
  reloadSelected(): void;
  setTrainingPath(path: TrainingPath): void;
  enterGrammar(): void;
}

export function installContentRuntime(shell: any): ContentRuntime {
  const trainingRooms = structuredClone([...ROOMS, ...SPATIAL_ACTOR_TRAINING]) as RoomSpec[];
  let selectedMapId = "map-01";
  let selectedTrainingPath: TrainingPath = "controls";
  let selectedModeSuite: ModeSuite = null;
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

    if (modeId === "time-trial" && selectedModeSuite === "time-trial") {
      activeId = "suite-time-trial";
      activeForm = "course";
      return buildTimeTrialSuite();
    }

    if (modeId === "challenge" && selectedModeSuite === "challenge") {
      activeId = "suite-challenge";
      activeForm = "course";
      return buildChallengeSuite();
    }

    const map = (CAMPAIGN_MAPS.find((entry) => entry.id === selectedMapId && entry.implemented)
      ?? CAMPAIGN_MAPS.find((entry) => entry.implemented)) as ExtendedCampaignMap | undefined;
    activeId = map?.id ?? "map-01";

    if (modeId === "standard") {
      activeForm = "campaign-field";
      return structuredClone(map?.campaignRooms ?? []) as RoomSpec[];
    }

    activeForm = "course";
    const modeRooms = modeId === "time-trial"
      ? map?.timeTrialRooms
      : modeId === "challenge"
        ? map?.challengeRooms
        : undefined;
    return structuredClone(modeRooms?.length ? modeRooms : map?.courseRooms ?? []) as RoomSpec[];
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
      if (map?.implemented) {
        selectedMapId = id;
        selectedModeSuite = null;
      }
    },
    setModeSuite(suite: ModeSuite) {
      selectedModeSuite = suite;
    },
    reloadSelected,
    setTrainingPath(path: TrainingPath) {
      selectedTrainingPath = path;
      selectedModeSuite = null;
    },
    enterGrammar() {
      activeId = "training";
      activeForm = "training";
      selectedTrainingPath = "grammar";
      selectedModeSuite = null;
      ROOMS.splice(0, ROOMS.length, ...loadGrammarRooms());
    }
  };
}