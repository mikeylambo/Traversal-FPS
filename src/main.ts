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
import "./level-lab.css";
// Last, so its caps and contrast fixes win over the styles they moderate.
import "./accessibility.css";
import {
  createArcadeAssembly,
  createFPSAssembly,
  createGameApp,
  createThreeStarterAdapter
} from "@slu/web-shell";
import {
  configureTraversalAudio,
  preloadCoreTraversalAudio,
  preloadTraversalAudioEvents
} from "./audio/TraversalAudio";
import { TraversalGame } from "./game/TraversalGame";
import { TraversalSettingsStore } from "./game/TraversalSettings";
import { enhanceTraversalMovement } from "./game/MovementPatch";
import { enhanceGrammarRuntime } from "./game/GrammarRuntimePatch";
import { installContentRuntime } from "./game/ContentRuntime";
import { installHazardRuntime } from "./game/HazardRuntime";
import { installGamepadGameplay } from "./game/GamepadGameplayRuntime";
import { installCombatFeel } from "./game/CombatFeelRuntime";
import { installScopeRuntime } from "./game/ScopeRuntime";
import { installMovementAudioRuntime } from "./game/MovementAudioRuntime";
import { installPlatformMotionAudioRuntime } from "./game/PlatformMotionAudioRuntime";
import { installConstructAmbienceRuntime } from "./game/ConstructAmbienceRuntime";
import { installGameplayClarity } from "./game/GameplayClarityRuntime";
import { installExitGateRuntime } from "./game/ExitGateRuntime";
import { installLandingReadabilityRuntime } from "./game/LandingReadabilityRuntime";
import { installRewindWarpRuntime } from "./game/RewindWarpRuntime";
import { installSectorTransitions } from "./game/SectorTransitionRuntime";
import { installCampaignFlow } from "./game/CampaignFlowRuntime";
import { installOnboardingRuntime } from "./game/OnboardingRuntime";
import { installSettingsFocusRetention } from "./game/SettingsFocusRuntime";
import { installControlsRuntime } from "./game/ControlsRuntime";
import { installUISounds } from "./game/UISoundRuntime";
import { installAccessibilityRuntime } from "./game/AccessibilityRuntime";
import { installSpatialActorRuntime } from "./game/SpatialActorRuntime";
import { TraversalProgression, ACHIEVEMENTS } from "./game/Progression";
import { achievementChoices, installAchievementRuntime } from "./game/AchievementRuntime";
import { enhanceTraversalPresentation } from "./render/enhanceTraversalPresentation";
import { removeCircularEnvironment } from "./render/removeCircularEnvironment";
import { installCampaignFieldPresentation } from "./render/CampaignFieldPresentation";
import { installTraversalEditor } from "./editor/TraversalEditor";
import { installEditorShortcut } from "./editor/EditorShortcutRuntime";
import { installMapEditorNaming } from "./editor/MapEditorNamingRuntime";
import { installLevelLab } from "./dev/LevelLabRuntime";
import { PUZZLE_GRAMMAR_V1 } from "./world/puzzleGrammar";
import { CAMPAIGN_MAPS } from "./world/campaign";
import { CHALLENGE_ENTRIES, TIME_TRIAL_ENTRIES } from "./world/modeSuites";
import { REVERSAL_LABYRINTH_ROOMS } from "./world/reversalLabyrinth";
import { registerCampaign02 } from "./world/registerCampaign02";
import { registerCampaign03 } from "./world/registerCampaign03";
import { registerCampaign04 } from "./world/registerCampaign04";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
const uiRoot = document.getElementById("ui");
if (!canvas || !uiRoot) throw new Error("Traversal FPS boot DOM is incomplete");

registerCampaign02();
registerCampaign03();
registerCampaign04();

