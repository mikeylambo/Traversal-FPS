import { CAMPAIGN_MAPS } from "../world/campaign";
import type { ContentRuntime } from "./ContentRuntime";

type RuntimeState = {
  modeId: string;
  beginRun(): void;
  finishRun(): void;
  ui: {
    updateScreen(screenId: string, payload: Record<string, unknown>): void;
  };
  flow: {
    showResults(): void;
  };
};

const SECTOR_HANDOFF_MS = 620;
let transitionAudio: AudioContext | null = null;

/**
 * Campaign is a journey through the construct, not a list of isolated score runs.
 * Intermediate sector results are still processed internally (progression,
 * achievements, best times) but their menu screen is suppressed; the next
 * implemented sector loads after a brief audiovisual handoff and receives the
 * normal sector title card.
 */
export function installCampaignFlow(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  const originalFinishRun = state.finishRun.bind(game);
  ensureSectorClearFx();

  state.finishRun = () => {
    const campaign = state.modeId === "standard" && content.activeForm() === "campaign-field";
    if (!campaign) {
      originalFinishRun();
      return;
    }

    const currentId = content.selectedContentId();
    const currentIndex = CAMPAIGN_MAPS.findIndex((entry) => entry.id === currentId);
    const nextMap = currentIndex >= 0
      ? CAMPAIGN_MAPS.slice(currentIndex + 1).find((entry) => entry.implemented)
      : undefined;

    if (!nextMap) {
      originalFinishRun();
      return;
    }

    // Let the existing completion/progression wrappers run, but don't surface an
    // intermediate results menu between connected campaign sectors.
    const originalUpdateScreen = state.ui.updateScreen.bind(state.ui);
    const originalShowResults = state.flow.showResults.bind(state.flow);
    state.ui.updateScreen = (screenId: string, payload: Record<string, unknown>) => {
      if (screenId !== "results") originalUpdateScreen(screenId, payload);
    };
    state.flow.showResults = () => {};

    try {
      originalFinishRun();
    } finally {
      state.ui.updateScreen = originalUpdateScreen;
      state.flow.showResults = originalShowResults;
    }

    playSectorClearCue();

    window.setTimeout(() => {
      content.setSelectedMap(nextMap.id);
      content.reloadSelected();
      state.beginRun();
    }, SECTOR_HANDOFF_MS);
  };
}

function ensureSectorClearFx(): void {
  if (document.getElementById("campaign-sector-clear-fx")) return;
  const fx = document.createElement("div");
  fx.id = "campaign-sector-clear-fx";
  fx.setAttribute("aria-hidden", "true");
  fx.innerHTML = "<i></i><b></b>";
  document.body.appendChild(fx);
}

function playSectorClearCue(): void {
  const fx = document.getElementById("campaign-sector-clear-fx");
  if (fx) {
    fx.classList.remove("pulse");
    void fx.offsetWidth;
    fx.classList.add("pulse");
    window.setTimeout(() => fx.classList.remove("pulse"), 720);
  }

  try {
    transitionAudio ??= new AudioContext();
    const ctx = transitionAudio;
    void ctx.resume();
    const now = ctx.currentTime;

    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(92, now);
    body.frequency.exponentialRampToValueAtTime(54, now + 0.28);
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.16, now + 0.018);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    body.connect(bodyGain).connect(ctx.destination);
    body.start(now);
    body.stop(now + 0.36);

    const edge = ctx.createOscillator();
    const edgeGain = ctx.createGain();
    edge.type = "triangle";
    edge.frequency.setValueAtTime(310, now + 0.035);
    edge.frequency.exponentialRampToValueAtTime(470, now + 0.18);
    edgeGain.gain.setValueAtTime(0.0001, now);
    edgeGain.gain.exponentialRampToValueAtTime(0.055, now + 0.05);
    edgeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    edge.connect(edgeGain).connect(ctx.destination);
    edge.start(now + 0.035);
    edge.stop(now + 0.3);
  } catch {
    // Transition audio is enhancement-only.
  }
}
