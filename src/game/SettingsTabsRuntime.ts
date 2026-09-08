import { traversalAudioEngine } from "../audio/TraversalAudioEngine";
import type { TraversalSettingsStore } from "./TraversalSettings";

type FlowLike = {
  onActivate(screenId: string, choiceId: string): void;
  onBack(screenId: string): void;
};

type UILike = {
  move(delta: number): void;
};

type SettingsTabId = "controls" | "audio" | "display" | "accessibility";

type SupplementalSettings = {
  nightAudio: boolean;
  plainFont: boolean;
  firstRunAccessibilitySeen: boolean;
};

const SUPPLEMENTAL_KEY = "traversal-fps:supplemental-accessibility:v1";
const FIRST_RUN_CHOICE = "traversal-first-accessibility";
const NIGHT_AUDIO_CHOICE = "traversal-night-audio";
const PLAIN_FONT_CHOICE = "traversal-plain-font";

const TABS: ReadonlyArray<{ id: SettingsTabId; label: string; choices: readonly string[] }> = [
  {
    id: "controls",
    label: "Controls",
    choices: [
      "traversal-controls",
      "traversal-sensitivity",
      "traversal-controller-x",
      "traversal-controller-y",
      "traversal-controller-accel",
      "traversal-controller-scope",
      "traversal-controller-move-deadzone",
      "traversal-controller-deadzone",
      "traversal-invert-x",
      "traversal-invert-y",
      "traversal-crouch-mode",
      "traversal-aim-smoothing",
      "traversal-aim-assist",
      "traversal-controller-vibration"
    ]
  },
  {
    id: "audio",
    label: "Audio",
    choices: [
      "master-down",
      "master-up",
      "traversal-mono-audio",
      NIGHT_AUDIO_CHOICE
    ]
  },
  {
    id: "display",
    label: "Display",
    choices: [
      "traversal-fov",
      "traversal-reticle-scale",
      "screen-shake",
      "fullscreen",
      "traversal-visual-lab"
    ]
  },
  {
    id: "accessibility",
    label: "Accessibility",
    choices: [
      "traversal-reduce-flash",
      "traversal-reduce-motion",
      "traversal-color-profile",
      "traversal-hud-contrast",
      "traversal-ui-scale",
      "traversal-text-timing",
      "traversal-cvd-preview",
      PLAIN_FONT_CHOICE
    ]
  }
];

const TAB_FOR_CHOICE = new Map<string, SettingsTabId>(
  TABS.flatMap((tab) => tab.choices.map((choice) => [choice, tab.id] as const))
);

// Traversal owns richer versions of these two Shell rows. Hide the duplicates
// rather than asking players to understand why two similarly named switches exist.
const HIDDEN_SHELL_DUPLICATES = new Set(["reduced-motion", "vibration"]);

const lastChoiceByTab: Record<SettingsTabId, string> = {
  controls: "traversal-controls",
  audio: "master-down",
  display: "traversal-fov",
  accessibility: "traversal-reduce-flash"
};

let activeTab: SettingsTabId = "controls";
let supplemental = loadSupplementalSettings();
let showFirstRunAccessibility = !supplemental.firstRunAccessibilitySeen;

