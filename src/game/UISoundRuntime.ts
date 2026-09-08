import { emitTraversalAudio } from "../audio/TraversalAudio";

type FlowLike = {
  onActivate(screenId: string, choiceId: string): void;
  onBack(screenId: string): void;
};

/**
 * Menu audio, driven off the Shell's rendered rows rather than its internals.
 *
 * The Shell rebuilds a screen after every change and marks the focused row with
 * `data-focused`, so navigation is observed rather than hooked. Nothing here
 * carries information — every sound accompanies a visible change of focus or
 * screen — which is why these cues are the only ones in the manifest allowed to
 * be presentation-only.
 */
export function installUISounds(flow: FlowLike, root: HTMLElement): void {
  const originalActivate = flow.onActivate.bind(flow);
  flow.onActivate = (screenId: string, choiceId: string) => {
    emitTraversalAudio("ui.confirm");
    originalActivate(screenId, choiceId);
  };

  const originalBack = flow.onBack.bind(flow);
  flow.onBack = (screenId: string) => {
    emitTraversalAudio("ui.back");
    originalBack(screenId);
  };

  root.addEventListener("pointerover", (event) => {
    const row = (event.target as HTMLElement | null)?.closest?.("[data-choice-id]");
    if (row instanceof HTMLButtonElement && !row.disabled) emitTraversalAudio("ui.hover");
  });

  // Keyboard and controller navigation never touches the pointer, so focus moves
  // are read from the DOM the Shell just rendered.
  let focused = "";
  const observer = new MutationObserver(() => {
    const current = root.querySelector<HTMLElement>('[data-choice-id][data-focused="true"]');
    const id = current?.dataset.choiceId ?? "";
    if (!id || id === focused) {
      focused = id;
      return;
    }
    focused = id;
    emitTraversalAudio("ui.select");
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-focused"] });
}
