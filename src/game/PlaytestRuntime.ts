import { CAMPAIGN_MAPS } from "../world/campaign";
import type { ContentRuntime } from "./ContentRuntime";

export type PlaytestFlag = "good" | "issue" | "revisit";

type Vec3Like = { x: number; y: number; z: number };

type RuntimeState = {
  modeId: string;
  roomIndex: number;
  roomKills: number;
  totalKills: number;
  shots: number;
  targetHits: number;
  warps: number;
  roomRestarts: number;
  runStartedAt: number;
  camera: { position: Vec3Like };
  warp: { selectionPercent(): number; hasAnchor(): boolean };
  beginRun(): void;
  finishRun(): void;
  loadRoom(index: number): void;
};

type PlaytestEvent = {
  at: number;
  kind: "run-start" | "run-finish" | "failure" | "flag" | "skip" | "restart" | "utility";
  contentId: string;
  modeId: string;
  roomIndex: number;
  position?: [number, number, number];
  elapsedSeconds?: number;
  shots?: number;
  kills?: number;
  warps?: number;
  flag?: PlaytestFlag;
  note?: string;
  actorId?: string;
  effect?: string;
};

const STORAGE_KEY = "traversal-playtest:v1";
const MAX_EVENTS = 1200;

/**
 * Development-only instrumentation for rapid authored-content playtesting.
 * No gameplay authority lives here: this runtime only observes, records and
 * invokes existing reset/load hooks.
 */