export function installSettingsTabsRuntime(
  flow: FlowLike,
  ui: UILike,
  root: HTMLElement,
  settings: TraversalSettingsStore
): void {
  applySupplementalSettings();
  injectStyles();

  const originalActivate = flow.onActivate.bind(flow);
  const originalBack = flow.onBack.bind(flow);

  flow.onActivate = (screenId: string, choiceId: string) => {
    if (screenId === "main-menu") {
      if (showFirstRunAccessibility) {
        showFirstRunAccessibility = false;
        supplemental.firstRunAccessibilitySeen = true;
        saveSupplementalSettings();
      }

      if (choiceId === FIRST_RUN_CHOICE) {
        activeTab = "accessibility";
        originalActivate("main-menu", "settings");
        scheduleDecorate(root, flow, ui);
        return;
      }
    }

    if (screenId === "settings") {
      const tab = TAB_FOR_CHOICE.get(choiceId);
      if (tab) lastChoiceByTab[tab] = choiceId;

      if (choiceId === NIGHT_AUDIO_CHOICE) {
        supplemental.nightAudio = !supplemental.nightAudio;
        saveSupplementalSettings();
        applySupplementalSettings();
        scheduleDecorate(root, flow, ui, true);
        return;
      }

      if (choiceId === PLAIN_FONT_CHOICE) {
        supplemental.plainFont = !supplemental.plainFont;
        saveSupplementalSettings();
        applySupplementalSettings();
        scheduleDecorate(root, flow, ui, true);
        return;
      }
    }

    originalActivate(screenId, choiceId);
    if (screenId === "settings") scheduleDecorate(root, flow, ui, true);
  };

  flow.onBack = (screenId: string) => {
    originalBack(screenId);
  };

  root.addEventListener("focusin", (event) => {
    const target = event.target as HTMLElement | null;
    const choice = target?.closest<HTMLButtonElement>('[data-choice-id]');
    if (!choice?.closest('[data-screen-id="settings"]')) return;
    const id = choice.dataset.choiceId;
    const tab = id ? TAB_FOR_CHOICE.get(id) : undefined;
    if (id && tab === activeTab) lastChoiceByTab[activeTab] = id;
  });

  window.addEventListener("keydown", (event) => {
    if (!isSettingsOpen(root)) return;
    const previous = event.code === "BracketLeft" || event.code === "KeyQ" || event.code === "PageUp";
    const next = event.code === "BracketRight" || event.code === "KeyE" || event.code === "PageDown";
    if (!previous && !next) return;
    event.preventDefault();
    event.stopPropagation();
    switchTab(previous ? -1 : 1, root, flow, ui);
  }, true);

  const observer = new MutationObserver(() => scheduleDecorate(root, flow, ui));
  observer.observe(root, { childList: true, subtree: true });
  scheduleDecorate(root, flow, ui);

  let previousLB = false;
  let previousRB = false;
  let previousStickDirection = 0;
  let stickRepeatAt = 0;
  let frame = 0;

  const pollGamepad = () => {
    const open = isSettingsOpen(root);
    const pad = open ? activeGamepad() : null;

    if (!open || !pad) {
      previousLB = false;
      previousRB = false;
      previousStickDirection = 0;
      frame = requestAnimationFrame(pollGamepad);
      return;
    }

    const lb = Boolean(pad.buttons[4]?.pressed);
    const rb = Boolean(pad.buttons[5]?.pressed);
    if (lb && !previousLB && !rb) switchTab(-1, root, flow, ui);
    if (rb && !previousRB && !lb) switchTab(1, root, flow, ui);
    previousLB = lb;
    previousRB = rb;

    const editing = Boolean(root.querySelector('[data-screen-id="settings"] [data-editing="true"]'));
    if (!editing) {
      const stickY = pad.axes[1] ?? 0;
      const direction = stickY < -0.72 ? -1 : stickY > 0.72 ? 1 : 0;
      const now = performance.now();
      if (direction !== 0 && (direction !== previousStickDirection || now >= stickRepeatAt)) {
        ui.move(direction);
        rememberFocusedChoice(root);
        stickRepeatAt = now + (direction !== previousStickDirection ? 330 : 125);
      }
      previousStickDirection = direction;
    } else {
      previousStickDirection = 0;
    }

    frame = requestAnimationFrame(pollGamepad);
  };

  frame = requestAnimationFrame(pollGamepad);
  window.addEventListener("beforeunload", () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  }, { once: true });

  // Keep a reference to the store in the signature: this runtime is installed only
  // after the Traversal settings store exists, and its tab categories intentionally
  // describe that store's choices rather than becoming a second source of truth.
  void settings;
}

