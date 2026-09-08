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

/**
 * Perceptual access settings.
 *
 * The fairness constitution says the game should never punish missing information
 * it did not give equal access to. That has always governed spatial fairness —
 * ground cues, exit gates, landing rings. These extend the same rule to players
 * whose access is limited by photosensitivity, motion sensitivity, colour vision
 * deficiency, hearing, or text legibility, and they live on the same Settings
 * screen as every other option rather than in a separate accessibility menu.
 */
export type ColorProfile = "standard" | "deuteranopia" | "protanopia" | "tritanopia";
export type CvdPreview = "off" | "deuteranopia" | "protanopia" | "tritanopia";
export type AimAssistStrength = "off" | "low" | "standard" | "strong";

export interface TraversalAccessibilitySettings {
  /** Caps flash intensity and disables the transit saturation/brightness pulse. */
  reduceFlash: boolean;
  /** Dampens screen shake and the warp FOV punch without touching render quality. */
  reduceMotion: boolean;
  /** Folds the final stereo master to identical left/right information. */
  monoAudio: boolean;
  /** Enables controller vibration where the browser/gamepad supports it. */
  haptics: boolean;
  /** Multiplier for tutorial cards and transient gameplay confirmation text. */
  timedTextScale: number;
  /** Re-hues colour-coded systems for a specific CVD. Shape cues are always on. */
  colorProfile: ColorProfile;
  hudContrast: "standard" | "high";
  /** Multiplier on HUD/tutorial text size. */
  uiScale: number;
  /** Authoring aid: simulates a CVD over the whole frame so palettes can self-check. */
  cvdPreview: CvdPreview;
}

export interface TraversalSettingsValue {
  mouseSensitivity: number;
  invertX: boolean;
  invertY: boolean;
  crouchToggle: boolean;
  fov: number;
  aimSmoothing: number;
  aimAssist: AimAssistStrength;
  reticleScale: number;
  controllerSensitivityX: number;
  controllerSensitivityY: number;
  controllerLookAcceleration: number;
  controllerScopeSensitivity: number;
  controllerMoveDeadzone: number;
  controllerRightDeadzone: number;
  visual: TraversalVisualSettings;
  accessibility: TraversalAccessibilitySettings;
}

let activeStore: TraversalSettingsStore | null = null;

