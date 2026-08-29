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

/** Keeps scoring/results in sync and lets Campaign read as a continuous sector instead of a test chamber. */
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
    const tutorialCard = document.getElementById("tutorial-card");
    const modeLabel = document.getElementById("mode-label");

    if (roomLabel) roomLabel.textContent = "SECTOR 01 // THE SPAN";
    if (roomObjective && room) {
      roomObjective.textContent = `NODES RESOLVED ${state.roomKills}/${room.requiredKills} // FIND THE EXIT`;
    }
    if (modeLabel) modeLabel.textContent = "CAMPAIGN // DIMENSIONAL CONSTRUCT";
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

  let subtitle = typeof payload.subtitle === "string" ? payload.subtitle : "";
  if (contentId === "training") {
    subtitle = subtitle.replace("Five rooms cleared", `${ROOMS.length} rooms cleared`);
  } else if (content.activeForm() === "campaign-field") {
    subtitle = `SECTOR CLEARED · ${contentId.toUpperCase()} · ${state.modeLabel}`;
  } else {
    subtitle = `${subtitle} · ${contentId.toUpperCase()}`;
  }

  const choices = Array.isArray(payload.choices)
    ? (payload.choices as ResultChoice[]).map((choice) => {
        if (choice.id === "result-shots") {
          return {
            ...choice,
            description: state.modeId === "challenge"
              ? `${wasted} non-kill shots · one miss allowance per chamber`
              : state.modeId === "time-trial"
                ? `${wasted} non-kill shots · +${extraShots} over theoretical minimum`
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
      })
    : payload.choices;

  return { ...payload, subtitle, choices };
}