const traversalSettings = new TraversalSettingsStore();
const rendererAdapter = createThreeStarterAdapter(canvas);
const app = await createGameApp({
  gameId: "traversal-fps",
  gameName: "Traversal FPS",
  version: "0.15.0-rc-content",
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

app.ui.updateScreen("title", {
  title: "TRAVERSAL",
  subtitle: "PLATFORM SYSTEM // BUILD A BRIGHTER PATH",
  choices: [{ id: "start", label: "Initialize" }]
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
    rules: { grading: false, scoreFocus: false, airGraceScale: 1 }
  },
  {
    id: "time-trial",
    label: "Time Trial",
    description: "16-course optimization suite. Find the fastest route.",
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
    description: "24 chambers across precision, logic, flow and synthesis.",
    leaderboardKey: "score",
    rules: { grading: true, exactKills: true, shotAllowance: 1, airGraceScale: 0.8 }
  },
  {
    id: "reversal",
    label: "THE REVERSE // Labyrinth",
    description: "Postgame. Cross to the hidden side of the Construct and find the way back.",
    rules: { grading: false, scoreFocus: false, airGraceScale: 0.78 }
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

configureTraversalAudio(() => {
  const shellSettings = app.shell.settings.snapshot();
  return {
    master: Number(shellSettings.masterVolume ?? 1),
    music: Number(shellSettings.musicVolume ?? 1),
    sfx: Number(shellSettings.sfxVolume ?? 1)
  };
});
void preloadCoreTraversalAudio();
void preloadTraversalAudioEvents([
  "movement.land-light",
  "movement.land-heavy",
  "scope.engage",
  "scope.disengage"
]);
installAccessibilityRuntime();

const progression = new TraversalProgression(app.storage);
await progression.load();
const contentRuntime = installContentRuntime(app.shell);

const reversalUnlocked = () => {
  const snapshot = progression.snapshot();
  return snapshot.campaign.completed || snapshot.completedMaps.includes("map-42");
};

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

const refreshModeSelect = () => {
  const postgameOpen = reversalUnlocked();
  app.ui.updateScreen("mode-select", {
    title: postgameOpen ? "Select Mode // Construct Reversed" : "Select Mode",
    choices: traversalModes.map((mode) => ({
      id: mode.id,
      label: mode.label,
      description: mode.id === "reversal" && !postgameOpen
        ? "LOCKED // Clear the Campaign to expose the hidden side of the Construct."
        : mode.description,
      disabled: mode.id === "reversal" && !postgameOpen
    }))
  });
};

app.ui.updateScreen("main-menu", {
  title: "TRAVERSAL",
  subtitle: "SIMPLE ELEMENTS. COMPLEX POSSIBILITIES.",
  choices: [
    { id: "play", label: "Play" },
    { id: "achievements", label: "Achievements", description: `${progression.snapshot().achievements.length} / ${ACHIEVEMENTS.length}` },
    { id: "settings", label: "Settings" },
    { id: "credits", label: "Credits" }
  ]
});

refreshModeSelect();

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
    description: "Controls + traversal grammar + spatial actor lessons."
  },
  {
    id: "training-grammar",
    label: "Grammar Replay",
    description: "Replay the complete traversal and spatial actor curriculum."
  }
];

app.ui.updateScreen("stage-select", {
  title: "Training",
  choices: trainingChoices
});

app.ui.updateScreen("credits", {
  title: "Credits",
  subtitle: "",
  choices: [
    { id: "credit-design", label: "Design & Development // Mikey Lambo", disabled: true },
    { id: "credit-tech", label: "Technology // Three.js + SLU Web Game Shell", disabled: true },
    { id: "credit-type", label: "Typography // Rajdhani + Sora", disabled: true },
    { id: "credit-tools", label: "Development Assistance // OpenAI + Anthropic", disabled: true },
    { id: "credit-build", label: "Build // v0.15 RC Content", description: "42 Campaign sectors // 8 Reversal chambers // 24 Challenges // 16 Time Trials", disabled: true }
  ]
});

const sectorChoices = (choiceId: string) => CAMPAIGN_MAPS.map((map) => ({
  id: map.id,
  label: map.label,
  description: !map.implemented
    ? "In development"
    : choiceId === "standard"
      ? map.subtitle
      : `${map.courseRooms.length} sector course`,
  disabled: !map.implemented
}));

const originalActivate = app.flow.onActivate.bind(app.flow);
app.flow.onActivate = (screenId: string, choiceId: string) => {
  if (screenId === "main-menu" && choiceId === "achievements") {
    refreshAchievements();
    app.ui.show("achievements");
    return;
  }

  if (screenId === "main-menu" && choiceId === "play") {
    refreshModeSelect();
  }

  if (screenId === "mode-select") {
    if (choiceId === "training") {
      contentRuntime.setTrainingPath("controls");
      app.ui.updateScreen("stage-select", {
        title: "Training",
        choices: trainingChoices
      });
    } else if (choiceId === "time-trial") {
      app.ui.updateScreen("stage-select", {
        title: "Time Trial",
        choices: [
          {
            id: "suite-time-trial",
            label: "Time Trial // 01–16",
            description: "Sixteen curated route races with medals and distinct spatial families."
          },
          ...sectorChoices(choiceId)
        ]
      });
    } else if (choiceId === "challenge") {
      app.ui.updateScreen("stage-select", {
        title: "Challenge",
        choices: [
          {
            id: "suite-challenge",
            label: "Challenge // 01–24",
            description: "Precision → Logic → Flow → Synthesis."
          },
          ...sectorChoices(choiceId)
        ]
      });
    } else if (choiceId === "reversal") {
      contentRuntime.setModeSuite("reversal");
      app.ui.updateScreen("stage-select", {
        title: "THE REVERSE",
        choices: [
          {
            id: "suite-reversal",
            label: "Enter the Labyrinth // 01–08",
            description: "Eight postgame chambers. Find the way back."
          }
        ]
      });
    } else {
      app.ui.updateScreen("stage-select", {
        title: "Campaign",
        choices: sectorChoices(choiceId)
      });
    }
  }

  if (screenId === "stage-select") {
    if (choiceId === "training-full") contentRuntime.setTrainingPath("controls");
    if (choiceId === "training-grammar") contentRuntime.setTrainingPath("grammar");
    if (choiceId === "suite-time-trial") contentRuntime.setModeSuite("time-trial");
    if (choiceId === "suite-challenge") contentRuntime.setModeSuite("challenge");
    if (choiceId === "suite-reversal") contentRuntime.setModeSuite("reversal");
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

installUISounds(app.flow, uiRoot);
installSettingsFocusRetention(app.flow, app.ui, uiRoot);
installControlsRuntime(app.flow, app.ui as any);

const game = new TraversalGame(canvas, app.shell, app.flow, app.ui, traversalSettings);
enhanceTraversalMovement(game);
enhanceGrammarRuntime(game, contentRuntime);
installSpatialActorRuntime(game);
installAchievementRuntime(game, progression, contentRuntime);
installCampaignFlow(game, contentRuntime);
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
installExitGateRuntime(game);
installLandingReadabilityRuntime(game);
installRewindWarpRuntime(game);
installSectorTransitions(game, contentRuntime);
installOnboardingRuntime(game, contentRuntime);
installMovementAudioRuntime(game);
installPlatformMotionAudioRuntime(game);
installConstructAmbienceRuntime(game);
installEditorShortcut();
installLevelLab(game, contentRuntime, app.shell);
game.start();

console.info("Traversal FPS ready", {
  shellVersion: "1.0.2+settings+mode-replace",
  shellCommit: "d45d5b89b56eb65cf10cc25ef3a89595d63f6b3f",
  puzzleGrammar: PUZZLE_GRAMMAR_V1.length,
  campaignMaps: CAMPAIGN_MAPS.length,
  timeTrials: TIME_TRIAL_ENTRIES.length,
  challenges: CHALLENGE_ENTRIES.length,
  reversalRooms: REVERSAL_LABYRINTH_ROOMS.length
});
