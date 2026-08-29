import { CAMPAIGN_MAPS } from "../world/campaign";
import type { ContentRuntime } from "./ContentRuntime";

type RuntimeState = {
  modeId: string;
  modeLabel: string;
  roomIndex: number;
  loadRoom(index: number): void;
};

/** Gives each content family an authored entrance so Campaign feels like entering a
 * place while Time Trial/Challenge feel like entering a course or ruleset.
 */
export function installSectorTransitions(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  const overlay = document.createElement("div");
  overlay.id = "sector-transition";
  overlay.innerHTML = `
    <div class="sector-transition-grid"></div>
    <div class="sector-transition-line"></div>
    <div class="sector-transition-copy">
      <span id="sector-transition-kicker"></span>
      <strong id="sector-transition-title"></strong>
      <em id="sector-transition-subtitle"></em>
    </div>
  `;
  document.body.appendChild(overlay);

  let serial = 0;
  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    if (index !== 0) return;
    showTransition(overlay, state, content, ++serial);
  };
}

function showTransition(
  overlay: HTMLElement,
  state: RuntimeState,
  content: ContentRuntime,
  serial: number
): void {
  const kicker = overlay.querySelector<HTMLElement>("#sector-transition-kicker");
  const title = overlay.querySelector<HTMLElement>("#sector-transition-title");
  const subtitle = overlay.querySelector<HTMLElement>("#sector-transition-subtitle");
  if (!kicker || !title || !subtitle) return;

  const contentId = content.selectedContentId();
  const map = CAMPAIGN_MAPS.find((entry) => entry.id === contentId);

  if (contentId === "training") {
    kicker.textContent = "TRAINING CONSTRUCT // GRAMMAR COURSE";
    title.textContent = "VECTOR FUNDAMENTALS";
    subtitle.textContent = "LEARN THE LANGUAGE // THEN ENTER THE FIELD";
  } else if (state.modeId === "standard") {
    kicker.textContent = "DIMENSIONAL FIELD // SECTOR ENTRY";
    title.textContent = map?.label.replace(/^SECTOR \d+ \/\/ /, "") ?? contentId.toUpperCase();
    subtitle.textContent = "FIELD SYNCHRONIZED // READ THE CONSTRUCT";
  } else if (state.modeId === "time-trial") {
    kicker.textContent = "TIME TRIAL // COURSE LOCK";
    title.textContent = map?.label.replace(/^SECTOR \d+ \/\/ /, "") ?? "VECTOR COURSE";
    subtitle.textContent = "CLOCK ARMED // SPLITS LIVE // ROUTE CLEAN";
  } else {
    kicker.textContent = "CHALLENGE // CONSTRAINT LOCK";
    title.textContent = map?.label.replace(/^SECTOR \d+ \/\/ /, "") ?? "CLEAN ROUTE";
    subtitle.textContent = "SHOT BUDGET ARMED // EXTRA KILLS REJECTED";
  }

  overlay.dataset.serial = String(serial);
  overlay.classList.remove("show");
  void overlay.offsetWidth;
  overlay.classList.add("show");
  window.setTimeout(() => {
    if (overlay.dataset.serial === String(serial)) overlay.classList.remove("show");
  }, 2100);
}
