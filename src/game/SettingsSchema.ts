export type SettingsTabId = "controls" | "audio" | "display" | "accessibility";

export const NIGHT_AUDIO_CHOICE = "traversal-night-audio";
export const PLAIN_FONT_CHOICE = "traversal-plain-font";

export const SETTINGS_TABS: ReadonlyArray<{
  id: SettingsTabId;
  label: string;
  choices: readonly string[];
}> = [
  {
    id: "controls",
    label: "Controls",
    choices: [
      "traversal-controls", "traversal-sensitivity", "traversal-controller-x",
      "traversal-controller-y", "traversal-controller-accel", "traversal-controller-scope",
      "traversal-controller-move-deadzone", "traversal-controller-deadzone",
      "traversal-invert-x", "traversal-invert-y", "traversal-crouch-mode",
      "traversal-aim-smoothing", "traversal-aim-assist", "traversal-controller-vibration"
    ]
  },
  {
    id: "audio",
    label: "Audio",
    choices: ["master-down", "master-up", "traversal-mono-audio", NIGHT_AUDIO_CHOICE]
  },
  {
    id: "display",
    label: "Display",
    choices: ["traversal-fov", "traversal-reticle-scale", "screen-shake", "fullscreen", "traversal-visual-lab"]
  },
  {
    id: "accessibility",
    label: "Accessibility",
    choices: [
      "traversal-reduce-flash", "traversal-reduce-motion", "traversal-color-profile",
      "traversal-hud-contrast", "traversal-ui-scale", "traversal-text-timing",
      "traversal-cvd-preview", PLAIN_FONT_CHOICE
    ]
  }
];

export const HIDDEN_SHELL_DUPLICATES = new Set(["reduced-motion", "vibration"]);

const TAB_FOR_CHOICE = new Map<string, SettingsTabId>(
  SETTINGS_TABS.flatMap((tab) => tab.choices.map((choice) => [choice, tab.id] as const))
);
const warned = new Set<string>();

export function resolveSettingsTab(id: string, label = ""): SettingsTabId | null {
  const explicit = TAB_FOR_CHOICE.get(id);
  if (explicit) return explicit;

  const text = `${id} ${label}`.toLowerCase();
  if (/(master|music|sfx|audio|volume|mute)/.test(text)) return "audio";
  if (/(access|reduced motion|reduce motion|flash|colour|color|contrast|timed text|font|cvd|ui scale)/.test(text)) return "accessibility";
  if (/(control|input|sensitivity|deadzone|invert|crouch|aim|vibration|binding|preset)/.test(text)) return "controls";
  if (/(display|fullscreen|fov|reticle|screen shake|visual)/.test(text)) return "display";

  if (id && !warned.has(id)) {
    warned.add(id);
    console.warn(`[Traversal settings] Unmapped row kept visible: ${id}`);
  }
  return null;
}
