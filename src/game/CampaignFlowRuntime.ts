import { CAMPAIGN_MAPS } from "../world/campaign";
import type { ContentRuntime } from "./ContentRuntime";

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

/**
 * Campaign is a journey through the construct, not a list of isolated score runs.
 * Intermediate sector results are still processed internally (progression,
 * achievements, best times) but their menu screen is suppressed; the next
 * implemented sector loads immediately and receives the normal sector title card.
 */
export function installCampaignFlow(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  const originalFinishRun = state.finishRun.bind(game);

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

    if (!nextMap) {
      originalFinishRun();
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

    content.setSelectedMap(nextMap.id);
    content.reloadSelected();
    state.beginRun();
  };
}
