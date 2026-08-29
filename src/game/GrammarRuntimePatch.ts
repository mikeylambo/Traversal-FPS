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
  shots: number;
  totalKills: number;
  finishRun: () => void;
  extraKills: () => number;
  wastedShots: () => number;
  ui: {
    updateScreen(screenId: string, payload: Record<string, unknown>): void;
  };
};

/** Keeps legacy core scoring/results in sync as Training and Campaign swap room sets. */
export function enhanceGrammarRuntime(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;

  state.extraKills = () => Math.max(0, state.totalKills - content.activeParKills());

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
