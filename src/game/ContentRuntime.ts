import { installBrowserLifecycle, mountBrowserDevConsole } from "@slu/web-shell";
import { CAMPAIGN_MAPS, type CampaignMapDefinition } from "../world/campaign";
import { buildChallengeSuite, buildTimeTrialSuite } from "../world/modeSuites";
import { CONTROLS_ROOM } from "../world/onboarding";
import { buildReversalLabyrinth } from "../world/reversalLabyrinth";
import { SPATIAL_ACTOR_TRAINING } from "../world/trainingSpatial";
import { ROOMS, type RoomSpec } from "../world/stages";

export type TraversalContentId = "controls" | "training" | "suite-time-trial" | "suite-challenge" | "suite-reversal" | string;
export type TraversalContentForm = "controls" | "training" | "campaign-field" | "course" | "postgame";
export type TrainingPath = "controls" | "grammar";
export type ModeSuite = "time-trial" | "challenge" | "reversal" | null;

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

function downloadJSON(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function installContentRuntime(shell: any): ContentRuntime {
  const trainingRooms = structuredClone([...ROOMS, ...SPATIAL_ACTOR_TRAINING]) as RoomSpec[];
  let selectedMapId = "map-01";
  let selectedTrainingPath: TrainingPath = "controls";
  let selectedModeSuite: ModeSuite = null;
  let activeId: TraversalContentId = "training";
  let activeForm: TraversalContentForm = "training";
  const studio = shell.studio;
  const telemetry = studio.telemetry;

  telemetry.setContext({
    game: "traversal-fps",
    buildPhase: "full-content-playtest",
    touchCapable: navigator.maxTouchPoints > 0
  });
  telemetry.record("playtest.ready", {
    campaignMaps: CAMPAIGN_MAPS.length,
    timeTrials: 16,
    challenges: 24,
    reversalRooms: 8
  });

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

    if (modeId === "reversal" && selectedModeSuite === "reversal") {
      activeId = "suite-reversal";
      activeForm = "postgame";
      return buildReversalLabyrinth();
    }

    const map = (CAMPAIGN_MAPS.find((entry) => entry.id === selectedMapId && entry.implemented)
      ?? CAMPAIGN_MAPS.find((entry) => entry.implemented)) as ExtendedCampaignMap | undefined;
    activeId = map?.id ?? "map-01";

    if (modeId === "standard") {
      activeForm = "campaign-field";
      return structuredClone(map?.campaignRooms ?? []) as RoomSpec[];
    }

    if (modeId === "reversal") {
      activeId = "suite-reversal";
      activeForm = "postgame";
      return buildReversalLabyrinth();
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
    telemetry.setContext({
      modeId: shell.modes.active()?.id ?? "unknown",
      difficultyId: shell.difficulty.active()?.id ?? "unknown",
      contentId: activeId,
      contentForm: activeForm
    });
    telemetry.record("content.loaded", {
      contentId: activeId,
      contentForm: activeForm,
      roomCount: next.length,
      parKills: next.reduce((sum, room) => sum + room.requiredKills, 0)
    });
  };

  shell.events.on("level:loaded", reloadSelected);

  studio.dev.register("traversal.content", {
    description: "Show selected content and authored rooms",
    run: () => JSON.stringify({
      id: activeId,
      form: activeForm,
      rooms: ROOMS.map((room, index) => ({ index: index + 1, id: room.id, title: room.title, requiredKills: room.requiredKills }))
    }, null, 2)
  });
  studio.dev.register("traversal.maps", {
    description: "Show campaign implementation and room counts",
    run: () => JSON.stringify(CAMPAIGN_MAPS.map((map) => ({
      id: map.id,
      implemented: map.implemented,
      campaignRooms: map.campaignRooms.length,
      courseRooms: map.courseRooms.length
    })), null, 2)
  });
  studio.dev.register("playtest.clear", {
    description: "Clear the current local playtest telemetry session",
    run: () => {
      telemetry.clear();
      telemetry.record("playtest.cleared");
      return "CLEARED";
    }
  });
  studio.dev.register("playtest.download", {
    description: "Download the complete local playtest/debug bundle",
    run: () => {
      const stamp = new Date().toISOString().replaceAll(":", "-");
      downloadJSON(`traversal-playtest-${stamp}.json`, studio.debugBundle());
      return "DOWNLOADED";
    }
  });

  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
  installBrowserLifecycle({
    onBackground: () => telemetry.record("device.background"),
    onForeground: () => telemetry.record("device.foreground"),
    onControllerConnected: (index, id) => telemetry.record("controller.connected", { index, id }),
    onControllerDisconnected: (index, id) => telemetry.record("controller.disconnected", { index, id }),
    onContextLost: () => {
      telemetry.record("renderer.context-lost");
      studio.diagnostics.capture(new Error("WebGL context lost"), { scope: "renderer" });
    },
    onContextRestored: () => telemetry.record("renderer.context-restored")
  }, canvas ?? undefined);

  if (new URLSearchParams(location.search).get("dev") === "1") {
    mountBrowserDevConsole(studio.dev, { title: "TRAVERSAL DEV" });
  }

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
        telemetry.record("content.select", { contentId: id, kind: "campaign-map" });
      }
    },
    setModeSuite(suite: ModeSuite) {
      selectedModeSuite = suite;
      if (suite) telemetry.record("content.select", { contentId: `suite-${suite}`, kind: "mode-suite" });
    },
    reloadSelected,
    setTrainingPath(path: TrainingPath) {
      selectedTrainingPath = path;
      selectedModeSuite = null;
      telemetry.record("content.select", { contentId: path === "controls" ? "controls" : "training", kind: "training" });
    },
    enterGrammar() {
      activeId = "training";
      activeForm = "training";
      selectedTrainingPath = "grammar";
      selectedModeSuite = null;
      ROOMS.splice(0, ROOMS.length, ...loadGrammarRooms());
      telemetry.record("content.loaded", { contentId: activeId, contentForm: activeForm, roomCount: ROOMS.length, parKills: ROOMS.reduce((sum, room) => sum + room.requiredKills, 0) });
    }
  };
}
