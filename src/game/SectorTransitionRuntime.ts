import { CAMPAIGN_MAPS } from "../world/campaign";
import type { ContentRuntime } from "./ContentRuntime";

type RuntimeState = {
  modeId: string;
  roomIndex: number;
  loadRoom(index: number): void;
};

const TITLE_DURATION_MS = 2600;
let titleAudio: AudioContext | null = null;

/** Gives each content family a restrained entrance card. */
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
  const mapTitle = map?.label.replace(/^SECTOR \d+ \/\/ /, "") ?? "THE SPAN";

  if (contentId === "controls") {
    kicker.textContent = "TRAINING";
    title.textContent = "CONTROLS";
  } else if (contentId === "training") {
    kicker.textContent = "TRAINING";
    title.textContent = "VECTOR FUNDAMENTALS";
  } else if (state.modeId === "standard") {
    kicker.textContent = `SECTOR ${sectorNumber}`;
    title.textContent = mapTitle;
  } else if (state.modeId === "time-trial") {
    kicker.textContent = "TIME TRIAL";
    title.textContent = mapTitle;
  } else {
    kicker.textContent = "CHALLENGE";
    title.textContent = mapTitle;
  }

  overlay.dataset.serial = String(serial);
  overlay.classList.remove("show");
  void overlay.offsetWidth;
  overlay.classList.add("show");
  playTitleTone(state.modeId === "standard");
  window.setTimeout(() => {
    if (overlay.dataset.serial === String(serial)) overlay.classList.remove("show");
  }, TITLE_DURATION_MS);
}

function playTitleTone(campaign: boolean): void {
  try {
    titleAudio ??= new AudioContext();
    const ctx = titleAudio;
    void ctx.resume();
    const now = ctx.currentTime + 0.08;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(campaign ? 660 : 560, now);
    oscillator.frequency.exponentialRampToValueAtTime(campaign ? 880 : 720, now + 0.22);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(campaign ? 0.045 : 0.03, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.44);
  } catch {
    // Title tone is enhancement-only.
  }
}
