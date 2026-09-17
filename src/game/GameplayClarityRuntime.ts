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
  camera: { position: any };
  shell: { events: { on(event: string, handler: () => void): void } };
  warp: {
    hasAnchor(): boolean;
    selectionPercent(): number;
    updateLiveOrigin(position: any): void;
    clearAnchor(): void;
  };
  input: { isWarpHeld(): boolean };
  update(dt: number): void;
  shoot(): void;
  updateHUD(): void;
};

const touchHUD = navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;

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
    <i id="stop-short-surface" aria-live="polite"></i>
    <small id="stop-short-hint">HOLD WARP</small>
  `;
  hud.appendChild(stopShort);

  document.getElementById("vector-console")?.style.setProperty("display", "none", "important");

  if (touchHUD) {
    stopShort.style.setProperty("display", "none", "important");
    const mobileLanding = document.createElement("section");
    mobileLanding.id = "mobile-landing-readout";
    mobileLanding.innerHTML = `
      <span>LANDING</span>
      <em id="mobile-landing-state">ENDPOINT</em>
      <strong id="mobile-landing-percent">100%</strong>
      <i id="mobile-landing-surface" aria-live="polite"></i>
    `;
    hud.appendChild(mobileLanding);
  }

  const budget = document.createElement("section");
  budget.id = "shot-budget-readout";
  budget.innerHTML = `
    <span>SHOT BUDGET</span>
    <strong id="shot-budget-count">—</strong>
    <em id="shot-budget-sub">CHALLENGE</em>
    <div id="shot-budget-pips"></div>
  `;
  hud.appendChild(budget);

  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    if (state.warp.hasAnchor()) state.warp.updateLiveOrigin(state.camera.position);
    originalUpdate(dt);
  };

  const originalShoot = state.shoot.bind(game);
  state.shoot = () => {
    if (state.input.isWarpHeld() && state.warp.hasAnchor()) state.warp.clearAnchor();
    originalShoot();
  };

  const originalHUD = state.updateHUD.bind(game);
  state.updateHUD = () => {
    originalHUD();
    document.getElementById("vector-console")?.style.setProperty("display", "none", "important");
    normalizeSpatialLanguage();
    updateModeHUD(state);
    updateStopShort(state);
    updateShotBudget(state);
    emphasizeTrainingStopShort(state);
  };

  state.shell.events.on("game:pause", () => {
    requestAnimationFrame(() => updatePauseContext(state));
    window.setTimeout(() => updatePauseContext(state), 30);
  });
}

function activeNumber(state: RuntimeState): string {
  if (state.modeId === "standard") {
    return document.body.dataset.traversalContentId?.match(/^map-(\d+)$/)?.[1]?.padStart(2, "0") ?? "01";
  }
  return String(state.roomIndex + 1).padStart(2, "0");
}

function actForSector(value: number): string {
  if (value <= 8) return "ACT I";
  if (value <= 18) return "ACT II";
  if (value <= 30) return "ACT III";
  return "ACT IV";
}

function cleanRoomTitle(title: string): string {
  return title
    .replace(/^TT-?\d+\s*\/\/\s*/i, "")
    .replace(/^CHALLENGE-?\d+\s*\/\/\s*/i, "")
    .replace(/^\d+\s*\/\/\s*/, "");
}

function updatePauseContext(state: RuntimeState): void {
  const screen = document.querySelector<HTMLElement>('[data-screen-id="pause"], [data-screen-id="paused"], .slu-screen[data-screen-id*="pause"]');
  if (!screen) return;
  const room = ROOMS[state.roomIndex];
  if (!room) return;

  let location = screen.querySelector<HTMLElement>(".traversal-pause-location");
  if (!location) {
    location = document.createElement("div");
    location.className = "traversal-pause-location";
    const heading = screen.querySelector("h1, h2, .slu-screen-title");
    heading?.insertAdjacentElement("afterend", location);
    if (!location.isConnected) screen.prepend(location);
  }

  const number = activeNumber(state);
  const title = cleanRoomTitle(room.title);
  if (state.modeId === "standard") {
    location.textContent = `${actForSector(Number(number))} · SECTOR ${number} // ${title}`;
  } else if (state.modeId === "time-trial") {
    location.textContent = `TIME TRIAL · COURSE ${number} // ${title}`;
  } else if (state.modeId === "challenge") {
    location.textContent = `CHALLENGE · CHAMBER ${number} // ${title}`;
  } else if (state.modeId === "reversal") {
    location.textContent = `THE REVERSE · ${number} // ${title}`;
  } else {
    location.textContent = `${number} // ${title}`;
  }

  if (!document.getElementById("traversal-pause-location-style")) {
    const style = document.createElement("style");
    style.id = "traversal-pause-location-style";
    style.textContent = `.traversal-pause-location{margin:6px 0 20px;font-family:"Sora",sans-serif;font-size:11px;font-weight:650;letter-spacing:.12em;color:rgba(205,246,255,.68)}`;
    document.head.appendChild(style);
  }
}

