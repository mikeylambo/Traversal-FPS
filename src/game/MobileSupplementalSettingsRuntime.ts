import { traversalAudioEngine } from "../audio/TraversalAudioEngine";
import { NIGHT_AUDIO_CHOICE, PLAIN_FONT_CHOICE } from "./SettingsSchema";

type FlowLike = { onActivate(screenId: string, choiceId: string): void };
type SupplementalSettings = { nightAudio: boolean; plainFont: boolean; firstRunAccessibilitySeen: boolean };

const KEY = "traversal-fps:supplemental-accessibility:v1";
let value = load();

export function installMobileSupplementalSettingsRuntime(flow: FlowLike, root: HTMLElement): void {
  apply();
  injectStyle();
  const originalActivate = flow.onActivate.bind(flow);

  flow.onActivate = (screenId: string, choiceId: string) => {
    if (screenId === "settings" && choiceId === NIGHT_AUDIO_CHOICE) {
      value.nightAudio = !value.nightAudio;
      save(); apply(); decorate(root, flow); return;
    }
    if (screenId === "settings" && choiceId === PLAIN_FONT_CHOICE) {
      value.plainFont = !value.plainFont;
      save(); apply(); decorate(root, flow); return;
    }
    originalActivate(screenId, choiceId);
    if (choiceId === "settings" || screenId === "settings") requestAnimationFrame(() => decorate(root, flow));
  };

  const observer = new MutationObserver(() => {
    if (root.querySelector('[data-screen-id="settings"]')) requestAnimationFrame(() => decorate(root, flow));
  });
  observer.observe(root, { childList: true, subtree: true });
  requestAnimationFrame(() => decorate(root, flow));
  window.addEventListener("beforeunload", () => observer.disconnect(), { once: true });
}

function decorate(root: HTMLElement, flow: FlowLike): void {
  const choices = root.querySelector<HTMLElement>('[data-screen-id="settings"] .slu-choices');
  if (!choices) return;
  ensureChoice(choices, NIGHT_AUDIO_CHOICE, `Dynamic Range: ${value.nightAudio ? "Night" : "Full"}`, "Night mode compresses loud peaks", flow);
  ensureChoice(choices, PLAIN_FONT_CHOICE, `Plain Font: ${value.plainFont ? "On" : "Off"}`, "Uses a conventional system sans-serif for interface text", flow);
  setLabel(choices, NIGHT_AUDIO_CHOICE, `Dynamic Range: ${value.nightAudio ? "Night" : "Full"}`);
  setLabel(choices, PLAIN_FONT_CHOICE, `Plain Font: ${value.plainFont ? "On" : "Off"}`);
}

function ensureChoice(choices: HTMLElement, id: string, label: string, description: string, flow: FlowLike): void {
  if (choices.querySelector(`[data-choice-id="${id}"]`)) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "slu-choice";
  button.dataset.choiceId = id;
  const labelNode = document.createElement("span");
  labelNode.className = "slu-choice-label";
  labelNode.textContent = label;
  const desc = document.createElement("span");
  desc.className = "slu-choice-desc";
  desc.textContent = description;
  button.append(labelNode, desc);
  button.addEventListener("click", () => flow.onActivate("settings", id));
  choices.appendChild(button);
}

function setLabel(root: HTMLElement, id: string, label: string): void {
  const node = root.querySelector<HTMLElement>(`[data-choice-id="${id}"] .slu-choice-label`);
  if (node) node.textContent = label;
}

function apply(): void {
  document.body.classList.toggle("traversal-plain-font", value.plainFont);
  traversalAudioEngine.setNightMode(value.nightAudio);
}

function load(): SupplementalSettings {
  const defaults: SupplementalSettings = { nightAudio: false, plainFont: false, firstRunAccessibilitySeen: false };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<SupplementalSettings>) } : defaults;
  } catch { return defaults; }
}

function save(): void {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* optional preference */ }
}

function injectStyle(): void {
  if (document.getElementById("traversal-mobile-plain-font-style")) return;
  const style = document.createElement("style");
  style.id = "traversal-mobile-plain-font-style";
  style.textContent = `
    body.traversal-plain-font .slu-screen,
    body.traversal-plain-font #hud,
    body.traversal-plain-font #tutorial-card,
    body.traversal-plain-font #capture-hint,
    body.traversal-plain-font #mobile-controls,
    body.traversal-plain-font #visual-lab { font-family: Arial, Helvetica, system-ui, sans-serif !important; letter-spacing: normal !important; }
    body.traversal-plain-font .slu-screen *, body.traversal-plain-font #hud *, body.traversal-plain-font #tutorial-card * { font-family: inherit !important; }
  `;
  document.head.appendChild(style);
}