function scheduleDecorate(
  root: HTMLElement,
  flow: FlowLike,
  ui: UILike,
  restoreFocus = false
): void {
  const run = () => {
    decorateFirstRunChoice(root, flow, ui);
    if (!isSettingsOpen(root)) return;
    decorateSettingsScreen(root, flow, ui);
    if (restoreFocus) restoreActiveChoice(root, ui);
  };

  requestAnimationFrame(run);
  window.setTimeout(run, 24);
  if (restoreFocus) window.setTimeout(() => restoreActiveChoice(root, ui), 70);
}

function decorateFirstRunChoice(root: HTMLElement, flow: FlowLike, ui: UILike): void {
  const screen = root.querySelector<HTMLElement>('[data-screen-id="main-menu"]');
  if (!screen) return;
  const choices = screen.querySelector<HTMLElement>(".slu-choices");
  if (!choices) return;

  const existing = choices.querySelector<HTMLButtonElement>(`[data-choice-id="${FIRST_RUN_CHOICE}"]`);
  if (!showFirstRunAccessibility) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const button = makeChoiceButton(
    FIRST_RUN_CHOICE,
    "Accessibility Setup",
    "First run // audio, motion, flash, colour, text and input comfort"
  );
  button.classList.add("settings-first-run-choice");
  button.addEventListener("click", () => flow.onActivate("main-menu", FIRST_RUN_CHOICE));
  choices.prepend(button);
  ui.move(0);
}

function decorateSettingsScreen(root: HTMLElement, flow: FlowLike, ui: UILike): void {
  const screen = root.querySelector<HTMLElement>('[data-screen-id="settings"]');
  if (!screen) return;
  const panel = screen.querySelector<HTMLElement>(".slu-panel");
  const choices = screen.querySelector<HTMLElement>(".slu-choices");
  if (!panel || !choices) return;

  ensureSupplementalChoices(choices, flow);
  ensureTabBar(panel, choices, root, flow, ui);

  screen.dataset.settingsTab = activeTab;
  for (const button of Array.from(choices.querySelectorAll<HTMLButtonElement>("[data-choice-id]"))) {
    const id = button.dataset.choiceId ?? "";
    const duplicate = HIDDEN_SHELL_DUPLICATES.has(id);
    const tab = TAB_FOR_CHOICE.get(id) ?? "display";
    const visible = !duplicate && tab === activeTab;
    button.dataset.settingsTab = tab;
    button.hidden = !visible;
    button.disabled = !visible;
    button.setAttribute("aria-hidden", String(!visible));
  }

  for (const tabButton of Array.from(panel.querySelectorAll<HTMLButtonElement>("[data-settings-tab]"))) {
    const selected = tabButton.dataset.settingsTab === activeTab;
    tabButton.dataset.active = String(selected);
    tabButton.setAttribute("aria-selected", String(selected));
    tabButton.tabIndex = selected ? 0 : -1;
  }

  updateSupplementalLabels(choices);
  restoreActiveChoice(root, ui);
}

function ensureSupplementalChoices(choices: HTMLElement, flow: FlowLike): void {
  let night = choices.querySelector<HTMLButtonElement>(`[data-choice-id="${NIGHT_AUDIO_CHOICE}"]`);
  if (!night) {
    night = makeChoiceButton(NIGHT_AUDIO_CHOICE, "Dynamic Range: Full", "Night mode compresses loud peaks");
    night.addEventListener("click", () => flow.onActivate("settings", NIGHT_AUDIO_CHOICE));
    choices.appendChild(night);
  }

  let font = choices.querySelector<HTMLButtonElement>(`[data-choice-id="${PLAIN_FONT_CHOICE}"]`);
  if (!font) {
    font = makeChoiceButton(PLAIN_FONT_CHOICE, "Plain Font: Off", "Uses a conventional system sans-serif for interface text");
    font.addEventListener("click", () => flow.onActivate("settings", PLAIN_FONT_CHOICE));
    choices.appendChild(font);
  }
}

