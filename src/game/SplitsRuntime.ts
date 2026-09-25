import type { ContentRuntime } from "./ContentRuntime";

type RuntimeState = {
  modeId: string;
  roomIndex: number;
  totalKills: number;
  runStartedAt: number;
  runComplete: boolean;
  shoot(): void;
  loadRoom(index: number): void;
  beginRun(): void;
  finishRun(): void;
};

const STORAGE_KEY = "traversal:tt-splits:v1";
const SHOW_MS = 1800;

/**
 * Time Trial splits: every required Sphere (and every course change in a Full
 * Run) is a split, compared against the splits of your best finished run. The
 * delta flashes under the clock; a better finish replaces the stored splits.
 * Sign and colour both carry ahead/behind, so it reads in any colour profile.
 */
export function installSplitsRuntime(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  let current: number[] = [];
  let best: number[] | null = null;
  let key = "";
  let hideTimer = 0;

  const active = () => state.modeId === "time-trial";
  const elapsed = () => (performance.now() - state.runStartedAt) / 1000;

  const element = () => {
    let node = document.getElementById("run-split");
    if (!node) {
      node = document.createElement("span");
      node.id = "run-split";
      document.getElementById("metric-panel")?.appendChild(node);
    }
    return node;
  };

  const mark = () => {
    if (!active() || state.runComplete) return;
    const t = elapsed();
    current.push(t);
    const reference = best?.[current.length - 1];
    if (reference === undefined) return;
    const delta = t - reference;
    const node = element();
    node.textContent = `${delta <= 0 ? "−" : "+"}${Math.abs(delta).toFixed(2)}`;
    node.dataset.state = delta <= 0 ? "ahead" : "behind";
    node.classList.add("show");
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => node.classList.remove("show"), SHOW_MS);
  };

  const originalBeginRun = state.beginRun.bind(game);
  state.beginRun = () => {
    originalBeginRun();
    const suite = content.activeSuite();
    key = suite.index === null ? "full" : `course-${suite.index}`;
    current = [];
    best = active() ? readSplits()[key] ?? null : null;
    element().classList.remove("show");
  };

  const originalShoot = state.shoot.bind(game);
  state.shoot = () => {
    const before = state.totalKills;
    originalShoot();
    if (state.totalKills > before) mark();
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  let lastIndex = -1;
  state.loadRoom = (index: number) => {
    const advanced = index === lastIndex + 1 && lastIndex >= 0;
    originalLoadRoom(index);
    if (advanced && current.length) mark();
    lastIndex = index;
  };

  const originalFinishRun = state.finishRun.bind(game);
  state.finishRun = () => {
    const finishing = active() && !state.runComplete;
    if (finishing) mark();
    originalFinishRun();
    if (!finishing || !key) return;
    const total = current[current.length - 1];
    const previous = best?.[best.length - 1];
    if (total !== undefined && (previous === undefined || total < previous)) writeSplits(key, current);
  };
}

function readSplits(): Record<string, number[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, number[]>;
  } catch {
    return {};
  }
}

function writeSplits(key: string, splits: number[]): void {
  try {
    const all = readSplits();
    all[key] = splits.map((value) => Math.round(value * 1000) / 1000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Splits are a convenience; blocked storage just means no comparison.
  }
}
