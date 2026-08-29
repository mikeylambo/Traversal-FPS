import { ROOMS } from "../world/stages";

type RuntimeState = {
  modeId: string;
  roomIndex: number;
  roomKills: number;
  roomShots: number;
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

/** Makes the two most important invisible rules legible at a glance:
 * 1) stop-short is choosing a landing point, not merely shortening an effect;
 * 2) Challenge has a hard room-reset shot budget.
 */
export function installGameplayClarity(game: object): void {
  const state = game as unknown as RuntimeState;
  const hud = document.getElementById("hud");
  if (!hud) return;

  const stopShort = document.createElement("section");
  stopShort.id = "stop-short-readout";
  stopShort.innerHTML = `
    <span>VECTOR LANDING</span>
    <strong id="stop-short-percent">100%</strong>
    <em id="stop-short-state">FULL ENDPOINT</em>
    <small id="stop-short-hint">HOLD WARP TO PLACE LANDING</small>
  `;
  hud.appendChild(stopShort);

  const budget = document.createElement("section");
  budget.id = "shot-budget-readout";
  budget.innerHTML = `
    <span>ROOM RESET BUDGET</span>
    <strong id="shot-budget-count">—</strong>
    <em id="shot-budget-sub">CHALLENGE ONLY</em>
    <div id="shot-budget-pips"></div>
  `;
  hud.appendChild(budget);

  const originalHUD = state.updateHUD.bind(game);
  state.updateHUD = () => {
    originalHUD();
    updateStopShort(state);
    updateShotBudget(state);
    emphasizeTrainingStopShort(state);
  };
}

function updateStopShort(state: RuntimeState): void {
  const panel = document.getElementById("stop-short-readout");
  const percentEl = document.getElementById("stop-short-percent");
  const stateEl = document.getElementById("stop-short-state");
  const hintEl = document.getElementById("stop-short-hint");
  if (!panel || !percentEl || !stateEl || !hintEl) return;

  const trainingStopShort = state.modeId === "training" && state.roomIndex === 1;
  const hasAnchor = state.warp.hasAnchor();
  const held = state.input.isWarpHeld();
  const percent = hasAnchor ? state.warp.selectionPercent() : 100;
  panel.classList.toggle("visible", trainingStopShort || hasAnchor);
  panel.classList.toggle("placing", hasAnchor && held);
  panel.classList.toggle("short", hasAnchor && percent < 100);

  percentEl.textContent = `${percent}%`;
  stateEl.textContent = !hasAnchor
    ? "CHOOSE ANY POINT ON THE WRITTEN LINE"
    : percent < 100
      ? "STOP SHORT ACTIVE"
      : "FULL ENDPOINT";

  const pad = document.body.classList.contains("gamepad-active");
  hintEl.textContent = !hasAnchor
    ? "KILL TARGET → WRITE VECTOR"
    : held
      ? pad
        ? "RB SHORTER // LB LONGER // RELEASE LT"
        : "WHEEL TO PLACE LANDING // RELEASE RMB"
      : pad
        ? "HOLD LT // CHOOSE LANDING // RELEASE"
        : "HOLD RMB // CHOOSE LANDING // RELEASE";

  const warpHint = document.getElementById("warp-hint");
  if (warpHint && hasAnchor) {
    warpHint.textContent = held
      ? pad
        ? "RB SHORTER // LB LONGER // RELEASE LT"
        : "WHEEL TO PLACE LANDING // RELEASE RMB"
      : pad
        ? "HOLD LT TO PREVIEW LANDING"
        : "HOLD RMB TO PREVIEW LANDING";
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

  count.textContent = `${left} SHOT${left === 1 ? "" : "S"} LEFT`;
  sub.textContent = `${missLeft} MISS BUFFER // ${room.requiredKills - state.roomKills} KILLS REMAIN`;
  panel.classList.toggle("danger", left <= 1);

  pips.innerHTML = Array.from({ length: total }, (_, index) =>
    `<i class="${index < state.roomShots ? "spent" : "live"}"></i>`
  ).join("");
}

function emphasizeTrainingStopShort(state: RuntimeState): void {
  if (state.modeId !== "training" || state.roomIndex !== 1) return;
  const tutorial = document.getElementById("tutorial-text");
  const objective = document.getElementById("room-objective");
  if (tutorial) tutorial.textContent = "STOP SHORT: CHOOSE ANY POINT 12–100% ALONG THE VECTOR.";
  if (objective) objective.textContent = "LAND BEFORE 100%";
}
