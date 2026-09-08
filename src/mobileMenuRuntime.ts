const coarsePointer = matchMedia("(pointer: coarse)");

function stabilizeMobileMenu(root: HTMLElement): void {
  const apply = () => {
    if (!coarsePointer.matches) return;
    const panel = root.querySelector<HTMLElement>(".slu-panel");
    if (!panel) return;

    panel.scrollTop = 0;
    panel.scrollLeft = 0;

    const selection = window.getSelection?.();
    if (selection && !selection.isCollapsed) selection.removeAllRanges();
  };

  const observer = new MutationObserver(() => requestAnimationFrame(apply));
  observer.observe(root, { childList: true, subtree: true });

  root.addEventListener("pointerdown", (event) => {
    if (!coarsePointer.matches) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("input, textarea, select")) return;
    window.getSelection?.()?.removeAllRanges();
  }, { passive: true });

  apply();
}

const uiRoot = document.getElementById("ui");
if (uiRoot) stabilizeMobileMenu(uiRoot);