export function installPlaytestRuntime(game: object, content: ContentRuntime): void {
  if (!import.meta.env.DEV) return;

  const state = game as unknown as RuntimeState;
  const hud = buildHud();
  const firedUtility = new Set<string>();
  let visible = localStorage.getItem("traversal-playtest-hud") !== "0";
  let lastRestarts = state.roomRestarts ?? 0;
  let lastContentId = content.selectedContentId();
  let lastRoomIndex = state.roomIndex ?? 0;
  let lastTick = 0;
  let suppressFailureOnce = false;

  const setVisible = (next: boolean) => {
    visible = next;
    hud.root.hidden = !next;
    localStorage.setItem("traversal-playtest-hud", next ? "1" : "0");
  };
  setVisible(visible);

  const position = (): [number, number, number] => {
    const p = state.camera?.position ?? { x: 0, y: 0, z: 0 };
    return [round(p.x), round(p.y), round(p.z)];
  };

  const record = (event: Omit<PlaytestEvent, "at" | "contentId" | "modeId" | "roomIndex"> & Partial<Pick<PlaytestEvent, "contentId" | "modeId" | "roomIndex">>) => {
    const events = readEvents();
    events.push({
      at: Date.now(),
      contentId: event.contentId ?? content.selectedContentId(),
      modeId: event.modeId ?? state.modeId ?? "unknown",
      roomIndex: event.roomIndex ?? state.roomIndex ?? 0,
      ...event
    });
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  };

  const flash = (text: string) => {
    hud.toast.textContent = text;
    hud.toast.classList.remove("show");
    void hud.toast.offsetWidth;
    hud.toast.classList.add("show");
    window.setTimeout(() => hud.toast.classList.remove("show"), 1100);
  };

  const flag = (value: PlaytestFlag) => {
    const note = window.prompt(`${value.toUpperCase()} // optional note`, "") ?? "";
    record({ kind: "flag", flag: value, note: note.trim(), position: position() });
    flash(`${value.toUpperCase()} SAVED`);
  };

  const restart = () => {
    record({ kind: "restart", position: position() });
    suppressFailureOnce = true;
    state.roomRestarts += 1;
    state.loadRoom(state.roomIndex);
    flash("ROOM RESTARTED");
  };

  const next = () => {
    const rooms = content.activeRooms();
    if (state.roomIndex < rooms.length - 1) {
      record({ kind: "skip", position: position() });
      state.loadRoom(state.roomIndex + 1);
      flash("NEXT ROOM");
      return;
    }

    if (state.modeId === "standard" && content.activeForm() === "campaign-field") {
      const currentIndex = CAMPAIGN_MAPS.findIndex((entry) => entry.id === content.selectedContentId());
      const nextMap = currentIndex >= 0
        ? CAMPAIGN_MAPS.slice(currentIndex + 1).find((entry) => entry.implemented)
        : undefined;
      if (nextMap) {
        record({ kind: "skip", position: position() });
        content.setSelectedMap(nextMap.id);
        content.reloadSelected();
        state.beginRun();
        flash(`NEXT // ${nextMap.label}`);
        return;
      }
    }

    flash("END OF ACTIVE CONTENT");
  };

  hud.good.addEventListener("click", () => flag("good"));
  hud.issue.addEventListener("click", () => flag("issue"));
  hud.revisit.addEventListener("click", () => flag("revisit"));
  hud.restart.addEventListener("click", restart);
  hud.next.addEventListener("click", next);
  hud.toggle.addEventListener("click", () => setVisible(false));

  window.addEventListener("keydown", (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (!["d", "r", "n", "1", "2", "3"].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (key === "d") setVisible(!visible);
    if (key === "r") restart();
    if (key === "n") next();
    if (key === "1") flag("good");
    if (key === "2") flag("issue");
    if (key === "3") flag("revisit");
  }, true);

  window.addEventListener("traversal:puzzle-actor", ((event: CustomEvent) => {
    const detail = event.detail ?? {};
    if (detail.actorId) firedUtility.add(String(detail.actorId));
    record({
      kind: "utility",
      actorId: detail.actorId ? String(detail.actorId) : undefined,
      effect: detail.effect?.type ? String(detail.effect.type) : undefined,
      position: position()
    });
  }) as EventListener);

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    const sameRoom = index === state.roomIndex;
    const failurePosition = position();
    const restartCount = state.roomRestarts ?? 0;
    if (sameRoom && restartCount > lastRestarts) {
      if (!suppressFailureOnce) record({ kind: "failure", position: failurePosition });
      suppressFailureOnce = false;
      lastRestarts = restartCount;
    }
    if (!sameRoom) firedUtility.clear();
    originalLoadRoom(index);
  };

  const originalBeginRun = state.beginRun.bind(game);
  state.beginRun = () => {
    originalBeginRun();
    firedUtility.clear();
    lastRestarts = state.roomRestarts;
    lastContentId = content.selectedContentId();
    lastRoomIndex = state.roomIndex;
    record({ kind: "run-start", position: position() });
  };

  const originalFinishRun = state.finishRun.bind(game);
  state.finishRun = () => {
    record({
      kind: "run-finish",
      position: position(),
      elapsedSeconds: Math.max(0, (performance.now() - state.runStartedAt) / 1000),
      shots: state.shots,
      kills: state.totalKills,
      warps: state.warps
    });
    originalFinishRun();
  };

  const tick = () => {
    const now = performance.now();
    if (now - lastTick > 90) {
      lastTick = now;
      const currentContentId = content.selectedContentId();
      const room = content.activeRooms()[state.roomIndex];
      if (currentContentId !== lastContentId || state.roomIndex !== lastRoomIndex) {
        lastContentId = currentContentId;
        lastRoomIndex = state.roomIndex;
        lastRestarts = state.roomRestarts;
        firedUtility.clear();
      }

      const p = state.camera?.position ?? { x: 0, y: 0, z: 0 };
      const elapsed = state.runStartedAt > 0 ? (performance.now() - state.runStartedAt) / 1000 : 0;
      const hazards = room?.hazards?.map((entry) => entry.kind).join(", ") || "none";
      const effects = room?.enemies
        ?.filter((entry) => Boolean(entry.effect))
        .map((entry) => `${firedUtility.has(entry.id) ? "✓" : "·"}${entry.kind}:${entry.effect?.type}`)
        .join(", ") || "none";
      const selectionPercent = state.warp?.selectionPercent?.() ?? 100;

      hud.readout.textContent = [
        `PLAYTEST // ${currentContentId} // room ${state.roomIndex + 1}/${content.activeRooms().length}`,
        `${room?.title ?? "NO ROOM"}`,
        `pos ${round(p.x)}, ${round(p.y)}, ${round(p.z)}   time ${elapsed.toFixed(1)}s`,
        `kills ${state.roomKills ?? 0}/${room?.requiredKills ?? 0}   shots ${state.shots ?? 0}   hits ${state.targetHits ?? 0}   warps ${state.warps ?? 0}`,
        `warp ${selectionPercent}%   anchor ${state.warp?.hasAnchor?.() ? "ready" : "none"}`,
        `hazards ${hazards}`,
        `utility ${effects}`,
        `ALT+D HUD  ALT+R retry  ALT+N next  ALT+1 good  ALT+2 issue  ALT+3 revisit`
      ].join("\n");
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function readEvents(): PlaytestEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildHud() {
  const root = document.createElement("aside");
  root.id = "playtest-hud";
  root.innerHTML = `
    <pre id="playtest-readout"></pre>
    <div class="playtest-actions">
      <button data-action="good">GOOD</button>
      <button data-action="issue">ISSUE</button>
      <button data-action="revisit">REVISIT</button>
      <button data-action="restart">RETRY</button>
      <button data-action="next">NEXT</button>
      <button data-action="toggle">HIDE</button>
    </div>
  `;
  const toast = document.createElement("div");
  toast.id = "playtest-toast";
  document.body.append(root, toast);
  return {
    root,
    readout: root.querySelector<HTMLElement>("#playtest-readout")!,
    good: root.querySelector<HTMLButtonElement>("[data-action='good']")!,
    issue: root.querySelector<HTMLButtonElement>("[data-action='issue']")!,
    revisit: root.querySelector<HTMLButtonElement>("[data-action='revisit']")!,
    restart: root.querySelector<HTMLButtonElement>("[data-action='restart']")!,
    next: root.querySelector<HTMLButtonElement>("[data-action='next']")!,
    toggle: root.querySelector<HTMLButtonElement>("[data-action='toggle']")!,
    toast
  };
}
