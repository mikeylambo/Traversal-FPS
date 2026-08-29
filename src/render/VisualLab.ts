import type { TraversalSettingsStore, TraversalVisualSettings } from "../game/TraversalSettings";

const sliderConfig: Array<{
  key: keyof TraversalVisualSettings;
  id: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}> = [
  { key: "toonStrength", id: "look-toon", min: 0, max: 1, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
  { key: "rimStrength", id: "look-rim", min: 0, max: 2.5, step: 0.05, format: (v) => v.toFixed(2) },
  { key: "gridStrength", id: "look-grid", min: 0, max: 1.5, step: 0.02, format: (v) => v.toFixed(2) },
  { key: "energyStrength", id: "look-energy", min: 0.3, max: 2.5, step: 0.05, format: (v) => v.toFixed(2) },
  { key: "fogDensity", id: "look-fog", min: 0.002, max: 0.03, step: 0.0005, format: (v) => v.toFixed(4) },
  { key: "bloomStrength", id: "look-bloom", min: 0, max: 2.2, step: 0.05, format: (v) => v.toFixed(2) },
  { key: "exposure", id: "look-exposure", min: 0.65, max: 2, step: 0.05, format: (v) => v.toFixed(2) }
];

export class VisualLab {
  private readonly panel: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly reset: HTMLButtonElement;
  private visible = false;

  constructor(private readonly settings: TraversalSettingsStore) {
    const panel = document.getElementById("visual-lab");
    const toggle = document.getElementById("visual-lab-toggle") as HTMLButtonElement | null;
    const reset = document.getElementById("visual-lab-reset") as HTMLButtonElement | null;
    if (!panel || !toggle || !reset) throw new Error("Visual Lab DOM is incomplete");

    this.panel = panel;
    this.toggle = toggle;
    this.reset = reset;

    this.toggle.addEventListener("click", () => this.toggleVisible());
    this.reset.addEventListener("click", () => {
      this.settings.resetVisual();
      this.sync();
    });

    for (const config of sliderConfig) {
      const input = document.getElementById(config.id) as HTMLInputElement | null;
      const output = document.getElementById(`${config.id}-value`);
      if (!input || !output) continue;
      input.min = String(config.min);
      input.max = String(config.max);
      input.step = String(config.step);
      input.addEventListener("input", () => {
        const value = Math.min(config.max, Math.max(config.min, Number(input.value)));
        this.settings.setVisual(config.key, value);
        output.textContent = config.format(value);
      });
    }

    window.addEventListener("keydown", (event) => {
      if (event.code === "KeyV" && !event.repeat) this.toggleVisible();
    });
    window.addEventListener("traversal:toggle-visual-lab", () => this.toggleVisible());

    this.sync();
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
    this.sync();
  }

  private sync(): void {
    const visual = this.settings.value.visual;
    for (const config of sliderConfig) {
      const input = document.getElementById(config.id) as HTMLInputElement | null;
      const output = document.getElementById(`${config.id}-value`);
      if (!input || !output) continue;
      const value = visual[config.key];
      input.value = String(value);
      output.textContent = config.format(value);
    }
  }
}
