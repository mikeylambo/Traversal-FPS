import { CAMPAIGN_MAPS } from "../world/campaign";
import { ROOMS } from "../world/stages";
import type { ContentRuntime } from "./ContentRuntime";

type ResultChoice = {
  id: string;
  label: string;
  description: string;
  disabled?: boolean;
};

type RuntimeState = {
  modeId: string;
  modeLabel: string;
  shots: number;
  totalKills: number;
  roomKills: number;
  roomIndex: number;
  tutorialUntil: number;
  finishRun: () => void;
  loadRoom: (index: number) => void;
  updateHUD: () => void;
  extraKills: () => number;
  wastedShots: () => number;
  ui: {
    updateScreen(screenId: string, payload: Record<string, unknown>): void;
  };
};

/** Keeps dynamic content/results in sync and lets Campaign read as a place, not a test chamber. */
export function enhanceGrammarRuntime(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;

  state.extraKills = () => Math.max(0, state.totalKills - content.activeParKills());

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    if (content.activeForm() === "campaign-field") state.tutorialUntil = 0;
  };

  const originalHUD = state.updateHUD.bind(game);
  state.updateHUD = () => {
    originalHUD();
    if (content.activeForm() !== "campaign-field") return;

    const room = ROOMS[state.roomIndex];
    const roomLabel = document.getElementById("room-label");
    const roomObjective = document.getElementById("room-objective");
    const missionEyebrow = document.getElementById("mission-eyebrow");
    const tutorialCard = document.getElementById("tutorial-card");
    const map = CAMPAIGN_MAPS.find((entry) => entry.id === content.selectedContentId());
    const sectorNumber = map?.id.match(/(\d+)/)?.[1]?.padStart(2, "0") ?? "01";
    const mapTitle = map?.label.replace(/^SECTOR \d+ \/\/ /, "") ?? room?.title ?? "CAMPAIGN";

    if (missionEyebrow) missionEyebrow.textContent = `SECTOR ${sectorNumber}`;
    if (roomLabel) roomLabel.textContent = mapTitle;
    if (roomObjective && room) roomObjective.textContent = `${state.roomKills}/${room.requiredKills} SPHERES`;
    tutorialCard?.classList.remove("visible");
  };

  const originalFinishRun = state.finishRun.bind(game);
  state.finishRun = () => {
    const originalUpdateScreen = state.ui.updateScreen.bind(state.ui);
    state.ui.updateScreen = (screenId: string, payload: Record<string, unknown>) => {
      if (screenId === "results") payload = rewriteResults(payload, state, content);
      originalUpdateScreen(screenId, payload);
    };

    try {
      originalFinishRun();
    } finally {
      state.ui.updateScreen = originalUpdateScreen;
    }
  };
}

function rewriteResults(
  payload: Record<string, unknown>,
  state: RuntimeState,
  content: ContentRuntime
): Record<string, unknown> {
  const par = content.activeParKills();
  const extraShots = Math.max(0, state.shots - par);
  const extraKills = Math.max(0, state.totalKills - par);
  const wasted = state.wastedShots();
  const contentId = content.selectedContentId();
  const campaign = content.activeForm() === "campaign-field";
  const map = CAMPAIGN_MAPS.find((entry) => entry.id === contentId);

  let subtitle = typeof payload.subtitle === "string" ? payload.subtitle : "";
  if (contentId === "training") {
    subtitle = subtitle.replace("Five rooms cleared", `${ROOMS.length} rooms cleared`);
  } else if (campaign) {
    subtitle = map?.label ?? "Sector Cleared";
  } else {
    subtitle = `${subtitle} · ${contentId.toUpperCase()}`;
  }

  const sourceChoices = Array.isArray(payload.choices)
    ? payload.choices as ResultChoice[]
    : [];

  const choices = sourceChoices
    .filter((choice) => !(campaign && choice.id === "result-score"))
    .map((choice) => {
      if (campaign && choice.id === "result-route") {
        return {
          ...choice,
          label: `Spheres // ${state.totalKills}`,
          description: `${par} required`
        };
      }
      if (choice.id === "result-shots") {
        return {
          ...choice,
          description: state.modeId === "challenge"
            ? `${wasted} non-kill shots · one miss allowance per chamber`
            : state.modeId === "time-trial"
              ? `${wasted} non-kill shots · +${extraShots} over theoretical minimum`
              : campaign
                ? `${wasted} non-kill shots`
                : `${par} theoretical minimum · +${extraShots} over`
        };
      }
      if (choice.id === "result-kills") {
        return { ...choice, description: `${par} is the minimum route` };
      }
      if (choice.id === "result-route" && state.modeId !== "challenge") {
        return {
          ...choice,
          description: `${state.totalKills} kills · ${par} minimum · +${extraKills} extra`
        };
      }
      return choice;
    });

  return { ...payload, subtitle, choices: Array.isArray(payload.choices) ? choices : payload.choices };
}
