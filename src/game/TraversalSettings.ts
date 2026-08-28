export interface TraversalSettingsValue {
  mouseSensitivity: number;
  invertY: boolean;
  fov: number;
  aimSmoothing: number;
  reticleScale: number;
}

export const DEFAULT_TRAVERSAL_SETTINGS: TraversalSettingsValue = {
  mouseSensitivity: 1,
  invertY: false,
  fov: 92,
  aimSmoothing: 0,
  reticleScale: 1
};

type SettingChoice = {
  id: string;
  label: string;
  description?: string;
};

const STORAGE_KEY = "traversal-fps:fps-settings:v1";
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
    } else {
      return false;
    }

    this.save();
    return true;
  }

  private next(values: number[], current: number): number {
    const exact = values.findIndex((value) => Math.abs(value - current) < 0.001);
    return values[(exact + 1 + values.length) % values.length]!;
  }

  private load(): TraversalSettingsValue {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_TRAVERSAL_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<TraversalSettingsValue>;
      return { ...DEFAULT_TRAVERSAL_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_TRAVERSAL_SETTINGS };
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
