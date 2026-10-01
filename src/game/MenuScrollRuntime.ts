/**
 * Controller menu scrolling. The Shell moves a virtual focus (data-focused) with
 * the d-pad and stick, which never scrolls the panel, so long lists (sector
 * select, 25 Time Trial entries) hid the selection off-screen. Keep whatever is
 * focused inside its scrolling panel, and let the right stick scroll freely.
 */
export function installMenuScroll(root: HTMLElement): void {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const reveal = (element: Element | null) => {
    if (!(element instanceof HTMLElement) || !root.contains(element)) return;
    const panel = element.closest<HTMLElement>(".slu-panel");
    if (!panel || panel.scrollHeight <= panel.clientHeight + 1) return;
    const view = panel.getBoundingClientRect();
    const item = element.getBoundingClientRect();
    const margin = Math.min(48, view.height * 0.12);
    let delta = 0;
    if (item.top < view.top + margin) delta = item.top - view.top - margin;
    else if (item.bottom > view.bottom - margin) delta = item.bottom - view.bottom + margin;
    if (Math.abs(delta) < 1) return;
    panel.scrollBy({ top: delta, behavior: reduceMotion.matches ? "auto" : "smooth" });
  };

  new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target as Element;
      if (record.type === "attributes" && target.getAttribute("data-focused") === "true") reveal(target);
    }
  }).observe(root, { subtree: true, attributes: true, attributeFilter: ["data-focused"] });
  root.addEventListener("focusin", (event) => reveal(event.target as Element));

  // Right stick: free scroll for panels whose content is not all focusable.
  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.body.classList.contains("playing")) {
      const pad = [...(navigator.getGamepads?.() ?? [])].find((entry) => entry?.connected);
      const y = pad?.axes[3] ?? 0;
      if (Math.abs(y) > 0.25) {
        const panel = root.querySelector<HTMLElement>(".slu-panel");
        panel?.scrollBy({ top: Math.sign(y) * (Math.abs(y) - 0.25) * 1400 * dt });
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
