import { devToolsEnabled } from "../dev/devTools";
import type { TraversalSettingsStore } from "../game/TraversalSettings";
import { LookLab } from "../lookdev/LookLab";

/**
 * Traversal's host for the Look Lab: binds it to the settings store, the
 * Settings-menu entry, the V key and the authoring-only HUD toggle.
 */
export class VisualLab {
  private readonly panel: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly lab: LookLab;
  private visible = false;

  constructor(private readonly settings: TraversalSettingsStore) {
    const panel = document.getElementById("visual-lab");
    const toggle = document.getElementById("visual-lab-toggle") as HTMLButtonElement | null;
    if (!panel || !toggle) throw new Error("Visual Lab DOM is incomplete");

    this.panel = panel;
    this.toggle = toggle;
    // Players reach the lab through Settings; the floating HUD button is authoring-only.
    this.toggle.hidden = !devToolsEnabled();

    this.lab = new LookLab(panel, {
      get: () => this.settings.value.visual,
      set: (key, value) => this.settings.setVisual(key, value),
      replace: (look) => this.settings.replaceVisual(look)
    }, {
      kicker: "LIVE RENDER LAB",
      title: "LOOK ENGINE",
      footnote: "V toggles this panel. Double-click a slider to restore its default. Looks save locally; export to share or commit."
    });

    this.toggle.addEventListener("click", () => this.toggleVisible());
    window.addEventListener("keydown", (event) => {
      if (event.code === "KeyV" && !event.repeat && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) this.toggleVisible();
    });
    window.addEventListener("traversal:toggle-visual-lab", () => this.toggleVisible());
  }

  isOpen(): boolean {
    return this.visible;
  }

  close(): void {
    if (!this.visible) return;
    this.visible = false;
    this.panel.classList.remove("visible");
    this.toggle.setAttribute("aria-expanded", "false");
  }

  private toggleVisible(): void {
    this.visible = !this.visible;
    if (this.visible && document.pointerLockElement) void document.exitPointerLock?.();
    this.panel.classList.toggle("visible", this.visible);
    this.toggle.setAttribute("aria-expanded", String(this.visible));
    if (this.visible) this.lab.sync();
  }
}
