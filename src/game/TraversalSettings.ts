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
  controllerSensitivityX: number;
  controllerSensitivityY: number;
  controllerLookAcceleration: number;
  controllerScopeSensitivity: number;
  controllerRightDeadzone: number;
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
  controllerSensitivityX: 6,
  controllerSensitivityY: 5,
  controllerLookAcceleration: 2,
  controllerScopeSensitivity: 0.6,
  controllerRightDeadzone: 0.08,
  visual: { ...DEFAULT_VISUAL_SETTINGS }
};

type SettingChoice = {
  id: string;
  label: string;
  description?: string;
};

const STORAGE_KEY = "traversal-fps:fps-settings:v2";
const SENSITIVITIES = [0.5, 0.7, 0.85, 1, 1.15, 1.35, 1.6, 2];
const CONTROLLER_SENSITIVITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const CONTROLLER_ACCELERATION = [0, 1, 2, 3, 4, 5];
const SCOPE_SENSITIVITIES = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const RIGHT_DEADZONES = [0.05, 0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.2];
const FOVS = [75, 82, 88, 92, 96, 100, 105, 110];
const SMOOTHING = [0, 0.12, 0.25];
const RETICLE_SCALES = [0.8, 1, 1.2, 1.4];

export class TraversalSettingsStore {
  readonly value: TraversalSettingsValue;
  private adjustmentDirection: -1 | 1 = 1;

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
        description: "Select, then adjust left / right"
      },
      {
        id: "traversal-controller-x",
        label: `Horizontal Sensitivity: ${this.value.controllerSensitivityX}`,
        description: "1–10"
      },
      {
        id: "traversal-controller-y",
        label: `Vertical Sensitivity: ${this.value.controllerSensitivityY}`,
        description: "1–10"
      },
      {
        id: "traversal-controller-accel",
        label: `Look Acceleration: ${this.value.controllerLookAcceleration}`,
        description: "0–5"
      },
      {
        id: "traversal-controller-scope",
        label: `Scope Sensitivity: ${this.value.controllerScopeSensitivity.toFixed(2)}x`
      },
      {
        id: "traversal-controller-deadzone",
        label: `Right Stick Deadzone: ${Math.round(this.value.controllerRightDeadzone * 100)}%`,
        description: "Raise only if your stick drifts"
      },
      {
        id: "traversal-invert-y",
        label: `Invert Y: ${this.value.invertY ? "On" : "Off"}`
      },
      {
        id: "traversal-fov",
        label: `Field of View: ${this.value.fov}°`
      },
      {
        id: "traversal-aim-smoothing",
        label: `Aim Smoothing: ${smoothingLabel}`,
        description: "Raw input is default"
      },
      {
        id: "traversal-reticle-scale",
        label: `Reticle Size: ${Math.round(this.value.reticleScale * 100)}%`
      },
      {
        id: "traversal-visual-lab",
        label: "Rendering Lab",
        description: "Open in-game look controls"
      }
    ];
  }

  setAdjustmentDirection(direction: -1 | 1): void {
    this.adjustmentDirection = direction;
  }

  handle(choiceId: string): boolean {
    const direction = this.adjustmentDirection;
    this.adjustmentDirection = 1;

    if (choiceId === "traversal-sensitivity") {
      this.value.mouseSensitivity = this.next(SENSITIVITIES, this.value.mouseSensitivity, direction);
    } else if (choiceId === "traversal-controller-x") {
      this.value.controllerSensitivityX = this.next(CONTROLLER_SENSITIVITIES, this.value.controllerSensitivityX, direction);
    } else if (choiceId === "traversal-controller-y") {
      this.value.controllerSensitivityY = this.next(CONTROLLER_SENSITIVITIES, this.value.controllerSensitivityY, direction);
    } else if (choiceId === "traversal-controller-accel") {
      this.value.controllerLookAcceleration = this.next(CONTROLLER_ACCELERATION, this.value.controllerLookAcceleration, direction);
    } else if (choiceId === "traversal-controller-scope") {
      this.value.controllerScopeSensitivity = this.next(SCOPE_SENSITIVITIES, this.value.controllerScopeSensitivity, direction);
    } else if (choiceId === "traversal-controller-deadzone") {
      this.value.controllerRightDeadzone = this.next(RIGHT_DEADZONES, this.value.controllerRightDeadzone, direction);
    } else if (choiceId === "traversal-invert-y") {
      this.value.invertY = !this.value.invertY;
    } else if (choiceId === "traversal-fov") {
      this.value.fov = this.next(FOVS, this.value.fov, direction);
    } else if (choiceId === "traversal-aim-smoothing") {
      this.value.aimSmoothing = this.next(SMOOTHING, this.value.aimSmoothing, direction);
    } else if (choiceId === "traversal-reticle-scale") {
      this.value.reticleScale = this.next(RETICLE_SCALES, this.value.reticleScale, direction);
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

  private next(values: number[], current: number, direction: -1 | 1): number {
    const exact = values.findIndex((value) => Math.abs(value - current) < 0.001);
    const index = exact >= 0 ? exact : 0;
    return values[(index + direction + values.length) % values.length]!;
  }

  private load(): TraversalSettingsValue {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_TRAVERSAL_SETTINGS, visual: { ...DEFAULT_VISUAL_SETTINGS } };
      const parsed = JSON.parse(raw) as Partial<TraversalSettingsValue>;
      const merged: TraversalSettingsValue = {
        ...DEFAULT_TRAVERSAL_SETTINGS,
        ...parsed,
        visual: { ...DEFAULT_VISUAL_SETTINGS, ...(parsed.visual ?? {}) }
      };

      // v0.10.1 shipped 5/5/2/12% as the untouched controller defaults. If the
      // saved profile still exactly matches those values, migrate it to the more
      // responsive first-play profile without disturbing genuinely tuned setups.
      if (
        parsed.controllerSensitivityX === 5 &&
        parsed.controllerSensitivityY === 5 &&
        parsed.controllerLookAcceleration === 2 &&
        parsed.controllerRightDeadzone === 0.12
      ) {
        merged.controllerSensitivityX = 6;
        merged.controllerSensitivityY = 5;
        merged.controllerRightDeadzone = 0.08;
      }

      return merged;
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
