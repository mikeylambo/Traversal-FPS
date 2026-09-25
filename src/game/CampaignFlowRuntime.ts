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
    onActivate(screenId: string, choiceId: string): void;
  };
};

type ResultChoice = {
  id?: string;
  label?: string;
  description?: string;
  [key: string]: unknown;
};

const SECTOR_HANDOFF_MS = 620;
const MAP_SELECT_UNLOCK = "map-08";
const TIME_TRIAL_UNLOCK = "map-18";
const CHALLENGE_UNLOCK = "map-30";
const REVERSAL_UNLOCK = "map-42";

export function installCampaignFlow(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  const originalFinishRun = state.finishRun.bind(game);
  const originalBeginRun = state.beginRun.bind(game);
  const progression = activeTraversalProgression();
  const telemetry = state.shell.studio.telemetry;
  if (progression) installCampaignPersistenceRuntime(game, progression, content);

  state.extraKills = () => Math.max(0, state.totalKills - content.activeParKills());
  ensureSectorClearFx();

  const unlockState = () => {
    const snapshot = progression?.snapshot();
    const completed = new Set(snapshot?.completedMaps ?? []);
    const campaignComplete = Boolean(snapshot?.campaign.completed);
    return {
      mapSelect: campaignComplete || completed.has(MAP_SELECT_UNLOCK),
      timeTrial: campaignComplete || completed.has(TIME_TRIAL_UNLOCK),
      challenge: campaignComplete || completed.has(CHALLENGE_UNLOCK),
      reversal: campaignComplete || completed.has(REVERSAL_UNLOCK)
    };
  };

  const refreshModeSelect = () => {
    const unlocked = unlockState();
    state.ui.updateScreen("mode-select", {
      title: unlocked.reversal ? "Select Mode // Construct Reversed" : "Select Mode",
      choices: [
        { id: "training", label: "Training", description: "Learn the Warp Rifle grammar." },
        { id: "standard", label: "Campaign", description: unlocked.mapSelect ? "Continue or revisit discovered sectors." : "Explore the construct." },
        {
          id: "time-trial",
          label: "Time Trial",
          description: unlocked.timeTrial ? "16 race courses." : "LOCKED // Clear Act II to unlock Time Trial.",
          disabled: !unlocked.timeTrial
        },
        {
          id: "challenge",
          label: "Challenge // Clean Route",
          description: unlocked.challenge ? "24 chambers. Exact Spheres only." : "LOCKED // Clear Act III to unlock Challenge.",
          disabled: !unlocked.challenge
        },
        {
          id: "reversal",
          label: "THE REVERSE // Labyrinth",
          description: unlocked.reversal ? "Postgame. Cross to the hidden side of the Construct and find the way back." : "LOCKED // Clear the Campaign to expose the hidden side of the Construct.",
          disabled: !unlocked.reversal
        }
      ]
    });
  };

  const refreshCampaignStageSelect = () => {
    const snapshot = progression?.snapshot();
    const unlocked = unlockState();
    const discovered = new Set([
      ...(snapshot?.campaign.discoveredSectors ?? []),
      ...(snapshot?.completedMaps ?? [])
    ]);
    const current = snapshot?.campaign.currentSectorId
      ?? CAMPAIGN_MAPS.find((entry) => entry.implemented && !snapshot?.completedMaps.includes(entry.id))?.id
      ?? "map-01";
    discovered.add(current);

    if (!unlocked.mapSelect) {
      const map = CAMPAIGN_MAPS.find((entry) => entry.id === current) ?? CAMPAIGN_MAPS[0];
      state.ui.updateScreen("stage-select", {
        title: "Campaign",
        choices: [{
          id: map?.id ?? "map-01",
          label: map?.label ?? "SECTOR 01 // THE SPAN",
          description: "Continue the Campaign // Map Select unlocks after Act I."
        }]
      });
      return;
    }

    const visible = CAMPAIGN_MAPS.filter((entry) => entry.implemented && discovered.has(entry.id));
    state.ui.updateScreen("stage-select", {
      title: "Campaign // Map Select",
      choices: visible.map((entry) => ({
        id: entry.id,
        label: entry.label,
        description: entry.subtitle
      }))
    });
  };

  const originalActivate = state.flow.onActivate.bind(state.flow);
  state.flow.onActivate = (screenId: string, choiceId: string) => {
    const unlocked = unlockState();
    if (screenId === "mode-select" && choiceId === "time-trial" && !unlocked.timeTrial) return;
    if (screenId === "mode-select" && choiceId === "challenge" && !unlocked.challenge) return;
    if (screenId === "mode-select" && choiceId === "reversal" && !unlocked.reversal) return;

    originalActivate(screenId, choiceId);

    if (screenId === "main-menu" && choiceId === "play") refreshModeSelect();
    // CampaignPersistenceRuntime owns the Campaign setup screens. Do not overwrite
    // its New/Continue stage menu here; doing so creates a stage choice that the
    // persistence flow intentionally rejects and leaves Campaign unable to launch.
  };

  refreshModeSelect();

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
      runWithPlayerFacingResults(state, originalFinishRun);
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
        void activeProgression?.completeCampaignSector(currentId).then(() => refreshModeSelect());
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

    void activeProgression?.completeCampaignSector(currentId, nextMap.id).then(() => {
      refreshModeSelect();
      if (currentId === MAP_SELECT_UNLOCK || currentId === TIME_TRIAL_UNLOCK || currentId === CHALLENGE_UNLOCK) {
        emitTraversalAudio("achievement.unlock");
      }
    });
    telemetry.record("campaign.advance", { from: currentId, to: nextMap.id });
    playSectorClearCue();

    window.setTimeout(() => {
      content.setSelectedMap(nextMap.id);
      content.reloadSelected();
      state.beginRun();
    }, SECTOR_HANDOFF_MS);
  };
}

function runWithPlayerFacingResults(state: RuntimeState, finish: () => void): void {
  const originalUpdateScreen = state.ui.updateScreen.bind(state.ui);
  state.ui.updateScreen = (screenId: string, payload: Record<string, unknown>) => {
    originalUpdateScreen(
      screenId,
      screenId === "results" ? simplifyResultsPayload(payload, state.modeId) : payload
    );
  };
  try {
    finish();
  } finally {
    state.ui.updateScreen = originalUpdateScreen;
  }
}

function simplifyResultsPayload(payload: Record<string, unknown>, modeId: string): Record<string, unknown> {
  const choices = Array.isArray(payload.choices) ? payload.choices as ResultChoice[] : [];
  const cleaned = choices
    .filter((choice) => !(modeId === "reversal" && choice.id === "result-time"))
    .map((choice) => ({
      ...choice,
      label: playerFacingText(choice.label),
      description: playerFacingText(choice.description)
    }));

  return {
    ...payload,
    choices: cleaned
  };
}

function playerFacingText(value: string | undefined): string | undefined {
  return value
    ?.replaceAll("non-kill shots", "misses")
    .replaceAll("theoretical minimum", "par")
    .replaceAll("minimum route", "required route")
    .replaceAll("exact route requirement met", "required Spheres cleared")
    .replaceAll("Kills", "Spheres")
    .replaceAll("kills", "spheres")
    .replaceAll("Kill", "Sphere")
    .replaceAll("kill", "sphere");
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
