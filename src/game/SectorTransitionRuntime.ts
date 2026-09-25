import "../playtest.css";
import { emitTraversalAudio } from "../audio/TraversalAudio";
import { CAMPAIGN_MAPS } from "../world/campaign";
import type { ContentRuntime } from "./ContentRuntime";
import { installPlaytestRuntime } from "./PlaytestRuntime";

type RuntimeState = {
  modeId: string;
  roomIndex: number;
  loadRoom(index: number): void;
};

const TITLE_DURATION_MS = 2600;
const ACT_ENTRIES: Record<string, { kicker: string; title: string }> = {
  "map-01": { kicker: "ACT I", title: "WRITE THE LANGUAGE" },
  "map-09": { kicker: "ACT II", title: "THE MACHINE OPENS" },
  "map-19": { kicker: "ACT III", title: "THE CONSTRUCT PUSHES BACK" },
  "map-31": { kicker: "ACT IV", title: "MASTERY WITHOUT A MAP" }
};
const ACT_FINALES: Record<string, { kicker: string; title: string }> = {
  "map-08": { kicker: "ACT I // FINALE", title: "TERMINAL" },
  "map-18": { kicker: "ACT II // FINALE", title: "SWEEP" },
  "map-30": { kicker: "ACT III // FINALE", title: "KINETIC" },
  "map-42": { kicker: "ACT IV // FINALE", title: "CONVERGENCE" }
};

/** Gives each content family a restrained entrance card and stronger Act punctuation. */
export function installSectorTransitions(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  const overlay = document.createElement("div");
  overlay.id = "sector-transition";
  overlay.innerHTML = `
    <div class="sector-transition-line"></div>
    <div class="sector-transition-copy">
      <span id="sector-transition-kicker"></span>
      <strong id="sector-transition-title"></strong>
    </div>
  `;
  document.body.appendChild(overlay);

  let serial = 0;
  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    if (index !== 0 || document.body.classList.contains("vector-lab-launching")) return;
    showTransition(overlay, state, content, ++serial);
  };

  installPlaytestRuntime(game, content);
}

function showTransition(
  overlay: HTMLElement,
  state: RuntimeState,
  content: ContentRuntime,
  serial: number
): void {
  const kicker = overlay.querySelector<HTMLElement>("#sector-transition-kicker");
  const title = overlay.querySelector<HTMLElement>("#sector-transition-title");
  if (!kicker || !title) return;

  const contentId = content.selectedContentId();
  const map = CAMPAIGN_MAPS.find((entry) => entry.id === contentId);
  const sectorNumber = map?.id.match(/(\d+)/)?.[1]?.padStart(2, "0") ?? "01";
  const mapTitle = map?.label.replace(/^ACT [IVX]+ \/\/ /, "").replace(/^SECTOR \d+ \/\/ /, "") ?? "THE SPAN";
  const campaign = state.modeId === "standard";
  const actEntry = campaign ? ACT_ENTRIES[contentId] : undefined;
  const finale = campaign ? ACT_FINALES[contentId] : undefined;
  const major = actEntry ?? finale;

  document.body.classList.toggle("act-boundary", Boolean(major));
  document.body.classList.toggle("act-entry", Boolean(actEntry));
  document.body.classList.toggle("act-finale", Boolean(finale));

  if (major) {
    kicker.textContent = major.kicker;
    title.textContent = major.title;
  } else if (contentId === "controls") {
    kicker.textContent = "TRAINING";
    title.textContent = "CONTROLS";
  } else if (contentId === "training") {
    kicker.textContent = "TRAINING";
    title.textContent = "WARP FUNDAMENTALS";
  } else if (campaign) {
    kicker.textContent = `SECTOR ${sectorNumber}`;
    title.textContent = mapTitle;
  } else if (state.modeId === "time-trial") {
    kicker.textContent = "TIME TRIAL";
    title.textContent = content.activeRooms()[state.roomIndex]?.title ?? mapTitle;
  } else if (state.modeId === "reversal") {
    kicker.textContent = "THE REVERSE";
    title.textContent = content.activeRooms()[state.roomIndex]?.title ?? "LABYRINTH";
  } else {
    kicker.textContent = "CHALLENGE";
    title.textContent = content.activeRooms()[state.roomIndex]?.title ?? mapTitle;
  }

  overlay.dataset.serial = String(serial);
  overlay.classList.remove("show");
  void overlay.offsetWidth;
  overlay.classList.add("show");
  emitTraversalAudio("sector.enter", { campaign });
  window.setTimeout(() => {
    if (overlay.dataset.serial === String(serial)) {
      overlay.classList.remove("show");
      document.body.classList.remove("act-boundary", "act-entry", "act-finale");
    }
  }, major ? TITLE_DURATION_MS + 950 : TITLE_DURATION_MS);
}
