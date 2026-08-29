import "./styles.css";
import "./lookdev-mobile.css";
import "./typography.css";
import "./movement.css";
import "./achievements.css";
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
import { TraversalProgression, ACHIEVEMENTS } from "./game/Progression";
import { achievementChoices, installAchievementRuntime } from "./game/AchievementRuntime";
import { enhanceTraversalPresentation } from "./render/enhanceTraversalPresentation";
import { removeCircularEnvironment } from "./render/removeCircularEnvironment";
import { installCampaignFieldPresentation } from "./render/CampaignFieldPresentation";
import { installTraversalEditor } from "./editor/TraversalEditor";
import { PUZZLE_GRAMMAR_V1 } from "./world/puzzleGrammar";
import { CAMPAIGN_MAPS } from "./world/campaign";
import { ROOMS } from "./world/stages";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
const uiRoot = document.getElementById("ui");
if (!canvas || !uiRoot) throw new Error("Traversal FPS boot DOM is incomplete");

const traversalSettings = new TraversalSettingsStore();
const rendererAdapter = createThreeStarterAdapter(canvas);
const app = await createGameApp({
  gameId: "traversal-fps",
  gameName: "Traversal FPS",
  version: "0.7.0",
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
    description: "Eight focused revelations. Learn the Warp Rifle grammar before the construct opens up.",
    rules: { grading: false, airGraceScale: 1.35 }
  },
  {
    id: "standard",
    label: "Campaign",
    description: "Explore continuous dimensional sectors where traversal problems live inside the world rather than isolated test rooms.",
    leaderboardKey: "score",
    rules: { grading: true, scoreFocus: true, airGraceScale: 1 }
  },
  {
    id: "time-trial",
    label: "Time Trial",
    description: "Purpose-built course variants: optimize chamber splits and chase the cleanest clock.",
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
    description: "Course variants under explicit constraints: exact kills, shot discipline, and route restrictions.",
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
    { id: "achievements", label: "Achievements", description: `${progression.snapshot().achievements.length} / ${ACHIEVEMENTS.length} unlocked` },
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
      description: "Run and crouch for local positioning. No jump: every meaningful gap or elevation change belongs to the Warp Rifle."
    }
  ]
});

app.ui.updateScreen("stage-select", {
  title: "Training",
  choices: [{
    id: "training",
    label: "GRAMMAR 01–08",
    description: "Eight focused chambers: learn each core spatial truth before Campaign begins."
  }]
});

app.ui.updateScreen("credits", {
  title: "Credits",
  subtitle: "KILL // WRITE // WARP",
  choices: [
    { id: "credit-design", label: "Design & Development // Mikey Lambo", description: "Traversal FPS concept, game design, direction, and production.", disabled: true },
    { id: "credit-tech", label: "Technology // Three.js + SLU Web Game Shell", description: "Web rendering, input, game flow, persistence, and platform systems.", disabled: true },
    { id: "credit-type", label: "Typography // Rajdhani + Sora", description: "Display and interface type system.", disabled: true },
    { id: "credit-tools", label: "Development Assistance // OpenAI + Anthropic", description: "Design synthesis, engineering assistance, and iteration support.", disabled: true },
    { id: "credit-build", label: "Current Build // v0.7.0", description: "Campaign Field Prototype + Vector Lab v0.", disabled: true }
  ]
});

const originalActivate = app.flow.onActivate.bind(app.flow);
app.flow.onActivate = (screenId: string, choiceId: string) => {
  if (screenId === "main-menu" && choiceId === "achievements") {
    refreshAchievements();
    app.ui.show("achievements");
    return;
  }

  if (screenId === "mode-select") {
    if (choiceId === "training") {
      app.ui.updateScreen("stage-select", {
        title: "Training",
        choices: [{
          id: "training",
          label: "GRAMMAR 01–08",
          description: "Eight focused chambers: Direct Anchor through Reorientation."
        }]
      });
    } else {
      app.ui.updateScreen("stage-select", {
        title: choiceId === "standard" ? "Campaign Sectors" : choiceId === "time-trial" ? "Time Trial Courses" : "Challenge Courses",
        choices: CAMPAIGN_MAPS.map((map) => ({
          id: map.id,
          label: map.label,
          description: !map.implemented
            ? `${map.subtitle} // IN DEVELOPMENT`
            : choiceId === "standard"
              ? `${map.subtitle} // CONTINUOUS FIELD`
              : `${map.subtitle} // ${map.courseRooms.length} CHAMBER COURSE`,
          disabled: !map.implemented
        }))
      });
    }
  }

  if (screenId === "stage-select" && choiceId.startsWith("map-")) {
    contentRuntime.setSelectedMap(choiceId);
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
game.start();

console.info("Traversal FPS ready", {
  shellVersion: "1.0.2+settings+mode-replace",
  shellCommit: "d45d5b89b56eb65cf10cc25ef3a89595d63f6b3f",
  gameVersion: "0.7.0",
  renderTarget: "Vector Surface",
  typography: "Rajdhani / Sora",
  starfield: "shader-twinkle",
  movement: "run + crouch + warp",
  autoStepMeters: 0.38,
  puzzleGrammar: PUZZLE_GRAMMAR_V1.map((entry) => entry.id),
  trainingRooms: ROOMS.length,
  campaignMaps: CAMPAIGN_MAPS.map((map) => ({
    id: map.id,
    implemented: map.implemented,
    campaignFields: map.campaignRooms.length,
    courseRooms: map.courseRooms.length
  })),
  achievements: ACHIEVEMENTS.length,
  hazards: ["lethal-field", "sweep"],
  editor: "Vector Lab v0 // F2",
  mobileControls: true,
  vrStatus: "future-compatible target; not current production scope",
  assemblies: app.composer.listAssemblies()
});
