import { CAMPAIGN_MAPS } from "../world/campaign";
import type { ContentRuntime } from "./ContentRuntime";
import type { TraversalProgression } from "./Progression";

type RuntimeState = {
  flow: {
    onActivate(screenId: string, choiceId: string): void;
    onBack(screenId: string): void;
  };
  ui: {
    updateScreen(screenId: string, payload: Record<string, unknown>): void;
    show(screenId: string): void;
  };
  shell: {
    difficulty: { set(id: string): void };
    loadLevel(id: string): Promise<unknown>;
  };
};

type PendingCampaignStart = {
  kind: "new" | "continue";
  sectorId: string;
};

const installedGames = new WeakSet<object>();

/**
 * Traversal owns Campaign setup because the generic Shell queue is ordered for
 * difficulty -> loadout -> stage. Campaign reads more naturally as
 * Campaign -> New/Continue -> Difficulty -> play, with Back returning one step.
 */
export function installCampaignPersistenceRuntime(
  game: object,
  progression: TraversalProgression,
  content: ContentRuntime
): void {
  if (installedGames.has(game)) return;
  installedGames.add(game);

  const state = game as unknown as RuntimeState;
  const originalActivate = state.flow.onActivate.bind(state.flow);
  const originalBack = state.flow.onBack.bind(state.flow);
  let campaignSetupActive = false;
  let pending: PendingCampaignStart | null = null;

  state.flow.onActivate = (screenId: string, choiceId: string) => {
    if (screenId === "mode-select" && choiceId === "standard") {
      // Let the Shell record/activate the mode, then replace its generic first
      // setup screen with the Campaign-specific first decision.
      originalActivate(screenId, choiceId);
      campaignSetupActive = true;
      pending = null;
      refreshCampaignMenu(state, progression);
      state.ui.show("stage-select");
      return;
    }

    if (campaignSetupActive && screenId === "stage-select") {
      const target = choiceId === "campaign-new"
        ? firstImplementedSector()
        : choiceId === "campaign-continue"
          ? continueSector(progression)
          : undefined;
      if (!target) return;

      pending = {
        kind: choiceId === "campaign-new" ? "new" : "continue",
        sectorId: target.id
      };
      content.setSelectedMap(target.id);
      state.ui.show("difficulty-select");
      return;
    }

    if (campaignSetupActive && pending && screenId === "difficulty-select") {
      state.shell.difficulty.set(choiceId);
      content.setSelectedMap(pending.sectorId);
      if (pending.kind === "new") void progression.startCampaign(pending.sectorId);

      campaignSetupActive = false;
      pending = null;
      void state.shell.loadLevel("standard").then(() => state.ui.show("gameplay-placeholder"));
      return;
    }

    originalActivate(screenId, choiceId);
  };

  state.flow.onBack = (screenId: string) => {
    if (campaignSetupActive && screenId === "difficulty-select") {
      pending = null;
      refreshCampaignMenu(state, progression);
      state.ui.show("stage-select");
      return;
    }

    if (campaignSetupActive && screenId === "stage-select") {
      campaignSetupActive = false;
      pending = null;
      state.ui.show("mode-select");
      return;
    }

    originalBack(screenId);
  };
}

function refreshCampaignMenu(state: RuntimeState, progression: TraversalProgression): void {
  const checkpoint = progression.campaignCheckpoint();
  const current = CAMPAIGN_MAPS.find((map) => map.id === checkpoint?.sectorId);

  state.ui.updateScreen("stage-select", {
    title: "Campaign",
    subtitle: "Choose how to enter the construct.",
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
      }
    ]
  });
}

function continueSector(progression: TraversalProgression) {
  const checkpoint = progression.campaignCheckpoint();
  return CAMPAIGN_MAPS.find((map) => map.id === checkpoint?.sectorId && map.implemented)
    ?? firstImplementedSector();
}

function firstImplementedSector() {
  return CAMPAIGN_MAPS.find((map) => map.implemented);
}
