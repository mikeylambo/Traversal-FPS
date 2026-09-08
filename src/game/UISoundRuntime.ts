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
 *
 * To silence row-to-row navigation entirely, delete the MutationObserver below;
 * confirm and back are independent of it.
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

  // Pointer hover is deliberately silent. A mouse crosses several rows in one
  // gesture, so a per-row tick fires in bursts the player never asked for, and the
  // row's own hover styling already says where the cursor is.
  //
  // Keyboard and controller navigation is different: it is one deliberate step per
  // press with no pointer to follow, so it does tick — quietly. Focus moves are read
  // from the DOM the Shell just rendered.
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
