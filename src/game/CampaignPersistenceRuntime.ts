import { CAMPAIGN_MAPS } from "../world/campaign";
import type { ContentRuntime } from "./ContentRuntime";
import type { TraversalProgression } from "./Progression";

type RuntimeState = {
  flow: {
    onActivate(screenId: string, choiceId: string): void;
  };
  ui: {
    updateScreen(screenId: string, payload: Record<string, unknown>): void;
  };
};

/**
 * Adds campaign resume semantics without changing the Shell's generic navigation.
 * Current campaign checkpoints are sector-entry checkpoints; the persisted schema
 * already carries checkpoint IDs so intra-sector checkpoints can be introduced
 * later without another save migration.
 */
export function installCampaignPersistenceRuntime(
  game: object,
  progression: TraversalProgression,
  content: ContentRuntime
): void {
  const state = game as unknown as RuntimeState;
  const originalActivate = state.flow.onActivate.bind(state.flow);

  state.flow.onActivate = (screenId: string, choiceId: string) => {
    if (screenId === "mode-select" && choiceId === "standard") {
      originalActivate(screenId, choiceId);
      refreshCampaignMenu(state, progression);
      return;
    }

    if (screenId === "stage-select" && choiceId === "campaign-new") {
      const first = firstImplementedSector();
      if (!first) return;
      content.setSelectedMap(first.id);
      void progression.startCampaign(first.id);
      originalActivate(screenId, first.id);
      return;
    }

    if (screenId === "stage-select" && choiceId === "campaign-continue") {
      const checkpoint = progression.campaignCheckpoint();
      const fallback = firstImplementedSector();
      const target = CAMPAIGN_MAPS.find((map) => map.id === checkpoint?.sectorId && map.implemented)
        ?? fallback;
      if (!target) return;
      content.setSelectedMap(target.id);
      originalActivate(screenId, target.id);
      return;
    }

    originalActivate(screenId, choiceId);
  };
}

function refreshCampaignMenu(state: RuntimeState, progression: TraversalProgression): void {
  const checkpoint = progression.campaignCheckpoint();
  const current = CAMPAIGN_MAPS.find((map) => map.id === checkpoint?.sectorId);
  const discovered = new Set(progression.discoveredSectors());
  const replayChoices = CAMPAIGN_MAPS
    .filter((map) => map.implemented && discovered.has(map.id))
    .map((map) => ({
      id: map.id,
      label: map.label,
      description: map.subtitle
    }));

  state.ui.updateScreen("stage-select", {
    title: "Campaign",
    choices: [
      {
        id: "campaign-new",
        label: "New Campaign",
        description: "Begin at Sector 01."
      },
      {
        id: "campaign-continue",
        label: "Continue",
        description: progression.hasCampaignContinue()
          ? current?.label ?? "Resume campaign"
          : "No active campaign",
        disabled: !progression.hasCampaignContinue()
      },
      ...replayChoices
    ]
  });
}

function firstImplementedSector() {
  return CAMPAIGN_MAPS.find((map) => map.implemented);
}
