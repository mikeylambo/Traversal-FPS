import { ROOMS } from "../world/stages";

type RuntimeState = {
  finishRun: () => void;
  ui: {
    updateScreen(screenId: string, payload: Record<string, unknown>): void;
  };
};

/** Keeps legacy core results copy in sync while the prototype's room set evolves. */
export function enhanceGrammarRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  const originalFinishRun = state.finishRun.bind(game);

  state.finishRun = () => {
    const originalUpdateScreen = state.ui.updateScreen.bind(state.ui);
    state.ui.updateScreen = (screenId: string, payload: Record<string, unknown>) => {
      if (screenId === "results" && typeof payload.subtitle === "string") {
        payload = {
          ...payload,
          subtitle: payload.subtitle.replace("Five rooms cleared", `${ROOMS.length} rooms cleared`)
        };
      }
      originalUpdateScreen(screenId, payload);
    };

    try {
      originalFinishRun();
    } finally {
      state.ui.updateScreen = originalUpdateScreen;
    }
  };
}
