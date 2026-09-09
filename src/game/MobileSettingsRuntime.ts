import type { TraversalSettingsStore } from "./TraversalSettings";

type FlowLike = {
  onActivate(screenId: string, choiceId: string): void;
  onBack(screenId: string): void;
};

type UILike = {
  move(delta: number): void;
};

type SettingsTabId = "controls" | "audio" | "display" | "accessibility";

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
    choices: ["master-down", "master-up", "traversal-mono-audio"]
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
      "traversal-cvd-preview"
    ]
  }
];

const TAB_FOR_CHOICE = new Map<string, SettingsTabId>(
  TABS.flatMap((tab) => tab.choices.map((choice) => [choice, tab.id] as const))
);
const HIDDEN_SHELL_DUPLICATES = new Set(["reduced-motion", "vibration"]);
let activeTab: SettingsTabId = "controls";

/**
 * Touch-first settings runtime.
 *
 * The desktop runtime retains keyboard/gamepad focus restoration and continuous
 * controller polling. On iPhone/PWA those loops and subtree mutation passes are
 * unnecessary work, so mobile uses a single root-level render observer and
 * direct tap-to-cycle rows instead.
 */
export function installMobileSettingsRuntime(
  flow: FlowLike,
  ui: UILike,
  root: HTMLElement,
  settings: TraversalSettingsStore
): void {
  const originalActivate = flow.onActivate.bind(flow);

  const decorateSoon = () => requestAnimationFrame(() => decorate(root, flow));

  flow.onActivate = (screenId: string, choiceId: string) => {
    originalActivate(screenId, choiceId);
    if (screenId === "settings" || (screenId === "main-menu" && choiceId === "settings") || (screenId === "pause" && choiceId === "settings")) {
      decorateSoon();
    }
  };

  const observer = new MutationObserver(() => {
    if (root.querySelector('[data-screen-id="settings"]')) decorateSoon();
  });
  observer.observe(root, { childList: true });

  injectStyles();
  decorateSoon();
  window.addEventListener("beforeunload", () => observer.disconnect(), { once: true });

  // Retained in the signature intentionally: TraversalSettings remains the single
  // source of truth, while taps route through the existing flow/handler contract.
  void settings;
  void ui;
}

function decorate(root: HTMLElement, flow: FlowLike): void {
  const screen = root.querySelector<HTMLElement>('[data-screen-id="settings"]');
  if (!screen) return;
  const panel = screen.querySelector<HTMLElement>(".slu-panel");
  const choices = screen.querySelector<HTMLElement>(".slu-choices");
  if (!panel || !choices) return;

  let tabs = panel.querySelector<HTMLElement>(".settings-tabs");
  if (!tabs) {
    tabs = document.createElement("nav");
    tabs.className = "settings-tabs mobile-settings-tabs";
    tabs.setAttribute("aria-label", "Settings categories");
    for (const tab of TABS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "settings-tab";
      button.dataset.settingsTab = tab.id;
      button.textContent = tab.label;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (activeTab === tab.id) return;
        activeTab = tab.id;
        decorate(root, flow);
      });
      tabs.appendChild(button);
    }
    panel.insertBefore(tabs, choices);
  }

  screen.dataset.settingsTab = activeTab;
  for (const button of Array.from(choices.querySelectorAll<HTMLButtonElement>("[data-choice-id]"))) {
    const id = button.dataset.choiceId ?? "";
    const duplicate = HIDDEN_SHELL_DUPLICATES.has(id);
    const tab = TAB_FOR_CHOICE.get(id) ?? "display";
    const visible = !duplicate && tab === activeTab;
    button.hidden = !visible;
    button.disabled = !visible;
    button.setAttribute("aria-hidden", String(!visible));
  }

  for (const tabButton of Array.from(tabs.querySelectorAll<HTMLButtonElement>("[data-settings-tab]"))) {
    const selected = tabButton.dataset.settingsTab === activeTab;
    tabButton.dataset.active = String(selected);
    tabButton.setAttribute("aria-selected", String(selected));
  }

  panel.scrollTop = 0;
}

function injectStyles(): void {
  if (document.getElementById("traversal-mobile-settings-style")) return;
  const style = document.createElement("style");
  style.id = "traversal-mobile-settings-style";
  style.textContent = `
    @media (pointer: coarse) and (orientation: landscape) {
      .slu-screen[data-screen-id="settings"] .mobile-settings-tabs {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 3px;
        margin: 2px 0 5px;
      }
      .slu-screen[data-screen-id="settings"] .mobile-settings-tabs .settings-tab {
        appearance: none;
        min-height: 30px;
        padding: 5px 6px;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 0;
        background: rgba(255,255,255,.025);
        color: rgba(232,248,255,.64);
        font: 700 9px/1 "Sora", sans-serif;
        letter-spacing: .08em;
        text-transform: uppercase;
        touch-action: manipulation;
      }
      .slu-screen[data-screen-id="settings"] .mobile-settings-tabs .settings-tab[data-active="true"] {
        color: #f4fdff;
        border-color: rgba(129,231,255,.58);
        background: rgba(72,190,224,.10);
      }
      .slu-screen[data-screen-id="settings"] .slu-choice[hidden] {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}
