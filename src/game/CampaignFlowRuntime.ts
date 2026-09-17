import { emitTraversalAudio } from "../audio/TraversalAudio";
import { CAMPAIGN_MAPS } from "../world/campaign";
import type { ContentRuntime } from "./ContentRuntime";
import { installCampaignPersistenceRuntime } from "./CampaignPersistenceRuntime";
import { activeTraversalProgression } from "./Progression";

type RuntimeState = {
  modeId: string;
  totalKills: number;
  shell: any;
  extraKills(): number;
  beginRun(): void;
  finishRun(): void;
  ui: {
    updateScreen(screenId: string, payload: Record<string, unknown>): void;
  };
  flow: {
    showResults(): void;
  };
};

const SECTOR_HANDOFF_MS = 620;
const ACT_HANDOFF_MS = 1500;
const ACT_COMPLETES: Record<string, string> = {
  "map-08": "ACT I // COMPLETE",
  "map-18": "ACT II // COMPLETE",
  "map-30": "ACT III // COMPLETE"
};

export function installCampaignFlow(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  const originalFinishRun = state.finishRun.bind(game);
  const originalBeginRun = state.beginRun.bind(game);
  const progression = activeTraversalProgression();
  const telemetry = state.shell.studio.telemetry;
  if (progression) installCampaignPersistenceRuntime(game, progression, content);

  state.extraKills = () => Math.max(0, state.totalKills - content.activeParKills());
  ensureSectorClearFx();

  state.beginRun = () => {
    telemetry.record("run.start", {
      modeId: state.shell.modes.active()?.id ?? "unknown",
      difficultyId: state.shell.difficulty.active()?.id ?? "unknown",
      contentId: content.selectedContentId(),
      contentForm: content.activeForm(),
      roomCount: content.activeRooms().length
    });
    originalBeginRun();
  };

  state.finishRun = () => {
    const currentId = content.selectedContentId();
    telemetry.record("run.complete", {
      modeId: state.modeId,
      contentId: currentId,
      contentForm: content.activeForm(),
      roomCount: content.activeRooms().length,
      totalKills: state.totalKills
    });

    const campaign = state.modeId === "standard" && content.activeForm() === "campaign-field";
    if (!campaign) {
      telemetry.record("level.complete", { levelId: currentId });
      originalFinishRun();
      return;
    }

    telemetry.record("level.complete", { levelId: currentId });
    const currentIndex = CAMPAIGN_MAPS.findIndex((entry) => entry.id === currentId);
    const laterMaps = currentIndex >= 0 ? CAMPAIGN_MAPS.slice(currentIndex + 1) : [];
    const nextMap = laterMaps.find((entry) => entry.implemented);
    const activeProgression = activeTraversalProgression();

    if (!nextMap) {
      originalFinishRun();

      if (laterMaps.length > 0) {
        void activeProgression?.completeCampaignContentBoundary(currentId);
        state.ui.updateScreen("results", {
          title: "Available Sectors Cleared",
          subtitle: `Sector ${String(currentIndex + 1).padStart(2, "0")} complete · Campaign continues`,
          choices: [
            {
              id: "result-boundary",
              label: "Campaign Progress",
              description: `${currentIndex + 1} of ${CAMPAIGN_MAPS.length} planned sectors reached in this build`,
              disabled: true
            },
            { id: "retry", label: "Replay Sector" },
            { id: "continue", label: "Change Mode" },
            { id: "menu", label: "Main Menu" }
          ]
        });
      } else {
        void activeProgression?.completeCampaignSector(currentId);
      }
      return;
    }

    const originalUpdateScreen = state.ui.updateScreen.bind(state.ui);
    const originalShowResults = state.flow.showResults.bind(state.flow);
    state.ui.updateScreen = (screenId: string, payload: Record<string, unknown>) => {
      if (screenId !== "results") originalUpdateScreen(screenId, payload);
    };
    state.flow.showResults = () => {};

    try {
      originalFinishRun();
    } finally {
      state.ui.updateScreen = originalUpdateScreen;
      state.flow.showResults = originalShowResults;
    }

    void activeProgression?.completeCampaignSector(currentId, nextMap.id);
    telemetry.record("campaign.advance", { from: currentId, to: nextMap.id });
    const actComplete = ACT_COMPLETES[currentId];
    playSectorClearCue(actComplete);

    window.setTimeout(() => {
      content.setSelectedMap(nextMap.id);
      content.reloadSelected();
      state.beginRun();
    }, actComplete ? ACT_HANDOFF_MS : SECTOR_HANDOFF_MS);
  };
}

function ensureSectorClearFx(): void {
  if (document.getElementById("campaign-sector-clear-fx")) return;
  const fx = document.createElement("div");
  fx.id = "campaign-sector-clear-fx";
  fx.setAttribute("aria-hidden", "true");
  fx.innerHTML = "<i></i><b></b><span></span>";
  document.body.appendChild(fx);
}

function playSectorClearCue(actLabel?: string): void {
  const fx = document.getElementById("campaign-sector-clear-fx");
  if (fx) {
    const label = fx.querySelector("span");
    if (label) label.textContent = actLabel ?? "";
    fx.classList.toggle("act-complete", Boolean(actLabel));
    fx.classList.remove("pulse");
    void fx.offsetWidth;
    fx.classList.add("pulse");
    window.setTimeout(() => {
      fx.classList.remove("pulse", "act-complete");
      if (label) label.textContent = "";
    }, actLabel ? 1320 : 720);
  }
  emitTraversalAudio("sector.clear");
}
