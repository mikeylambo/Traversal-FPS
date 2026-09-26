import { LOOK_GROUPS, LOOK_PARAMS, formatLook, type LookKey, type LookSettings } from "./lookSchema";
import { BUILT_IN_PRESETS, deleteUserPreset, loadUserPresets, parsePresetFile, presetFile, saveUserPreset } from "./presets";

/*
 * Look Lab — a live tuning panel generated entirely from LOOK_PARAMS.
 * Host supplies a container and a store; the lab never touches game code.
 */

export interface LookStore {
  get(): LookSettings;
  set(key: LookKey, value: number): void;
  replace(look: LookSettings): void;
}

export interface LookLabOptions {
  title?: string;
  kicker?: string;
  footnote?: string;
  /** Groups rendered expanded on first open. */
  openGroups?: readonly string[];
}

export class LookLab {
  private readonly inputs = new Map<LookKey, { input: HTMLInputElement; output: HTMLOutputElement }>();
  private readonly presetSelect: HTMLSelectElement;
  private readonly status: HTMLElement;

  constructor(private readonly root: HTMLElement, private readonly store: LookStore, options: LookLabOptions = {}) {
    root.replaceChildren();
    root.classList.add("look-lab");

    const header = el("header");
    const titles = el("div");
    titles.append(el("span", "lab-kicker", options.kicker ?? "LIVE RENDER LAB"), el("strong", "", options.title ?? "LOOK ENGINE"));
    header.append(titles);
    root.append(header);

    // Preset bar.
    const bar = el("div", "look-presets");
    this.presetSelect = document.createElement("select");
    this.presetSelect.setAttribute("aria-label", "Look preset");
    this.presetSelect.addEventListener("change", () => this.applyPreset(this.presetSelect.value));
    const actions = el("div", "look-actions");
    actions.append(
      button("SAVE", () => this.savePreset()),
      button("EXPORT", () => this.exportPreset()),
      button("IMPORT", () => this.importPreset()),
      button("DELETE", () => this.deletePreset()),
      button("RESET", () => this.applyPreset("builtin:" + Object.keys(BUILT_IN_PRESETS)[0]))
    );
    bar.append(this.presetSelect, actions);
    root.append(bar);
    this.status = el("span", "look-status");
    root.append(this.status);

    // Grouped sliders.
    const open = new Set(options.openGroups ?? ["Light", "Frame"]);
    const scroller = el("div", "look-groups");
    for (const group of LOOK_GROUPS) {
      const details = document.createElement("details");
      details.open = open.has(group);
      const summary = document.createElement("summary");
      summary.textContent = group.toUpperCase();
      details.append(summary);
      for (const param of LOOK_PARAMS.filter((p) => p.group === group)) {
        const label = document.createElement("label");
        const output = document.createElement("output");
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(param.min);
        input.max = String(param.max);
        input.step = String(param.step);
        input.addEventListener("input", () => {
          const value = Math.min(param.max, Math.max(param.min, Number(input.value)));
          this.store.set(param.key, value);
          output.textContent = formatLook(param, value);
        });
        input.addEventListener("dblclick", () => {
          this.store.set(param.key, param.default);
          this.sync();
        });
        label.append(document.createTextNode(param.label.toUpperCase()), output, input);
        details.append(label);
        this.inputs.set(param.key, { input, output });
      }
      scroller.append(details);
    }
    root.append(scroller);
    if (options.footnote) root.append(el("p", "", options.footnote));

    this.refreshPresets();
    this.sync();
  }

  sync(): void {
    const look = this.store.get();
    for (const param of LOOK_PARAMS) {
      const entry = this.inputs.get(param.key);
      if (!entry) continue;
      entry.input.value = String(look[param.key]);
      entry.output.textContent = formatLook(param, look[param.key]);
    }
  }

  private refreshPresets(selected?: string): void {
    const user = loadUserPresets();
    this.presetSelect.replaceChildren();
    const placeholder = new Option("Presets…", "");
    placeholder.disabled = true;
    this.presetSelect.append(placeholder);
    const builtIn = document.createElement("optgroup");
    builtIn.label = "Built-in";
    Object.keys(BUILT_IN_PRESETS).forEach((name) => builtIn.append(new Option(name, "builtin:" + name)));
    this.presetSelect.append(builtIn);
    if (Object.keys(user).length) {
      const mine = document.createElement("optgroup");
      mine.label = "Saved";
      Object.keys(user).forEach((name) => mine.append(new Option(name, "user:" + name)));
      this.presetSelect.append(mine);
    }
    this.presetSelect.value = selected ?? "";
  }

  private applyPreset(id: string): void {
    const [kind, ...rest] = id.split(":");
    const name = rest.join(":");
    const look = kind === "builtin" ? BUILT_IN_PRESETS[name] : loadUserPresets()[name];
    if (!look) return;
    this.store.replace({ ...look });
    this.sync();
    this.refreshPresets(id);
    this.flash(`Loaded ${name}`);
  }

  private savePreset(): void {
    const name = window.prompt("Name this look")?.trim();
    if (!name) return;
    saveUserPreset(name, this.store.get());
    this.refreshPresets("user:" + name);
    this.flash(`Saved ${name}`);
  }

  private deletePreset(): void {
    const [kind, ...rest] = this.presetSelect.value.split(":");
    if (kind !== "user") return this.flash("Select a saved look to delete");
    deleteUserPreset(rest.join(":"));
    this.refreshPresets();
    this.flash("Deleted");
  }

  private exportPreset(): void {
    const current = this.presetSelect.value.split(":").slice(1).join(":") || "look";
    const blob = new Blob([JSON.stringify(presetFile(current, this.store.get()), null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${current.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "look"}.look.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    this.flash("Exported");
  }

  private importPreset(): void {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = ".json,application/json";
    picker.addEventListener("change", async () => {
      const file = picker.files?.[0];
      if (!file) return;
      try {
        const { name, look } = parsePresetFile(await file.text());
        this.store.replace(look);
        saveUserPreset(name, look);
        this.sync();
        this.refreshPresets("user:" + name);
        this.flash(`Imported ${name}`);
      } catch {
        this.flash("That file isn't a look preset");
      }
    });
    picker.click();
  }

  private flash(text: string): void {
    this.status.textContent = text;
    this.status.classList.add("visible");
    window.setTimeout(() => this.status.classList.remove("visible"), 1600);
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", "look-button", text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}