function updateSupplementalLabels(choices: HTMLElement): void {
  const night = choices.querySelector<HTMLButtonElement>(`[data-choice-id="${NIGHT_AUDIO_CHOICE}"]`);
  const nightLabel = night?.querySelector<HTMLElement>(".slu-choice-label");
  if (nightLabel) nightLabel.textContent = `Dynamic Range: ${supplemental.nightAudio ? "Night" : "Full"}`;

  const font = choices.querySelector<HTMLButtonElement>(`[data-choice-id="${PLAIN_FONT_CHOICE}"]`);
  const fontLabel = font?.querySelector<HTMLElement>(".slu-choice-label");
  if (fontLabel) fontLabel.textContent = `Plain Font: ${supplemental.plainFont ? "On" : "Off"}`;
}

function ensureTabBar(
  panel: HTMLElement,
  choices: HTMLElement,
  root: HTMLElement,
  flow: FlowLike,
  ui: UILike
): void {
  let tabs = panel.querySelector<HTMLElement>(".settings-tabs");
  if (!tabs) {
    tabs = document.createElement("nav");
    tabs.className = "settings-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Settings categories");

    for (const tab of TABS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "settings-tab";
      button.dataset.settingsTab = tab.id;
      button.setAttribute("role", "tab");
      button.textContent = tab.label;
      button.addEventListener("click", () => setTab(tab.id, root, flow, ui));
      tabs.appendChild(button);
    }
    panel.insertBefore(tabs, choices);
  }

  let hint = panel.querySelector<HTMLElement>(".settings-tab-hint");
  if (!hint) {
    hint = document.createElement("div");
    hint.className = "settings-tab-hint";
    hint.textContent = document.body.classList.contains("gamepad-active")
      ? "LB / RB  Tabs   ·   D-pad / Left Stick  Navigate   ·   A  Select   ·   B  Back"
      : "Q / E or [ / ]  Tabs   ·   ↑ / ↓  Navigate   ·   Enter  Select   ·   Esc  Back";
    panel.insertBefore(hint, choices);
  }
}

function switchTab(delta: -1 | 1, root: HTMLElement, flow: FlowLike, ui: UILike): void {
  const index = TABS.findIndex((tab) => tab.id === activeTab);
  const next = TABS[(index + delta + TABS.length) % TABS.length]!;
  setTab(next.id, root, flow, ui);
}

function setTab(tab: SettingsTabId, root: HTMLElement, flow: FlowLike, ui: UILike): void {
  if (activeTab === tab) return;
  rememberFocusedChoice(root);
  activeTab = tab;
  window.dispatchEvent(new CustomEvent("traversal:settings-tab-change", { detail: { tab } }));
  decorateSettingsScreen(root, flow, ui);
  restoreActiveChoice(root, ui);
}

function restoreActiveChoice(root: HTMLElement, ui: UILike): void {
  const screen = root.querySelector<HTMLElement>('[data-screen-id="settings"]');
  if (!screen) return;
  const buttons = Array.from(
    screen.querySelectorAll<HTMLButtonElement>('[data-choice-id]:not(:disabled)')
  );
  if (!buttons.length) return;

  // Normalize the Shell's private focus index against the newly filtered list.
  ui.move(0);
  let currentIndex = buttons.findIndex((button) => button.dataset.focused === "true");
  if (currentIndex < 0) currentIndex = 0;

  const preferred = lastChoiceByTab[activeTab];
  let targetIndex = buttons.findIndex((button) => button.dataset.choiceId === preferred);
  if (targetIndex < 0) targetIndex = 0;
  if (targetIndex !== currentIndex) ui.move(targetIndex - currentIndex);
}

function rememberFocusedChoice(root: HTMLElement): void {
  const focused = root.querySelector<HTMLButtonElement>(
    '[data-screen-id="settings"] [data-choice-id][data-focused="true"]:not(:disabled)'
  );
  const id = focused?.dataset.choiceId;
  const tab = id ? TAB_FOR_CHOICE.get(id) : undefined;
  if (id && tab === activeTab) lastChoiceByTab[activeTab] = id;
}

