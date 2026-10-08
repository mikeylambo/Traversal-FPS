/*
 * Dev harness: boots the real game, minus menus, with the private shell stubbed
 * out (tools/harness/vite.config.ts aliases it), and loads one room from the URL.
 *
 *   ?map=map-18            a Campaign sector
 *   ?tt=17 | ?ch=4         a Time Trial course / Challenge chamber (1-based)
 *   ?reverse=1             The Reverse
 *   &cam=x,y,z,yaw,pitch   freeze the camera there (radians) for a screenshot
 *   &t=12                  advance the room clock this many seconds first
 *   &kill=id,id            resolve these actors on load (to stage consequences)
 *   &clean=1               hide HUD, dev overlays and the rifle for a scene shot
 *
 * window.__harness exposes the game for scripted captures.
 */
import "../../src/styles.css";
import "../../src/lookdev-mobile.css";
import "../../src/typography.css";
import "../../src/movement.css";
import "../../src/achievements.css";
import "../../src/feel-pass.css";
import "../../src/transition-minimal.css";
import "../../src/onboarding.css";
import "../../src/scope.css";
import "../../src/warp-readability.css";
import "../../src/splits.css";
import "../../src/accessibility.css";
import * as THREE from "three";
import { createHarnessShell } from "./shellStub";
import { TraversalGame } from "../../src/game/TraversalGame";
import { TraversalSettingsStore } from "../../src/game/TraversalSettings";
import { enhanceTraversalMovement } from "../../src/game/MovementPatch";
import { enhanceGrammarRuntime } from "../../src/game/GrammarRuntimePatch";
import { installContentRuntime } from "../../src/game/ContentRuntime";
import { installHazardRuntime } from "../../src/game/HazardRuntime";
import { installCombatFeel } from "../../src/game/CombatFeelRuntime";
import { installGameplayClarity } from "../../src/game/GameplayClarityRuntime";
import { installExitGateRuntime } from "../../src/game/ExitGateRuntime";
import { installLandingReadabilityRuntime } from "../../src/game/LandingReadabilityRuntime";
import { installSectorTransitions } from "../../src/game/SectorTransitionRuntime";
import { installCampaignFlow } from "../../src/game/CampaignFlowRuntime";
import { installCollapseRuntime } from "../../src/game/CollapseRuntime";
import { installCheckpointRuntime } from "../../src/game/CheckpointRuntime";
import { installAccessibilityRuntime } from "../../src/game/AccessibilityRuntime";
import { installSpatialActorRuntime } from "../../src/game/SpatialActorRuntime";
import { TraversalProgression } from "../../src/game/Progression";
import { installAchievementRuntime } from "../../src/game/AchievementRuntime";
import { enhanceTraversalPresentation } from "../../src/render/enhanceTraversalPresentation";
import { removeCircularEnvironment } from "../../src/render/removeCircularEnvironment";
import { installCampaignFieldPresentation } from "../../src/render/CampaignFieldPresentation";
import { registerCampaign02 } from "../../src/world/registerCampaign02";
import { registerCampaign03 } from "../../src/world/registerCampaign03";
import { registerCampaign04 } from "../../src/world/registerCampaign04";

const params = new URLSearchParams(location.search);
if (params.has("clean")) {
  const style = document.createElement("style");
  style.textContent = "#playtest-hud,#playtest-toast,#hud,#vector-console,#reticle,#tutorial-card,#capture-hint,#room-label{display:none!important}";
  document.head.appendChild(style);
}
const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;

registerCampaign02();
registerCampaign03();
registerCampaign04();
installAccessibilityRuntime();

const modeId = params.has("tt") ? "time-trial" : params.has("ch") ? "challenge" : params.has("reverse") ? "reversal" : "standard";
const rules: Record<string, Record<string, unknown>> = {
  standard: { grading: false, scoreFocus: false, airGraceScale: 1 },
  "time-trial": { grading: false, clockFocus: true, missPenaltySeconds: 0.2, extraKillPenaltySeconds: 0.75, airGraceScale: 0.8 },
  challenge: { grading: true, exactKills: true, shotAllowance: 1, airGraceScale: 0.8 },
  reversal: { grading: false, airGraceScale: 0.78 }
};
const { shell, flow, ui } = createHarnessShell({ id: modeId, label: modeId, rules: rules[modeId]! });
const memory = new Map<string, unknown>();
const progression = new TraversalProgression({
  get: async <T,>(key: string) => (memory.get(key) as T) ?? null,
  set: async <T,>(key: string, value: T) => void memory.set(key, value)
});
const traversalSettings = new TraversalSettingsStore();
const content = installContentRuntime(shell);
if (params.has("tt")) content.setModeSuite("time-trial", Number(params.get("tt")) - 1);
else if (params.has("ch")) content.setModeSuite("challenge", Number(params.get("ch")) - 1);
else if (params.has("reverse")) content.setModeSuite("reversal");
else content.setSelectedMap(params.get("map") ?? "map-01");

const game = new TraversalGame(canvas, shell, flow, ui, traversalSettings);
enhanceTraversalMovement(game);
enhanceGrammarRuntime(game, content);
installSpatialActorRuntime(game);
installAchievementRuntime(game, progression, content);
installCampaignFlow(game, content);
enhanceTraversalPresentation(game, traversalSettings);
removeCircularEnvironment(game);
installHazardRuntime(game);
installCampaignFieldPresentation(game, content);
installCombatFeel(game);
installGameplayClarity(game);
installExitGateRuntime(game);
installLandingReadabilityRuntime(game);
installSectorTransitions(game, content);
installCollapseRuntime(game);
installCheckpointRuntime(game);
game.start();

type Exposed = {
  camera: THREE.PerspectiveCamera;
  yaw: number;
  pitch: number;
  enemies: { spec: { id: string }; mesh: THREE.Mesh; alive: boolean }[];
};
const g = game as unknown as Exposed;

void shell.loadLevel().then(() => {
  const ids = (params.get("kill") ?? "").split(",").filter(Boolean);
  for (const id of ids) {
    const enemy = g.enemies.find((e) => e.spec.id === id);
    if (!enemy) continue;
    enemy.alive = false;
    enemy.mesh.visible = false;
    const kind = (enemy.spec as { kind?: string }).kind;
    const effect = (enemy.spec as { effect?: unknown }).effect;
    if (effect) window.dispatchEvent(new CustomEvent("traversal:puzzle-actor", { detail: { roomId: "", actorId: id, kind, effect } }));
  }
  const advance = Number(params.get("t") ?? 0);
  const freeze = () => {
    const cam = params.get("cam");
    if (cam) {
      const [x, y, z, yaw, pitch] = cam.split(",").map(Number);
      g.camera.position.set(x!, y!, z!);
      g.yaw = yaw ?? 0;
      g.pitch = pitch ?? 0;
      g.camera.rotation.order = "YXZ";
      g.camera.rotation.set(g.pitch, g.yaw, 0);
    }
    if (params.has("clean")) {
      const rifle = g.camera.children.find((child) => child.type === "Group");
      if (rifle) rifle.visible = false;
    }
    shell.session.phase = "paused";
    document.body.dataset.harnessReady = "true";
  };
  if (advance > 0) setTimeout(freeze, advance * 1000);
  else setTimeout(freeze, 400);
});

(window as unknown as { __harness: unknown }).__harness = { game, shell, content, THREE };
