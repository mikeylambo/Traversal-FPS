import { ROOMS } from "../world/stages";

type RuntimeState = {
  modeId: string;
  roomIndex: number;
  roomKills: number;
  roomShots: number;
  totalKills: number;
  shots: number;
  warps: number;
  roomRestarts: number;
  shotAllowance: number;
  warp: {
    hasAnchor(): boolean;
    selectionPercent(): number;
  };
  input: {
    isWarpHeld(): boolean;
  };
  updateHUD(): void;
};

/**
 * Keeps the signature spatial information large and immediate. Campaign is
 * intentionally sparse: location + sphere progress are enough during play.
 */
export function installGameplayClarity(game: object): void {
  const state = game as unknown as RuntimeState;
  const hud = document.getElementById("hud");
  if (!hud) return;

  document.querySelector("#mission-panel .hud-eyebrow")?.remove();

  const stopShort = document.createElement("section");
  stopShort.id = "stop-short-readout";
  stopShort.innerHTML = `
    <span>LANDING</span>
    <strong id="stop-short-percent">100%</strong>
    <em id="stop-short-state">ENDPOINT</em>
    <small id="stop-short-hint">HOLD WARP</small>
  `;
  hud.appendChild(stopShort);

  const budget = document.createElement("section");
  budget.id = "shot-budget-readout";
  budget.innerHTML = `
    <span>SHOT BUDGET</span>
    <strong id="shot-budget-count">—</strong>
    <em id="shot-budget-sub">CHALLENGE</em>
    <div id="shot-budget-pips"></div>
  `;
  hud.appendChild(budget);

  const originalHUD = state.updateHUD.bind(game);
  state.updateHUD = () => {
    originalHUD();
    simplifyCampaignHUD(state);
    updateStopShort(state);
    updateShotBudget(state);
    emphasizeTrainingStopShort(state);
  };
}

function simplifyCampaignHUD(state: RuntimeState): void {
  const campaign = state.modeId === "standard";
  const metricPanel = document.getElementById("metric-panel");
  if (metricPanel) metricPanel.hidden = campaign;
  if (!campaign) return;

  const room = ROOMS[state.roomIndex];
  if (!room) return;

  const roomLabel = document.getElementById("room-label");
  const roomObjective = document.getElementById("room-objective");

  if (roomLabel) roomLabel.textContent = room.title;
  if (roomObjective) roomObjective.textContent = `${state.roomKills}/${room.requiredKills} SPHERES`;
}

function updateStopShort(state: RuntimeState): void {
  const panel = document.getElementById("stop-short-readout");
  const percentEl = document.getElementById("stop-short-percent");
  const stateEl = document.getElementById("stop-short-state");
  const hintEl = document.getElementById("stop-short-hint");
  if (!panel || !percentEl || !stateEl || !hintEl) return;

  const trainingStopShort = state.modeId === "training" && ROOMS[state.roomIndex]?.id === "room-02";
  const hasAnchor = state.warp.hasAnchor();
  const held = state.input.isWarpHeld();
  const percent = hasAnchor ? state.warp.selectionPercent() : 100;
  panel.classList.toggle("visible", trainingStopShort || hasAnchor);
  panel.classList.toggle("placing", hasAnchor && held);
  panel.classList.toggle("short", hasAnchor && percent < 100);
  panel.style.setProperty("--landing-width", `${percent}%`);

  percentEl.textContent = `${percent}%`;
  stateEl.textContent = percent < 100 ? "STOP SHORT" : "ENDPOINT";

  const pad = document.body.classList.contains("gamepad-active");
  hintEl.textContent = !hasAnchor
    ? "KILL TO WRITE VECTOR"
    : held
      ? pad
        ? "RB SHORTER · LB LONGER · RELEASE LT"
        : "WHEEL TO PLACE · RELEASE RMB"
      : pad
        ? "HOLD LT"
        : "HOLD RMB";

  const warpHint = document.getElementById("warp-hint");
  if (warpHint && hasAnchor) {
    warpHint.textContent = held
      ? pad
        ? "RB SHORTER · LB LONGER"
        : "WHEEL TO PLACE LANDING"
      : pad
        ? "HOLD LT TO PLACE"
        : "HOLD RMB TO PLACE";
  }
}

function updateShotBudget(state: RuntimeState): void {
  const panel = document.getElementById("shot-budget-readout");
  const count = document.getElementById("shot-budget-count");
  const sub = document.getElementById("shot-budget-sub");
  const pips = document.getElementById("shot-budget-pips");
  if (!panel || !count || !sub || !pips) return;

  const room = ROOMS[state.roomIndex];
  const finiteBudget = state.modeId === "challenge" && Number.isFinite(state.shotAllowance) && room;
  panel.classList.toggle("visible", Boolean(finiteBudget));
  if (!finiteBudget || !room) return;

  const total = Math.max(1, room.requiredKills + Math.max(0, Math.floor(state.shotAllowance)));
  const left = Math.max(0, total - state.roomShots);
  const misses = Math.max(0, state.roomShots - state.roomKills);
  const missLeft = Math.max(0, Math.floor(state.shotAllowance) - misses);

  count.textContent = `${left} SHOT${left === 1 ? "" : "S"}`;
  sub.textContent = `${missLeft} MISS · ${Math.max(0, room.requiredKills - state.roomKills)} KILLS`;
  panel.classList.toggle("danger", left <= 1);

  pips.innerHTML = Array.from({ length: total }, (_, index) =>
    `<i class="${index < state.roomShots ? "spent" : "live"}"></i>`
  ).join("");
}

function emphasizeTrainingStopShort(state: RuntimeState): void {
  if (state.modeId !== "training" || ROOMS[state.roomIndex]?.id !== "room-02") return;
  const tutorial = document.getElementById("tutorial-text");
  const objective = document.getElementById("room-objective");
  if (tutorial) tutorial.textContent = "Choose a landing point before the endpoint.";
  if (objective) objective.textContent = "STOP SHORT";
}