function makeChoiceButton(id: string, label: string, description: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "slu-choice";
  button.dataset.choiceId = id;

  const labelNode = document.createElement("span");
  labelNode.className = "slu-choice-label";
  labelNode.textContent = label;
  button.appendChild(labelNode);

  const descriptionNode = document.createElement("span");
  descriptionNode.className = "slu-choice-desc";
  descriptionNode.textContent = description;
  button.appendChild(descriptionNode);
  return button;
}

function applySupplementalSettings(): void {
  document.body.classList.toggle("traversal-plain-font", supplemental.plainFont);
  traversalAudioEngine.setNightMode(supplemental.nightAudio);
}

function loadSupplementalSettings(): SupplementalSettings {
  const defaults: SupplementalSettings = {
    nightAudio: false,
    plainFont: false,
    firstRunAccessibilitySeen: false
  };
  try {
    const raw = localStorage.getItem(SUPPLEMENTAL_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Partial<SupplementalSettings>) };
  } catch {
    return defaults;
  }
}

function saveSupplementalSettings(): void {
  try {
    localStorage.setItem(SUPPLEMENTAL_KEY, JSON.stringify(supplemental));
  } catch {
    // Non-essential preference persistence must never block play.
  }
}

function isSettingsOpen(root: HTMLElement): boolean {
  return Boolean(root.querySelector('[data-screen-id="settings"]'));
}

function activeGamepad(): Gamepad | null {
  const pads = navigator.getGamepads?.() ?? [];
  for (const pad of pads) if (pad?.connected) return pad;
  return null;
}

function injectStyles(): void {
  if (document.getElementById("traversal-settings-tabs-style")) return;
  const style = document.createElement("style");
  style.id = "traversal-settings-tabs-style";
  style.textContent = `
    .slu-screen[data-screen-id="settings"] .settings-tabs {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      margin: 14px 0 8px;
    }
    .slu-screen[data-screen-id="settings"] .settings-tab {
      appearance: none;
      min-height: 42px;
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 8px;
      background: rgba(255,255,255,.035);
      color: rgba(232,248,255,.64);
      font: 700 11px/1 "Sora", sans-serif;
      letter-spacing: .11em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .slu-screen[data-screen-id="settings"] .settings-tab[data-active="true"] {
      color: #f4fdff;
      border-color: rgba(129,231,255,.58);
      background: rgba(72,190,224,.12);
      box-shadow: inset 0 -2px 0 rgba(116,231,255,.72);
    }
    .slu-screen[data-screen-id="settings"] .settings-tab:focus-visible {
      outline: 2px solid rgba(167,241,255,.82);
      outline-offset: 2px;
    }
    .slu-screen[data-screen-id="settings"] .settings-tab-hint {
      margin: 0 0 12px;
      color: rgba(214,239,248,.52);
      font: 600 9px/1.5 "Sora", sans-serif;
      letter-spacing: .07em;
      text-transform: uppercase;
    }
    .slu-screen[data-screen-id="settings"] .slu-choice[hidden] {
      display: none !important;
    }
    .settings-first-run-choice {
      border-color: rgba(126,232,255,.46) !important;
      background: rgba(75,190,225,.09) !important;
    }
    .settings-first-run-choice .slu-choice-label::before {
      content: "◇  ";
      color: rgba(143,239,255,.92);
    }
    body.traversal-plain-font .slu-screen,
    body.traversal-plain-font #hud,
    body.traversal-plain-font #tutorial-card,
    body.traversal-plain-font #capture-hint,
    body.traversal-plain-font #mobile-controls,
    body.traversal-plain-font #visual-lab {
      font-family: Arial, Helvetica, system-ui, sans-serif !important;
      letter-spacing: normal !important;
    }
    body.traversal-plain-font .slu-screen *,
    body.traversal-plain-font #hud *,
    body.traversal-plain-font #tutorial-card * {
      font-family: inherit !important;
    }
    @media (max-width: 700px) {
      .slu-screen[data-screen-id="settings"] .settings-tabs {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .slu-screen[data-screen-id="settings"] .settings-tab-hint {
        display: none;
      }
    }
  `;
  document.head.appendChild(style);
}
