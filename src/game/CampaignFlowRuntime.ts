import { emitTraversalAudio } from "../audio/TraversalAudio";
import { CAMPAIGN_MAPS } from "../world/campaign";
import type { ContentRuntime } from "./ContentRuntime";
import { installCampaignPersistenceRuntime } from "./CampaignPersistenceRuntime";
import { activeTraversalProgression } from "./Progression";

type RuntimeState = {
  modeId: string;
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
 */
export function installCampaignFlow(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  const originalFinishRun = state.finishRun.bind(game);
  const progression = activeTraversalProgression();
  if (progression) installCampaignPersistenceRuntime(game, progression, content);
  ensureSectorClearFx();

  state.finishRun = () => {
    const campaign = state.modeId === "standard" && content.activeForm() === "campaign-field";
    if (!campaign) {
      originalFinishRun();
      return;
    }

    const currentId = content.selectedContentId();
    const currentIndex = CAMPAIGN_MAPS.findIndex((entry) => entry.id === currentId);
    const nextMap = currentIndex >= 0
      ? CAMPAIGN_MAPS.slice(currentIndex + 1).find((entry) => entry.implemented)
      : undefined;
    const activeProgression = activeTraversalProgression();

    if (!nextMap) {
      originalFinishRun();
      void activeProgression?.completeCampaignSector(currentId);
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
