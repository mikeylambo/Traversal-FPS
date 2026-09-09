const coarsePointer = matchMedia("(pointer: coarse)");

function stabilizeMobileMenu(root: HTMLElement): void {
  const resetForRenderedScreen = () => {
    if (!coarsePointer.matches) return;
    const panel = root.querySelector<HTMLElement>(".slu-panel");
    if (!panel) return;

    // Only run after an actual screen replacement. Do not react to focus-state,
    // slider, or descendant mutations while the player is navigating Settings.
    panel.scrollTop = 0;
    panel.scrollLeft = 0;

    const selection = window.getSelection?.();
    if (selection && !selection.isCollapsed) selection.removeAllRanges();
  };

  let scheduled = false;
  const scheduleReset = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      resetForRenderedScreen();
    });
  };

  // DOMGameUI replaces root.innerHTML when a screen is rendered. Observing only
  // direct child-list changes catches that event without watching every focus/data
  // mutation below the panel (important for iOS/PWA menu responsiveness).
  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === "childList")) scheduleReset();
  });
  observer.observe(root, { childList: true });

  root.addEventListener("pointerdown", (event) => {
    if (!coarsePointer.matches) return;
    const target = event.target as HTMLElement | null;
    if (!target || target.closest("input, textarea, select")) return;
    const selection = window.getSelection?.();
    if (selection && !selection.isCollapsed) selection.removeAllRanges();
  }, { passive: true });

  resetForRenderedScreen();
}

const uiRoot = document.getElementById("ui");
if (uiRoot) stabilizeMobileMenu(uiRoot);
