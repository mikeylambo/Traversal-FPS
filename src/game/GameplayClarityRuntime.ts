import * as THREE from "three";
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
  camera: THREE.PerspectiveCamera;
  platformMeshes: THREE.Mesh[];
  shell: {
    events: { on(event: string, handler: () => void): void };
  };
  warp: {
    hasAnchor(): boolean;
    selectionPercent(): number;
    syncOrigin(position: THREE.Vector3): void;
    clearAnchor(): void;
    setCommitValidator(validator: ((from: THREE.Vector3, to: THREE.Vector3) => boolean) | null): void;
    previewPoint(): THREE.Vector3 | null;
    isHoldCancelled(): boolean;
    setPreviewTone(tone: number | null): void;
  };
  input: {
    isWarpHeld(): boolean;
  };
  update(dt: number): void;
  shoot(): void;
  updateHUD(): void;
  flashMessage(message: string, duration: number): void;
};

const touchHUD = navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;

export function installGameplayClarity(game: object): void {
  const state = game as unknown as RuntimeState;
  const hud = document.getElementById("hud");
  if (!hud) return;

  installMenuPresentation();
  installPauseContext(state);
  installLiveWarpGrammar(state, game);
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

  const originalHUD = state.updateHUD.bind(game);
  state.updateHUD = () => {
    originalHUD();
    document.getElementById("vector-console")?.style.setProperty("display", "none", "important");
    normalizeSpatialLanguage();
    updateRoomIdentity(state);
    simplifyModeHUD(state);
    updateStopShort(state);
    updateShotBudget(state);
    emphasizeTrainingStopShort(state);
  };
}

const collisionRay = new THREE.Raycaster();
const solidBounds = new THREE.Box3();

/**
 * The single answer to "would this warp commit?", shared by the commit validator
 * and the live HUD so the preview never disagrees with what a release does.
 */
function warpIsClear(state: RuntimeState, from: THREE.Vector3, to: THREE.Vector3): boolean {
  // A destination inside solid geometry would leave the player embedded in it
  // (and able to fall through floors), so it is never a valid landing.
  const embedded = state.platformMeshes.some((mesh) =>
    solidBounds.setFromObject(mesh).expandByScalar(-0.05).containsPoint(to));
  if (embedded) return false;

  const direction = to.clone().sub(from);
  const distance = direction.length();
  if (distance <= 0.5) return true;

  collisionRay.set(from, direction.normalize());
  // Contact at the destination platform is valid. Anything meaningfully before
  // the selected landing is solid route geometry and blocks the warp.
  collisionRay.far = Math.max(0, distance - 0.48);
  return collisionRay.intersectObjects(state.platformMeshes, false).length === 0;
}

type LandingPreview = "endpoint" | "short" | "drop" | "void" | "blocked" | "cancel";

/** Where a release right now would leave the player. */
function previewLanding(state: RuntimeState): LandingPreview {
  if (state.warp.isHoldCancelled()) return "cancel";
  const point = state.warp.previewPoint();
  if (!point) return "endpoint";
  if (!warpIsClear(state, state.camera.position, point)) return "blocked";
  const short = state.warp.selectionPercent() < 100;
  let below = false;
  for (const mesh of state.platformMeshes) {
    const box = solidBounds.setFromObject(mesh);
    if (point.x < box.min.x - 0.26 || point.x > box.max.x + 0.26 || point.z < box.min.z - 0.26 || point.z > box.max.z + 0.26) continue;
    if (box.max.y > point.y + 0.05) continue;
    // Mirrors warp arrival: within 0.72 of standing height (or anywhere between the
    // surface and standing height) settles on this surface.
    if (point.y - box.max.y <= 1.7 + 0.72) return short ? "short" : "endpoint";
    below = true;
  }
  return below ? "drop" : "void";
}

const PREVIEW_TONE: Record<LandingPreview, number | null> = {
  endpoint: null, short: null, drop: 0xffcf66, void: 0xff6a7d, blocked: 0xff6a7d, cancel: 0x5d7082
};
const PREVIEW_LABEL: Record<LandingPreview, string> = {
  endpoint: "ENDPOINT", short: "STOP SHORT", drop: "DROP", void: "NO FLOOR", blocked: "BLOCKED", cancel: "CANCEL"
};

