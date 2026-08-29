import "./styles.css";
import "./lookdev-mobile.css";
import "./typography.css";
import "./movement.css";
import "./achievements.css";
import "./feel-pass.css";
import "./transition-minimal.css";
import "./onboarding.css";
import "./scope.css";
import "./editor/editor.css";
import {
  createArcadeAssembly,
  createFPSAssembly,
  createGameApp,
  createThreeStarterAdapter
} from "@slu/web-shell";
import { TraversalGame } from "./game/TraversalGame";
import { TraversalSettingsStore } from "./game/TraversalSettings";
import { enhanceTraversalMovement } from "./game/MovementPatch";
import { enhanceGrammarRuntime } from "./game/GrammarRuntimePatch";
import { installContentRuntime } from "./game/ContentRuntime";
import { installHazardRuntime } from "./game/HazardRuntime";
import { installGamepadGameplay } from "./game/GamepadGameplayRuntime";
import { installCombatFeel } from "./game/CombatFeelRuntime";
import { installScopeRuntime } from "./game/ScopeRuntime";
import { installGameplayClarity } from "./game/GameplayClarityRuntime";
import { installSectorTransitions } from "./game/SectorTransitionRuntime";
import { installOnboardingRuntime } from "./game/OnboardingRuntime";
import { TraversalProgression, ACHIEVEMENTS } from "./game/Progression";
import { achievementChoices, installAchievementRuntime } from "./game/AchievementRuntime";
import { enhanceTraversalPresentation } from "./render/enhanceTraversalPresentation";
import { removeCircularEnvironment } from "./render/removeCircularEnvironment";
import { installCampaignFieldPresentation } from "./render/CampaignFieldPresentation";
import { installTraversalEditor } from "./editor/TraversalEditor";
import { installEditorShortcut } from "./editor/EditorShortcutRuntime";
import { installMapEditorNaming } from "./editor/MapEditorNamingRuntime";
import { PUZZLE_GRAMMAR_V1 } from "./world/puzzleGrammar";
import { CAMPAIGN_MAPS } from "./world/campaign";
import { registerCampaign02 } from "./world/registerCampaign02";
import { ROOMS } from "./world/stages";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
const uiRoot = document.getElementById("ui");
if (!canvas || !uiRoot) throw new Error("Traversal FPS boot DOM is incomplete");

registerCampaign02();

const traversalSettings = new TraversalSettingsStore();
const rendererAdapter = createThreeStarterAdapter(canvas);
const app = await createGameApp({
  gameId: "traversal-fps",
  gameName: "Traversal FPS",
  version: "0.9.2",
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
    description: "Learn the Warp Rifle grammar.",
    rules: { grading: false, airGraceScale: 1.35 }
  },
  {
    id: "standard",
    label: "Campaign",
    description: "Explore the construct.",
    leaderboardKey: "score",
    rules: { grading: true, scoreFocus: true, airGraceScale: 1 }
  },
  {
    id: "time-trial",
    label: "Time Trial",
    description: "Find the fastest route.",
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
    description: "Clear the route under constraint.",
    leaderboardKey: "score",
    rules: { grading: true, exactKills: true, shotAllowance: 1, airGraceScale: 0.8 }
  }
] as const;

const traversalDifficulties = [
  {
    id: "assist",
    label: "Assist",
    description: "Slower targets, lighter gravity, wider exits.",
    multipliers: { enemySpeed: 0.78 },
    rules: { gravityScalar: 0.85, goalRadius: 2.8 }
  },
  {
    id: "standard",
    label: "Standard",
    description: "The intended traversal timing.",
    multipliers: { enemySpeed: 1 },
    rules: { gravityScalar: 1, goalRadius: 2.3 }
  },
  {
    id: "hard",
    label: "Hard",
    description: "Faster targets, stronger gravity, tighter exits.",
    multipliers: { enemySpeed: 1.18 },
    rules: { gravityScalar: 1.08, goalRadius: 2.05 }
  },
  {
    id: "expert",
    label: "Expert",
    description: "Strict timing and placement.",
    multipliers: { enemySpeed: 1.35 },
    rules: { gravityScalar: 1.18, goalRadius: 1.8 }
  }
] as const;

app.shell.modes.replace(traversalModes);
app.shell.difficulty.register(traversalDifficulties);

const progression = new TraversalProgression(app.storage);
await progression.load();
const contentRuntime = installContentRuntime(app.shell);

app.ui.register([
  {
    id: "achievements",
    title: "Achievements",
    subtitle: `${progression.snapshot().achievements.length} / ${ACHIEVEMENTS.length} unlocked`,
    backTarget: "main-menu",
    choices: achievementChoices(progression)
  }
]);

const refreshAchievements = () => {
  app.ui.updateScreen("achievements", {
    subtitle: `${progression.snapshot().achievements.length} / ${ACHIEVEMENTS.length} unlocked`,
    choices: achievementChoices(progression)
  });
};
progression.onUnlock(() => refreshAchievements());

