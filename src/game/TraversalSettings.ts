export interface TraversalVisualSettings {
  toonStrength: number;
  rimStrength: number;
  gridStrength: number;
  energyStrength: number;
  fogDensity: number;
  bloomStrength: number;
  exposure: number;
  starTwinkle: number;
}

export interface TraversalSettingsValue {
  mouseSensitivity: number;
  invertY: boolean;
  fov: number;
  aimSmoothing: number;
  reticleScale: number;
  visual: TraversalVisualSettings;
}

// Canonical ROOM 01 lookdev preset, promoted from the first player-tuned pass.
export const DEFAULT_VISUAL_SETTINGS: TraversalVisualSettings = {
  toonStrength: 0.91,
  rimStrength: 1.95,
  gridStrength: 0.70,
  energyStrength: 0.55,
  fogDensity: 0.0135,
  bloomStrength: 0.30,
  exposure: 2.00,
  starTwinkle: 0.82
};

export const DEFAULT_TRAVERSAL_SETTINGS: TraversalSettingsValue = {
  mouseSensitivity: 1,
  invertY: false,
  fov: 92,
  aimSmoothing: 0,
  reticleScale: 1,
  visual: { ...DEFAULT_VISUAL_SETTINGS }
};

type SettingChoice = {
  id: string;
  label: string;
  description?: string;
};

const STORAGE_KEY = "traversal-fps:fps-settings:v2";
const SENSITIVITIES = [0.5, 0.7, 0.85, 1, 1.15, 1.35, 1.6, 2];
const FOVS = [75, 82, 88, 92, 96, 100, 105, 110];
const SMOOTHING = [0, 0.12, 0.25];
const RETICLE_SCALES = [0.8, 1, 1.2, 1.4];

export class TraversalSettingsStore {
  readonly value: TraversalSettingsValue;

  constructor() {
    this.value = this.load();
  }

  choices(): SettingChoice[] {
    const smoothingLabel = this.value.aimSmoothing === 0
      ? "Off"
      : this.value.aimSmoothing <= 0.12 ? "Low" : "Medium";

    return [
      {
        id: "traversal-sensitivity",
        label: `Mouse Sensitivity: ${this.value.mouseSensitivity.toFixed(2)}x`,
        description: "Select to cycle sensitivity"
      },
      {
        id: "traversal-invert-y",
        label: `Invert Y: ${this.value.invertY ? "On" : "Off"}`
      },
      {
        id: "traversal-fov",
        label: `Field of View: ${this.value.fov}°`,
        description: "Select to cycle 75°–110°"
      },
      {
        id: "traversal-aim-smoothing",
        label: `Aim Smoothing: ${smoothingLabel}`,
        description: "Raw input is the default"
      },
      {
        id: "traversal-reticle-scale",
        label: `Reticle Size: ${Math.round(this.value.reticleScale * 100)}%`
      },
      {
        id: "traversal-visual-lab",
        label: "Rendering Lab: Open In-Game",
        description: "Press V or tap LOOKDEV during gameplay to tune the live shader stack"
      }
    ];
  }

  handle(choiceId: string): boolean {
    if (choiceId === "traversal-sensitivity") {
      this.value.mouseSensitivity = this.next(SENSITIVITIES, this.value.mouseSensitivity);
    } else if (choiceId === "traversal-invert-y") {
      this.value.invertY = !this.value.invertY;
    } else if (choiceId === "traversal-fov") {
      this.value.fov = this.next(FOVS, this.value.fov);
    } else if (choiceId === "traversal-aim-smoothing") {
      this.value.aimSmoothing = this.next(SMOOTHING, this.value.aimSmoothing);
    } else if (choiceId === "traversal-reticle-scale") {
      this.value.reticleScale = this.next(RETICLE_SCALES, this.value.reticleScale);
    } else if (choiceId === "traversal-visual-lab") {
      window.dispatchEvent(new CustomEvent("traversal:toggle-visual-lab"));
      return true;
    } else {
      return false;
    }

    this.save();
    return true;
  }

  setVisual<K extends keyof TraversalVisualSettings>(key: K, value: TraversalVisualSettings[K]): void {
    this.value.visual[key] = value;
    this.save();
  }

  resetVisual(): void {
    Object.assign(this.value.visual, DEFAULT_VISUAL_SETTINGS);
    this.save();
  }

  private next(values: number[], current: number): number {
    const exact = values.findIndex((value) => Math.abs(value - current) < 0.001);
    return values[(exact + 1 + values.length) % values.length]!;
  }

  private load(): TraversalSettingsValue {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_TRAVERSAL_SETTINGS, visual: { ...DEFAULT_VISUAL_SETTINGS } };
      const parsed = JSON.parse(raw) as Partial<TraversalSettingsValue>;
      return {
        ...DEFAULT_TRAVERSAL_SETTINGS,
        ...parsed,
        visual: { ...DEFAULT_VISUAL_SETTINGS, ...(parsed.visual ?? {}) }
      };
    } catch {
      return { ...DEFAULT_TRAVERSAL_SETTINGS, visual: { ...DEFAULT_VISUAL_SETTINGS } };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.value));
    } catch {
      // Settings are quality-of-life only; gameplay remains usable if storage is blocked.
    }
  }
}
