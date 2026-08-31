import { emitTraversalAudio } from "../audio/TraversalAudio";
import { CAMPAIGN_MAPS } from "../world/campaign";
import type { ContentRuntime } from "./ContentRuntime";
import { installCampaignPersistenceRuntime } from "./CampaignPersistenceRuntime";
import { activeTraversalProgression } from "./Progression";

type RuntimeState = {
  modeId: string;
  totalKills: number;
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

/**
 * Campaign is a journey through the construct, not a list of isolated score runs.
 * Intermediate sector results are still processed internally (progression,
 * achievements, best times) but their menu screen is suppressed; the next
 * implemented sector loads after a brief audiovisual handoff and receives the
 * normal sector title card. Sector entry is also persisted as a resume checkpoint.
 * Route-efficiency calculations are bound to the active content instead of the
 * Training rooms that happened to exist when TraversalGame.ts first evaluated.
 */
export function installCampaignFlow(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  const originalFinishRun = state.finishRun.bind(game);
  const progression = activeTraversalProgression();
  if (progression) installCampaignPersistenceRuntime(game, progression, content);

  state.extraKills = () => Math.max(0, state.totalKills - content.activeParKills());
  ensureSectorClearFx();

  state.finishRun = () => {
    const campaign = state.modeId === "standard" && content.activeForm() === "campaign-field";
    if (!campaign) {
      originalFinishRun();
      return;
    }

    const currentId = content.selectedContentId();
    const currentIndex = CAMPAIGN_MAPS.findIndex((entry) => entry.id === currentId);
    const laterMaps = currentIndex >= 0 ? CAMPAIGN_MAPS.slice(currentIndex + 1) : [];
    const nextMap = laterMaps.find((entry) => entry.implemented);
    const activeProgression = activeTraversalProgression();

    if (!nextMap) {
      originalFinishRun();

      if (laterMaps.length > 0) {
        // This preview currently ends before the authored Campaign does. Record
        // the sector clear without poisoning Continue state with a false ending.
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

    // Let the existing completion/progression wrappers run, but don't surface an
    // intermediate results menu between connected campaign sectors.
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
    playSectorClearCue();

    window.setTimeout(() => {
      content.setSelectedMap(nextMap.id);
      content.reloadSelected();
      state.beginRun();
    }, SECTOR_HANDOFF_MS);
  };
}

function ensureSectorClearFx(): void {
  if (document.getElementById("campaign-sector-clear-fx")) return;
  const fx = document.createElement("div");
  fx.id = "campaign-sector-clear-fx";
  fx.setAttribute("aria-hidden", "true");
  fx.innerHTML = "<i></i><b></b>";
  document.body.appendChild(fx);
}

function playSectorClearCue(): void {
  const fx = document.getElementById("campaign-sector-clear-fx");
  if (fx) {
    fx.classList.remove("pulse");
    void fx.offsetWidth;
    fx.classList.add("pulse");
    window.setTimeout(() => fx.classList.remove("pulse"), 720);
  }
  emitTraversalAudio("sector.clear");
}