function installLiveWarpGrammar(state: RuntimeState, game: object): void {
  state.warp.setCommitValidator((from, to) => {
    const clear = warpIsClear(state, from, to);
    if (!clear) state.flashMessage("VECTOR BLOCKED // SOLID GEOMETRY", 1050);
    return clear;
  });

  const originalUpdate = state.update.bind(game);
  state.update = (dt: number) => {
    if (state.warp.hasAnchor()) state.warp.syncOrigin(state.camera.position);
    originalUpdate(dt);
    // Movement occurs inside the original update. Refresh once more so the visible
    // line ends the frame at the same origin the player will commit from.
    if (state.warp.hasAnchor()) state.warp.syncOrigin(state.camera.position);
  };

  const originalShoot = state.shoot.bind(game);
  state.shoot = () => {
    const replacingHeldVector = state.input.isWarpHeld() && state.warp.hasAnchor();
    const shotsBefore = state.shots;
    const killsBefore = state.totalKills;
    originalShoot();

    // A successful second Sphere writes its own destination. A miss, wall hit or
    // rejected shot while Warp is held cancels the old destination instead of
    // silently preserving it and warping the player somewhere they no longer chose.
    if (
      replacingHeldVector &&
      state.shots > shotsBefore &&
      state.totalKills === killsBefore
    ) {
      state.warp.clearAnchor();
    }
  };
}

function installPauseContext(state: RuntimeState): void {
  state.shell.events.on("game:pause", () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const screen = document.querySelector<HTMLElement>(
        '[data-screen-id="pause"], [data-screen-id="pause-menu"]'
      );
      if (!screen) return;

      let context = screen.querySelector<HTMLElement>(".traversal-pause-context");
      if (!context) {
        context = document.createElement("div");
        context.className = "traversal-pause-context";
        const title = screen.querySelector("h1, h2, .slu-screen-title");
        if (title?.parentElement) title.insertAdjacentElement("afterend", context);
        else screen.prepend(context);
      }
      context.textContent = pauseContextText(state);
    }));
  });
}

function pauseContextText(state: RuntimeState): string {
  const room = ROOMS[state.roomIndex];
  if (!room) return "TRAVERSAL";

  if (state.modeId === "standard") {
    const sector = Number(room.id.match(/(?:sector|map)-(\d+)/)?.[1] ?? 0);
    const number = sector > 0 ? String(sector).padStart(2, "0") : "--";
    const act = sector > 30 ? "ACT IV" : sector > 18 ? "ACT III" : sector > 8 ? "ACT II" : "ACT I";
    return `${act} · SECTOR ${number} // ${room.title}`;
  }

  if (state.modeId === "time-trial") return `TIME TRIAL · ${room.title}`;
  if (state.modeId === "challenge") return `CHALLENGE · ${room.title}`;
  if (state.modeId === "reversal") {
    return `THE REVERSE · ${String(state.roomIndex + 1).padStart(2, "0")} // ${room.title}`;
  }
  return `TRAINING · ${room.title}`;
}

function installMenuPresentation(): void {
  if (document.getElementById("traversal-menu-presentation")) return;
  const style = document.createElement("style");
  style.id = "traversal-menu-presentation";
  style.textContent = `
    .slu-screen[data-screen-id="main-menu"] {
      background:
        linear-gradient(104deg, rgba(2, 8, 18, .96) 0 38%, rgba(4, 13, 27, .82) 58%, rgba(1, 5, 12, .96) 100%),
        radial-gradient(circle at 76% 35%, rgba(53, 214, 255, .13), transparent 24%),
        radial-gradient(circle at 84% 66%, rgba(255, 72, 190, .08), transparent 28%);
      overflow: hidden;
    }
    .slu-screen[data-screen-id="main-menu"]::before {
      content: "";
      position: absolute;
      inset: -12%;
      pointer-events: none;
      opacity: .34;
      background-image:
        linear-gradient(rgba(111, 228, 255, .055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(111, 228, 255, .04) 1px, transparent 1px);
      background-size: 42px 42px;
      transform: perspective(700px) rotateX(62deg) rotateZ(-8deg) translateY(20%);
      transform-origin: center bottom;
      mask-image: linear-gradient(to left, #000, transparent 72%);
    }
    .slu-screen[data-screen-id="main-menu"] .slu-choice {
      max-width: min(460px, 72vw);
      min-height: 0;
      padding-block: 10px;
      background: rgba(3, 12, 24, .64);
      border-color: rgba(111, 228, 255, .18);
      backdrop-filter: blur(12px);
    }
    .slu-screen[data-screen-id="main-menu"] .slu-choice:nth-of-type(even) {
      transform: translateX(8px);
    }
    .slu-screen[data-screen-id="main-menu"] .slu-choice:hover,
    .slu-screen[data-screen-id="main-menu"] .slu-choice:focus-visible,
    .slu-screen[data-screen-id="main-menu"] .slu-choice[data-focused="true"] {
      transform: translateX(14px);
    }
    .slu-screen[data-screen-id="main-menu"] .slu-choice-description,
    .slu-screen[data-screen-id="main-menu"] .slu-choice-desc,
    .slu-screen[data-screen-id="main-menu"] [class*="description"],
    .slu-screen[data-screen-id="main-menu"] small {
      opacity: .52;
      letter-spacing: .09em;
    }
    .traversal-pause-context {
      margin: -2px 0 18px;
      font-family: "Sora", sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .13em;
      color: rgba(199, 242, 255, .72);
      text-transform: uppercase;
    }
    .traversal-achievement-count {
      display: block;
      margin-top: 4px;
      opacity: .52;
      font-size: 10px;
      letter-spacing: .09em;
    }
  `;
  document.head.appendChild(style);
}