export function activeTraversalSettingsStore(): TraversalSettingsStore | null {
  return activeStore;
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

/**
 * Reduce Flash and Reduce Motion default to the operating system preference on a
 * first run. A player who has already told their OS they need this should not have
 * to find a menu before the game is safe to look at.
 */
function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export const DEFAULT_ACCESSIBILITY_SETTINGS: TraversalAccessibilitySettings = {
  reduceFlash: false,
  reduceMotion: false,
  monoAudio: false,
  haptics: true,
  timedTextScale: 1,
  colorProfile: "standard",
  hudContrast: "standard",
  uiScale: 1,
  cvdPreview: "off"
};

export const DEFAULT_TRAVERSAL_SETTINGS: TraversalSettingsValue = {
  mouseSensitivity: 1,
  invertX: false,
  invertY: false,
  crouchToggle: false,
  fov: 92,
  aimSmoothing: 0,
  aimAssist: "standard",
  reticleScale: 1,
  controllerSensitivityX: 6,
  controllerSensitivityY: 5,
  controllerLookAcceleration: 2,
  controllerScopeSensitivity: 0.6,
  controllerMoveDeadzone: 0.18,
  controllerRightDeadzone: 0.10,
  visual: { ...DEFAULT_VISUAL_SETTINGS },
  accessibility: { ...DEFAULT_ACCESSIBILITY_SETTINGS }
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
const MOVE_DEADZONES = [0.12, 0.14, 0.16, 0.18, 0.20, 0.22, 0.24, 0.28];
const RIGHT_DEADZONES = [0.05, 0.08, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20];
const FOVS = [75, 82, 88, 92, 96, 100, 105, 110];
const SMOOTHING = [0, 0.12, 0.25];
const RETICLE_SCALES = [0.8, 1, 1.2, 1.4];
const UI_SCALES = [0.9, 1, 1.1, 1.25, 1.4, 1.6];
const TEXT_TIMING_SCALES = [1, 2, 5, 10];
const AIM_ASSIST_STRENGTHS: AimAssistStrength[] = ["off", "low", "standard", "strong"];
const COLOR_PROFILES: ColorProfile[] = ["standard", "deuteranopia", "protanopia", "tritanopia"];
const CVD_PREVIEWS: CvdPreview[] = ["off", "deuteranopia", "protanopia", "tritanopia"];
const ACCESSIBILITY_EVENT = "traversal:accessibility-changed";

const PROFILE_LABELS: Record<ColorProfile, string> = {
  standard: "Standard",
  deuteranopia: "Deuteranopia",
  protanopia: "Protanopia",
  tritanopia: "Tritanopia"
};

const AIM_ASSIST_LABELS: Record<AimAssistStrength, string> = {
  off: "Off",
  low: "Low",
  standard: "Standard",
  strong: "Strong"
};

export class TraversalSettingsStore {
  readonly value: TraversalSettingsValue;
  private adjustmentDirection: -1 | 1 = 1;

  constructor() {
    this.value = this.load();
    activeStore = this;
  }

  choices(): SettingChoice[] {
    const access = this.value.accessibility;
    const smoothingLabel = this.value.aimSmoothing === 0
      ? "Off"
      : this.value.aimSmoothing <= 0.12 ? "Low" : "Medium";

    return [
      {
        id: "traversal-controls",
        label: "Controls",
        description: "Keyboard, mouse & controller bindings"
      },
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
        id: "traversal-controller-move-deadzone",
        label: `Move Stick Deadzone: ${Math.round(this.value.controllerMoveDeadzone * 100)}%`,
        description: "Raise if movement drifts"
      },
      {
        id: "traversal-controller-deadzone",
        label: `Look Stick Deadzone: ${Math.round(this.value.controllerRightDeadzone * 100)}%`,
        description: "Raise if camera drifts"
      },
      {
        id: "traversal-invert-x",
        label: `Invert X: ${this.value.invertX ? "On" : "Off"}`
      },
      {
        id: "traversal-invert-y",
        label: `Invert Y: ${this.value.invertY ? "On" : "Off"}`
      },
      {
        id: "traversal-crouch-mode",
        label: `Crouch: ${this.value.crouchToggle ? "Toggle" : "Hold"}`
      },
      {
        id: "traversal-controller-vibration",
        label: `Controller Vibration: ${access.haptics ? "On" : "Off"}`
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
        id: "traversal-aim-assist",
        label: `Aim Assist: ${AIM_ASSIST_LABELS[this.value.aimAssist]}`,
        description: "Controller and touch camera assistance. Shots stay exact"
      },
      {
        id: "traversal-reticle-scale",
        label: `Reticle Size: ${Math.round(this.value.reticleScale * 100)}%`
      },
      {
        id: "traversal-mono-audio",
        label: `Mono Audio: ${access.monoAudio ? "On" : "Off"}`,
        description: "Same spatial information in both channels"
      },
      {
        id: "traversal-reduce-flash",
        label: `Reduce Flash: ${access.reduceFlash ? "On" : "Off"}`,
        description: "Caps warp, hazard and impact flashes for photosensitivity"
      },
      {
        id: "traversal-reduce-motion",
        label: `Reduce Motion: ${access.reduceMotion ? "On" : "Off"}`,
        description: "Dampens screen shake and the warp FOV punch. Visual quality is unchanged"
      },
      {
        id: "traversal-color-profile",
        label: `Colour Profile: ${PROFILE_LABELS[access.colorProfile]}`,
        description: "Re-hues hazards and actors. Shape and pulse cues stay on in every profile"
      },
      {
        id: "traversal-hud-contrast",
        label: `HUD Contrast: ${access.hudContrast === "high" ? "High" : "Standard"}`,
        description: "Solid panels behind HUD and tutorial text"
      },
      {
        id: "traversal-ui-scale",
        label: `UI Text Scale: ${Math.round(access.uiScale * 100)}%`
      },
      {
        id: "traversal-text-timing",
        label: `Timed Text: ${access.timedTextScale}x`,
        description: "Extends tutorial and gameplay confirmation text"
      },
      {
        id: "traversal-cvd-preview",
        label: `Colour Vision Preview: ${access.cvdPreview === "off" ? "Off" : PROFILE_LABELS[access.cvdPreview]}`,
        description: "Simulates a colour vision deficiency over the whole frame while you play"
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

    if (choiceId === "traversal-controls") {
      // The Shell redraws Settings after extension handlers. Queue the Controls
      // screen for the next task so it becomes the final visible screen.
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("traversal:open-controls"));
      }, 0);
      return true;
    }
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
    } else if (choiceId === "traversal-controller-move-deadzone") {
      this.value.controllerMoveDeadzone = this.next(MOVE_DEADZONES, this.value.controllerMoveDeadzone, direction);
    } else if (choiceId === "traversal-controller-deadzone") {
      this.value.controllerRightDeadzone = this.next(RIGHT_DEADZONES, this.value.controllerRightDeadzone, direction);
    } else if (choiceId === "traversal-invert-x") {
      this.value.invertX = !this.value.invertX;
    } else if (choiceId === "traversal-invert-y") {
      this.value.invertY = !this.value.invertY;
    } else if (choiceId === "traversal-crouch-mode") {
      this.value.crouchToggle = !this.value.crouchToggle;
    } else if (choiceId === "traversal-controller-vibration") {
      this.setAccessibility("haptics", !this.value.accessibility.haptics);
      return true;
    } else if (choiceId === "traversal-fov") {
      this.value.fov = this.next(FOVS, this.value.fov, direction);
    } else if (choiceId === "traversal-aim-smoothing") {
      this.value.aimSmoothing = this.next(SMOOTHING, this.value.aimSmoothing, direction);
    } else if (choiceId === "traversal-aim-assist") {
      this.value.aimAssist = cycle(AIM_ASSIST_STRENGTHS, this.value.aimAssist, direction);
    } else if (choiceId === "traversal-reticle-scale") {
      this.value.reticleScale = this.next(RETICLE_SCALES, this.value.reticleScale, direction);
    } else if (choiceId === "traversal-mono-audio") {
      this.setAccessibility("monoAudio", !this.value.accessibility.monoAudio);
      return true;
    } else if (choiceId === "traversal-reduce-flash") {
      this.setAccessibility("reduceFlash", !this.value.accessibility.reduceFlash);
      return true;
    } else if (choiceId === "traversal-reduce-motion") {
      this.setAccessibility("reduceMotion", !this.value.accessibility.reduceMotion);
      return true;
    } else if (choiceId === "traversal-color-profile") {
      this.setAccessibility("colorProfile", cycle(COLOR_PROFILES, this.value.accessibility.colorProfile, direction));
      return true;
    } else if (choiceId === "traversal-hud-contrast") {
      this.setAccessibility("hudContrast", this.value.accessibility.hudContrast === "high" ? "standard" : "high");
      return true;
    } else if (choiceId === "traversal-ui-scale") {
      this.setAccessibility("uiScale", this.next(UI_SCALES, this.value.accessibility.uiScale, direction));
      return true;
    } else if (choiceId === "traversal-text-timing") {
      this.setAccessibility("timedTextScale", this.next(TEXT_TIMING_SCALES, this.value.accessibility.timedTextScale, direction));
      return true;
    } else if (choiceId === "traversal-cvd-preview") {
      this.setAccessibility("cvdPreview", cycle(CVD_PREVIEWS, this.value.accessibility.cvdPreview, direction));
      return true;
    } else if (choiceId === "traversal-visual-lab") {
      window.dispatchEvent(new CustomEvent("traversal:toggle-visual-lab"));
      return true;
    } else {
      return false;
    }

    this.save();
    return true;
  }

  setAccessibility<K extends keyof TraversalAccessibilitySettings>(
    key: K,
    value: TraversalAccessibilitySettings[K]
  ): void {
    this.value.accessibility[key] = value;
    this.save();
    // Presentation runtimes re-read the snapshot rather than being handed one, so
    // a single notification keeps DOM classes, CSS vars and world colours in step.
    window.dispatchEvent(new CustomEvent(ACCESSIBILITY_EVENT));
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
      if (!raw) return this.freshDefaults();
      const parsed = JSON.parse(raw) as Partial<TraversalSettingsValue>;
      const merged: TraversalSettingsValue = {
        ...DEFAULT_TRAVERSAL_SETTINGS,
        ...parsed,
        visual: { ...DEFAULT_VISUAL_SETTINGS, ...(parsed.visual ?? {}) },
        accessibility: {
          ...DEFAULT_ACCESSIBILITY_SETTINGS,
          // A profile saved before accessibility existed still inherits the OS
          // preference rather than silently opting the player back into flashes.
          reduceFlash: prefersReducedMotion(),
          reduceMotion: prefersReducedMotion(),
          ...(parsed.accessibility ?? {})
        }
      };

      // v0.10.1 shipped 5/5/2/12% as the untouched controller defaults. If the
      // saved profile still exactly matches those values, migrate it without
      // disturbing genuinely tuned setups.
      if (
        parsed.controllerSensitivityX === 5 &&
        parsed.controllerSensitivityY === 5 &&
        parsed.controllerLookAcceleration === 2 &&
        parsed.controllerRightDeadzone === 0.12
      ) {
        merged.controllerSensitivityX = 6;
        merged.controllerSensitivityY = 5;
        merged.controllerRightDeadzone = DEFAULT_TRAVERSAL_SETTINGS.controllerRightDeadzone;
      } else if (
        parsed.controllerSensitivityX === 6 &&
        parsed.controllerSensitivityY === 5 &&
        parsed.controllerLookAcceleration === 2 &&
        parsed.controllerRightDeadzone === 0.08
      ) {
        // v0.10.2's untouched look profile gets the small USB-controller drift
        // guard. Custom profiles stay untouched.
        merged.controllerRightDeadzone = DEFAULT_TRAVERSAL_SETTINGS.controllerRightDeadzone;
      }

      return merged;
    } catch {
      return this.freshDefaults();
    }
  }

  private freshDefaults(): TraversalSettingsValue {
    const reduced = prefersReducedMotion();
    return {
      ...DEFAULT_TRAVERSAL_SETTINGS,
      visual: { ...DEFAULT_VISUAL_SETTINGS },
      accessibility: { ...DEFAULT_ACCESSIBILITY_SETTINGS, reduceFlash: reduced, reduceMotion: reduced }
    };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.value));
    } catch {
      // Settings are quality-of-life only; gameplay remains usable if storage is blocked.
    }
  }
}

function cycle<T>(values: readonly T[], current: T, direction: -1 | 1): T {
  const index = Math.max(0, values.indexOf(current));
  return values[(index + direction + values.length) % values.length]!;
}