app.ui.updateScreen("main-menu", {
  choices: [
    { id: "play", label: "Play" },
    { id: "vector-lab", label: "Map Editor", description: "Build and test Traversal spaces." },
    { id: "achievements", label: "Achievements", description: `${progression.snapshot().achievements.length} / ${ACHIEVEMENTS.length}` },
    { id: "settings", label: "Settings" },
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
  title: "Warp Rifle",
  choices: [
    {
      id: "continue",
      label: "Continue",
      description: "Run. Crouch. Write a vector. Choose where it ends."
    }
  ]
});

const trainingChoices = [
  {
    id: "training-full",
    label: "Full Training",
    description: "Controls + eight traversal lessons."
  },
  {
    id: "training-grammar",
    label: "Grammar 01–08",
    description: "Replay the eight traversal lessons."
  }
];

app.ui.updateScreen("stage-select", {
  title: "Training",
  choices: trainingChoices
});

app.ui.updateScreen("credits", {
  title: "Credits",
  subtitle: "KILL // WRITE // WARP",
  choices: [
    { id: "credit-design", label: "Design & Development // Mikey Lambo", disabled: true },
    { id: "credit-tech", label: "Technology // Three.js + SLU Web Game Shell", disabled: true },
    { id: "credit-type", label: "Typography // Rajdhani + Sora", disabled: true },
    { id: "credit-tools", label: "Development Assistance // OpenAI + Anthropic", disabled: true },
    { id: "credit-build", label: "Build // v0.9.2", description: "Controller Aim Tuning", disabled: true }
  ]
});

const originalActivate = app.flow.onActivate.bind(app.flow);
app.flow.onActivate = (screenId: string, choiceId: string) => {
  if (screenId === "main-menu" && choiceId === "achievements") {
    refreshAchievements();
    app.ui.show("achievements");
    return;
  }

  if (screenId === "main-menu" && choiceId === "vector-lab") {
    app.shell.modes.activate("standard");
    app.shell.difficulty.set("standard");
    contentRuntime.setSelectedMap("map-01");
    document.body.classList.add("vector-lab-launching");
    void app.shell.loadLevel("vector-lab").then(() => {
      app.ui.show("gameplay-placeholder");
      window.setTimeout(() => {
        document.getElementById("editor-toggle")?.click();
        document.body.classList.remove("vector-lab-launching");
      }, 90);
    });
    return;
  }

  if (screenId === "mode-select") {
    if (choiceId === "training") {
      contentRuntime.setTrainingPath("controls");
      app.ui.updateScreen("stage-select", {
        title: "Training",
        choices: trainingChoices
      });
    } else {
      app.ui.updateScreen("stage-select", {
        title: choiceId === "standard" ? "Campaign" : choiceId === "time-trial" ? "Time Trial" : "Challenge",
        choices: CAMPAIGN_MAPS.map((map) => ({
          id: map.id,
          label: map.label,
          description: !map.implemented
            ? "In development"
            : choiceId === "standard"
              ? map.subtitle
              : `${map.courseRooms.length} chamber course`,
          disabled: !map.implemented
        }))
      });
    }
  }

  if (screenId === "stage-select") {
    if (choiceId === "training-full") contentRuntime.setTrainingPath("controls");
    if (choiceId === "training-grammar") contentRuntime.setTrainingPath("grammar");
    if (choiceId.startsWith("map-")) contentRuntime.setSelectedMap(choiceId);
  }

  originalActivate(screenId, choiceId);
};

const originalBack = app.flow.onBack.bind(app.flow);
app.flow.onBack = (screenId: string) => {
  if (screenId === "achievements") {
    app.ui.show("main-menu");
    return;
  }
  originalBack(screenId);
};

const game = new TraversalGame(canvas, app.shell, app.flow, app.ui, traversalSettings);
enhanceTraversalMovement(game);
enhanceGrammarRuntime(game, contentRuntime);
installAchievementRuntime(game, progression, contentRuntime);
enhanceTraversalPresentation(game, traversalSettings);
removeCircularEnvironment(game);
installHazardRuntime(game);
installCampaignFieldPresentation(game, contentRuntime);
installTraversalEditor(game, contentRuntime);
installMapEditorNaming();
installGamepadGameplay(game, traversalSettings);
installCombatFeel(game);
installScopeRuntime(game, traversalSettings);
installGameplayClarity(game);
installSectorTransitions(game, contentRuntime);
installOnboardingRuntime(game, contentRuntime);
installEditorShortcut();
game.start();

console.info("Traversal FPS ready", {
  shellVersion: "1.0.2+settings+mode-replace",
  shellCommit: "d45d5b89b56eb65cf10cc25ef3a89595d63f6b3f",
  gameVersion: "0.9.2",
  renderTarget: "Vector Surface",
  typography: "Rajdhani / Sora",
  starfield: "shader-twinkle",
  movement: "run + crouch + warp",
  controller: "left move // right look // RT fire // LT warp // RB shorter // LB longer // L3-B crouch // R3 scope // X reset",
  controllerAim: "horizontal 1-10 // vertical 1-10 // acceleration 0-5 // scope multiplier // right deadzone",
  scope: "R3 / Q / touch toggle // precision look // 36-48 degree FOV",
  rifleCadenceMs: 285,
  autoStepMeters: 0.38,
  puzzleGrammar: PUZZLE_GRAMMAR_V1.map((entry) => entry.id),
  trainingRooms: 8,
  onboarding: "action-gated controls // keyboard + controller + touch",
  campaignMaps: CAMPAIGN_MAPS.map((map) => ({
    id: map.id,
    implemented: map.implemented,
    campaignFields: map.campaignRooms.length,
    courseRooms: map.courseRooms.length
  })),
  achievements: ACHIEVEMENTS.length,
  hazards: ["lethal-field", "sweep", "sightline-gate"],
  editor: "Map Editor // main menu // F2 // backquote",
  mobileControls: true,
  vrStatus: "future-compatible target; not current production scope",
  assemblies: app.composer.listAssemblies()
});
