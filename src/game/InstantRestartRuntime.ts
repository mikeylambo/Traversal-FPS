import { resolveTraversalAction } from "../input/TraversalBindings";
import type { ContentRuntime } from "./ContentRuntime";

type RuntimeState = {
  modeId: string;
  runComplete: boolean;
  input: { consumeReset(): boolean };
  beginRun(): void;
};

/**
 * Time Trial restarts are part of the loop, so they cost nothing: on a single
 * course, Reset restarts the whole run from 0:00 (clock, shots, penalties), and
 * Reset on the results screen is Retry. Full-suite runs keep the per-room reset.
 */
export function installInstantRestart(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  const singleCourse = () => state.modeId === "time-trial" && content.activeSuite().suite === "time-trial" && content.activeSuite().index !== null;

  const consumeReset = state.input.consumeReset.bind(state.input);
  state.input.consumeReset = () => {
    if (!consumeReset()) return false;
    if (!singleCourse()) return true;
    state.beginRun();
    return false;
  };

  window.addEventListener("keydown", (event) => {
    if (event.repeat || !state.runComplete || state.modeId !== "time-trial") return;
    if (!(resolveTraversalAction("reset").keyboardMouse.keys ?? []).includes(event.code)) return;
    document.querySelector<HTMLElement>('[data-choice-id="retry"]')?.click();
  });
}