function normalizeSpatialLanguage(): void {
  const objective = document.getElementById("room-objective");
  const tutorial = document.getElementById("tutorial-text");
  const anchor = document.getElementById("anchor-status");

  if (objective) {
    objective.textContent = objective.textContent
      ?.replaceAll("KILLS", "SPHERES")
      .replaceAll("KILL", "SPHERE") ?? "";
  }
  if (tutorial) {
    tutorial.textContent = tutorial.textContent
      ?.replaceAll(" KILLS", " SPHERES")
      .replaceAll(" KILL", " SPHERE") ?? "";
  }
  if (anchor) {
    anchor.textContent = anchor.textContent
      ?.replace("KILL A TARGET TO WRITE", "RESOLVE A SPHERE TO WRITE")
      .replace("EXTRA KILL", "EXTRA SPHERE") ?? "";
  }
}

function updateRoomIdentity(state: RuntimeState): void {
  const room = ROOMS[state.roomIndex];
  const roomLabel = document.getElementById("room-label");
  if (!room || !roomLabel) return;

  if (state.modeId === "standard") {
    const sector = room.id.match(/(?:sector|map)-(\d+)/)?.[1]?.padStart(2, "0");
    roomLabel.textContent = sector ? `${sector} // ${room.title}` : room.title;
    return;
  }

  if (state.modeId === "reversal") {
    roomLabel.textContent = `${String(state.roomIndex + 1).padStart(2, "0")} // ${room.title}`;
    return;
  }

  roomLabel.textContent = room.title;
}

function simplifyModeHUD(state: RuntimeState): void {
  const campaign = state.modeId === "standard";
  const reversal = state.modeId === "reversal";
  const metricPanel = document.getElementById("metric-panel");
  if (metricPanel) metricPanel.hidden = campaign || reversal;

  const room = ROOMS[state.roomIndex];
  if (!room) return;
  const roomObjective = document.getElementById("room-objective");

  if ((campaign || reversal) && roomObjective) {
    roomObjective.textContent = `${state.roomKills}/${room.requiredKills} SPHERES`;
  }
}

function updateStopShort(state: RuntimeState): void {
  const trainingStopShort = state.modeId === "training" && state.roomIndex === 1;
  const hasAnchor = state.warp.hasAnchor();
  const held = state.input.isWarpHeld();
  const percent = hasAnchor ? state.warp.selectionPercent() : 100;
  const visible = trainingStopShort || hasAnchor;
  const preview: LandingPreview = hasAnchor && held ? previewLanding(state) : percent < 100 ? "short" : "endpoint";
  const landingState = PREVIEW_LABEL[preview];
  state.warp.setPreviewTone(PREVIEW_TONE[preview]);
  for (const key of Object.keys(PREVIEW_LABEL)) {
    document.body.classList.toggle(`warp-preview-${key}`, hasAnchor && held && preview === key);
  }
  document.body.classList.toggle("warp-empty", held && !hasAnchor);

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
  hintEl.textContent = !hasAnchor
    ? "SPHERE SETS LANDING"
    : held
      ? pad
        ? "RB SHORTER · LB LONGER · RELEASE LT"
        : "WHEEL TO PLACE · RELEASE RMB"
      : pad
        ? "HOLD LT"
        : "HOLD RMB";
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

  pips.innerHTML = Array.from({ length: total }, (_, index) =>
    `<i class="${index < state.roomShots ? "spent" : "live"}"></i>`
  ).join("");
}

function emphasizeTrainingStopShort(state: RuntimeState): void {
  if (state.modeId !== "training" || state.roomIndex !== 1) return;
  const tutorial = document.getElementById("tutorial-text");
  const objective = document.getElementById("room-objective");
  if (tutorial) tutorial.textContent = "Choose a landing point before the endpoint.";
  if (objective) objective.textContent = "STOP SHORT";
}
