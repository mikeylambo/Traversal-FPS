type FlowLike = {
  onActivate(screenId: string, choiceId: string): void;
};

type UILike = {
  move(delta: number): void;
};

/**
 * The pinned Shell rebuilds Settings after every change and resets its internal
 * focus index to zero. Keep the player's selected row stable without forking the
 * verified Shell line used by this project.
 */
export function installSettingsFocusRetention(
  flow: FlowLike,
  ui: UILike,
  root: HTMLElement
): void {
  const originalActivate = flow.onActivate.bind(flow);

  flow.onActivate = (screenId: string, choiceId: string) => {
    originalActivate(screenId, choiceId);
    if (screenId !== "settings") return;
    preserveChoice(choiceId, ui, root);
  };
}

function preserveChoice(choiceId: string, ui: UILike, root: HTMLElement): void {
  let disposed = false;
  let scheduled = false;

  const restore = () => {
    scheduled = false;
    if (disposed) return;
    const screen = root.querySelector<HTMLElement>('[data-screen-id="settings"]');
    if (!screen) return;

    const buttons = Array.from(
      screen.querySelectorAll<HTMLButtonElement>('[data-choice-id]:not(:disabled)')
    );
    const targetIndex = buttons.findIndex((button) => button.dataset.choiceId === choiceId);
    if (targetIndex < 0) return;

    let currentIndex = buttons.findIndex((button) => button.dataset.focused === "true");
    if (currentIndex < 0) currentIndex = 0;
    if (currentIndex !== targetIndex) ui.move(targetIndex - currentIndex);
  };

  const queueRestore = () => {
    if (scheduled || disposed) return;
    scheduled = true;
    requestAnimationFrame(restore);
  };

  const observer = new MutationObserver(queueRestore);
  observer.observe(root, { childList: true, subtree: true });

  for (const delay of [0, 24, 70, 150, 320, 640]) {
    window.setTimeout(restore, delay);
  }

  window.setTimeout(() => {
    disposed = true;
    observer.disconnect();
  }, 900);
}
