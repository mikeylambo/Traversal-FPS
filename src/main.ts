import "./styles.css";
import "./lookdev-mobile.css";
import "./typography.css";
import {
  createArcadeAssembly,
  createFPSAssembly,
  createGameApp,
  createThreeStarterAdapter
} from "@slu/web-shell";
import { TraversalGame } from "./game/TraversalGame";
import { TraversalSettingsStore } from "./game/TraversalSettings";
import { enhanceTraversalMovement } from "./game/MovementPatch";
import { enhanceTraversalPresentation } from "./render/enhanceTraversalPresentation";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
const uiRoot = document.getElementById("ui");
if (!canvas || !uiRoot) throw new Error("Traversal FPS boot DOM is incomplete");

const traversalSettings = new TraversalSettingsStore();
const rendererAdapter = createThreeStarterAdapter(canvas);
const app = await createGameApp({
  gameId: "traversal-fps",
  gameName: "Traversal FPS",
  version: "0.4.2",
  renderer: rendererAdapter,
  root: uiRoot,
  assemblies: [
    (shell) => createFPSAssembly({ shell }),
    (shell) => createArcadeAssembly({ shell })
  ],
  flow: {
    settingsExtension: {
      choices: () => traversalSettings.choices(),
      handle: (choiceId) => traversalSettings.handle(choiceId)
    }
  }
});

const traversalModes = [
  {
    id: "training",
    label: "Training",
    description: "Learn the Warp Rifle and traversal grammar with forgiving aerial timing.",
    rules: { grading: false, airGraceScale: 1.35 }
  },
  {
    id: "standard",
    label: "Standard Run",
    description: "Balanced score run. Time, extra kills, shots fired, and restarts all affect your result.",
    leaderboardKey: "score",
    rules: { grading: true, scoreFocus: true, airGraceScale: 1 }
  },
  {
    id: "time-trial",
    label: "Time Trial",
    description: "Race the adjusted clock. Wasted shots add +0.20s and extra kills add +0.75s.",
    leaderboardKey: "time",
    rules: {
      grading: false,
      clockFocus: true,
      missPenaltySeconds: 0.2,
      extraKillPenaltySeconds: 0.75,
      airGraceScale: 0.8
    }
  },
  {
    id: "challenge",
    label: "Challenge // Clean Route",
    description: "Exact kills only, with one non-kill shot allowed per room. Exceed either limit and the room resets.",
    leaderboardKey: "score",
    rules: { grading: true, exactKills: true, shotAllowance: 1, airGraceScale: 0.8 }
  }
] as const;

const traversalDifficulties = [
  {
    id: "assist",
    label: "Assist",
    description: "Slower moving targets, lighter gravity, and a wider exit capture radius.",
    multipliers: { enemySpeed: 0.78 },
    rules: { gravityScalar: 0.85, goalRadius: 2.8 }
  },
  {
    id: "standard",
    label: "Standard",
    description: "Intended traversal timing and target motion.",
    multipliers: { enemySpeed: 1 },
    rules: { gravityScalar: 1, goalRadius: 2.3 }
  },
  {
    id: "hard",
    label: "Hard",
    description: "Faster moving targets, stronger gravity, and tighter exit capture.",
    multipliers: { enemySpeed: 1.18 },
    rules: { gravityScalar: 1.08, goalRadius: 2.05 }
  },
  {
    id: "expert",
    label: "Expert",
    description: "High target speed, aggressive fall timing, and strict exit placement. No extra enemy health.",
    multipliers: { enemySpeed: 1.35 },
    rules: { gravityScalar: 1.18, goalRadius: 1.8 }
  }
] as const;

app.shell.modes.replace(traversalModes);
app.shell.difficulty.register(traversalDifficulties);

app.ui.updateScreen("main-menu", {
  choices: [
    { id: "play", label: "Play" },
    { id: "settings", label: "Settings", description: "FPS controls, display, motion, audio, and render lookdev" },
    { id: "credits", label: "Credits" }
  ]
});

app.ui.updateScreen("mode-select", {
  title: "Select Mode",
  choices: traversalModes.map((mode) => ({
    id: mode.id,
    label: mode.label,
    description: mode.description
  }))
});

app.ui.updateScreen("difficulty-select", {
  title: "Difficulty",
  choices: traversalDifficulties.map((difficulty) => ({
    id: difficulty.id,
    label: difficulty.label,
    description: difficulty.description
  }))
});

app.ui.updateScreen("loadout", {
  title: "Traversal Rig",
  choices: [
    {
      id: "continue",
      label: "Warp Rifle",
      description: "Zero-spread precision rifle. Space jumps; Ctrl/C crouches. Every kill writes one consumable warp vector."
    }
  ]
});

app.ui.updateScreen("stage-select", {
  title: "Vertical Slice",
  choices: [
    {
      id: "stage-01",
      label: "Platforms 01–05",
      description: "Five linked traversal problems. The current slice now supports jump, crouch, walls, and low-clearance spaces."
    }
  ]
});

const game = new TraversalGame(canvas, app.shell, app.flow, app.ui, traversalSettings);
enhanceTraversalMovement(game);
enhanceTraversalPresentation(game, traversalSettings);
game.start();

console.info("Traversal FPS ready", {
  shellVersion: "1.0.2+settings+mode-replace",
  shellCommit: "d45d5b89b56eb65cf10cc25ef3a89595d63f6b3f",
  gameVersion: "0.4.2",
  renderTarget: "Vector Surface",
  typography: "Rajdhani / Sora",
  starfield: "shader-twinkle",
  movement: "run + jump + crouch + warp",
  mobileControls: true,
  assemblies: app.composer.listAssemblies()
});