function normalizeSpatialLanguage(): void {
  const objective = document.getElementById("room-objective");
  const tutorial = document.getElementById("tutorial-text");
  const anchor = document.getElementById("anchor-status");
  if (objective) objective.textContent = objective.textContent?.replaceAll("KILLS", "SPHERES").replaceAll("KILL", "SPHERE") ?? "";
  if (tutorial) tutorial.textContent = tutorial.textContent?.replaceAll(" KILLS", " SPHERES").replaceAll(" KILL", " SPHERE") ?? "";
  if (anchor) anchor.textContent = anchor.textContent?.replace("KILL A TARGET TO WRITE", "RESOLVE A SPHERE TO WRITE").replace("EXTRA KILL", "EXTRA SPHERE") ?? "";
}

function updateModeHUD(state: RuntimeState): void {
  const campaign = state.modeId === "standard";
  const reversal = state.modeId === "reversal";
  const metricPanel = document.getElementById("metric-panel");
  if (metricPanel) metricPanel.hidden = campaign || reversal;
  const room = ROOMS[state.roomIndex];
  if (!room) return;
  const roomLabel = document.getElementById("room-label");
  const roomObjective = document.getElementById("room-objective");
  const number = activeNumber(state);
  if (roomLabel) roomLabel.textContent = `${number} // ${cleanRoomTitle(room.title)}`;
  if (campaign && roomObjective) roomObjective.textContent = `${state.roomKills}/${room.requiredKills} SPHERES`;
}

function updateStopShort(state: RuntimeState): void {
  const trainingStopShort = state.modeId === "training" && state.roomIndex === 1;
  const hasAnchor = state.warp.hasAnchor();
  const held = state.input.isWarpHeld();
  const percent = hasAnchor ? state.warp.selectionPercent() : 100;
  const visible = trainingStopShort || hasAnchor;
  const landingState = percent < 100 ? "STOP SHORT" : "ENDPOINT";

  if (touchHUD) {
    const mobilePanel = document.getElementById("mobile-landing-readout");
    const mobilePercent = document.getElementById("mobile-landing-percent");
    const mobileState = document.getElementById("mobile-landing-state");
    mobilePanel?.classList.toggle("visible", visible);
    mobilePanel?.classList.toggle("placing", hasAnchor && held);
    if (mobilePercent) mobilePercent.textContent = `${percent}%`;
    if (mobileState) mobileState.textContent = landingState;
    return;
  }

  const panel = document.getElementById("stop-short-readout");
  const percentEl = document.getElementById("stop-short-percent");
  const stateEl = document.getElementById("stop-short-state");
  const hintEl = document.getElementById("stop-short-hint");
  if (!panel || !percentEl || !stateEl || !hintEl) return;
  panel.classList.toggle("visible", visible);
  panel.classList.toggle("placing", hasAnchor && held);
  panel.classList.toggle("short", hasAnchor && percent < 100);
  panel.style.setProperty("--landing-width", `${percent}%`);
  percentEl.textContent = `${percent}%`;
  stateEl.textContent = landingState;
  const pad = document.body.classList.contains("gamepad-active");
  hintEl.textContent = !hasAnchor ? "SPHERE SETS LANDING" : held ? (pad ? "RB SHORTER · LB LONGER · RELEASE LT" : "WHEEL TO PLACE · RELEASE RMB") : (pad ? "HOLD LT" : "HOLD RMB");
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
  sub.textContent = `${missLeft} MISS · ${Math.max(0, room.requiredKills - state.roomKills)} SPHERES`;
  panel.classList.toggle("danger", left <= 1);
  pips.innerHTML = Array.from({ length: total }, (_, index) => `<i class="${index < state.roomShots ? "spent" : "live"}"></i>`).join("");
}

function emphasizeTrainingStopShort(state: RuntimeState): void {
  if (state.modeId !== "training" || state.roomIndex !== 1) return;
  const tutorial = document.getElementById("tutorial-text");
  const objective = document.getElementById("room-objective");
  if (tutorial) tutorial.textContent = "Choose a landing point before the endpoint.";
  if (objective) objective.textContent = "STOP SHORT";
}
