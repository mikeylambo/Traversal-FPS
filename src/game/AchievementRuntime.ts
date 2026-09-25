import { emitTraversalAudio } from "../audio/TraversalAudio";
import type { ContentRuntime } from "./ContentRuntime";
import { ACHIEVEMENTS, type AchievementDefinition, type TraversalProgression } from "./Progression";
import { CHALLENGE_ENTRIES, TIME_TRIAL_ENTRIES } from "../world/modeSuites";
import { ROOMS } from "../world/stages";

const UTILITY_KINDS = new Set(["cube", "diamond", "prism"]);
const ACT_CLEARS: [string, string][] = [["map-08", "act-1"], ["map-18", "act-2"], ["map-30", "act-3"], ["map-42", "campaign-complete"]];
const MEDAL_RANK: Record<string, number> = { bronze: 1, silver: 2, gold: 3 };

interface RuntimeState {
  modeId: string;
  roomIndex: number;
  totalKills: number;
  shots: number;
  roomRestarts: number;
  runStartedAt: number;
  warp: {
    selectionPercent(): number;
    isHoldCancelled?(): boolean;
    commit(position: any): boolean;
  };
  timePenalty(): number;
  loadRoom(index: number): void;
  shoot(): void;
  checkGoal(): void;
  finishRun(): void;
}

export function installAchievementRuntime(
  game: object,
  progression: TraversalProgression,
  content: ContentRuntime
): void {
  const state = game as unknown as RuntimeState;

  syncMainMenuAchievementCount(progression);

  progression.onUnlock((achievement) => {
    showAchievementToast(achievement);
    emitTraversalAudio("achievement.unlock");
    // The Achievements screen already refreshes from main.ts. Keep the main-menu
    // summary in the same live state so it can never say 0 while the detail screen
    // shows unlocked entries.
    queueMicrotask(() => syncMainMenuAchievementCount(progression));
  });

  // Kills since the player last stood on something.
  let airChain = 0;
  const airborne = () => document.body.classList.contains("airborne");
  window.setInterval(() => {
    if (!airborne()) airChain = 0;
  }, 60);

  const originalShoot = state.shoot.bind(game);
  state.shoot = () => {
    const killsBefore = state.totalKills;
    originalShoot();
    if (state.totalKills <= killsBefore) return;
    void progression.unlock("first-vector");
    if (!airborne()) return;
    airChain += 1;
    void progression.unlock("midair");
    if (airChain >= 3) void progression.unlock("thread");
  };

  const originalCommit = state.warp.commit.bind(state.warp);
  state.warp.commit = (position: any) => {
    const fraction = state.warp.selectionPercent();
    const cancelled = state.warp.isHoldCancelled?.() ?? false;
    const committed = originalCommit(position);
    if (committed && fraction < 100) void progression.unlock("stop-short");
    if (committed && fraction <= 25) void progression.unlock("hairline");
    if (!committed && cancelled) void progression.unlock("hold-fire");
    return committed;
  };

  // Campaign sectors advance without finishing a run, so act milestones are read
  // from saved progress whenever the next sector loads.
  const syncMilestones = () => {
    const completed = new Set(progression.snapshot().completedMaps);
    for (const [mapId, achievementId] of ACT_CLEARS) {
      if (completed.has(mapId)) void progression.unlock(achievementId);
    }
  };
  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    syncMilestones();
  };

  const originalCheckGoal = state.checkGoal.bind(game);
  state.checkGoal = () => {
    const roomBefore = state.roomIndex;
    const modeBefore = state.modeId;
    originalCheckGoal();
    if (modeBefore !== "training" || content.selectedContentId() !== "training" || state.roomIndex <= roomBefore) return;
    unlockTrainingRoom(progression, roomBefore);
  };

  const originalFinishRun = state.finishRun.bind(game);
  state.finishRun = () => {
    const elapsed = Math.max(0, (performance.now() - state.runStartedAt) / 1000);
    const modeId = state.modeId;
    const contentId = content.selectedContentId();
    const clean = state.roomRestarts === 0 && state.shots === state.totalKills;
    const adjusted = elapsed + state.timePenalty();
    const kills = state.totalKills;
    const hostiles = ROOMS.reduce((sum, room) => sum + room.enemies.filter((enemy) => !UTILITY_KINDS.has(enemy.kind)).length, 0);
    const suite = content.activeSuite();

    originalFinishRun();

    if (contentId === "training") {
      unlockTrainingRoom(progression, state.roomIndex);
      void progression.unlock("training-complete");
    } else if (contentId === "map-01") {
      void progression.unlock("map-01-complete");
    } else if (contentId === "map-02") {
      void progression.unlock("map-02-complete");
    } else if (contentId === "map-03") {
      void progression.unlock("map-03-complete");
    }
    if (clean) void progression.unlock("clean-run");
    if (modeId === "challenge") void progression.unlock("challenge-clear");
    if (modeId === "time-trial") void progression.unlock("time-trial-clear");
    if (modeId === "reversal") void progression.unlock("reverse-clear");
    if (contentId.startsWith("map-") && modeId === "standard" && hostiles > 0 && kills >= hostiles) {
      void progression.unlock("nothing-left");
    }
    if (modeId === "time-trial" && suite.suite === "time-trial" && suite.index !== null) {
      void recordMedal(progression, suite.index, adjusted);
    }
    if (modeId === "challenge" && suite.suite === "challenge") {
      const cleared = suite.index === null ? CHALLENGE_ENTRIES : [CHALLENGE_ENTRIES[suite.index]!];
      void Promise.all(cleared.map((entry) => progression.recordChallengeClear(entry.id))).then(() => {
        if (progression.snapshot().challengeClears.length >= CHALLENGE_ENTRIES.length) void progression.unlock("exact-all");
      });
    }
    syncMilestones();
    void progression.recordRun(contentId, modeId, elapsed);
  };
}

async function recordMedal(progression: TraversalProgression, index: number, seconds: number): Promise<void> {
  const entry = TIME_TRIAL_ENTRIES[index];
  if (!entry) return;
  const medal = seconds <= entry.goldSeconds ? "gold" : seconds <= entry.silverSeconds ? "silver" : seconds <= entry.bronzeSeconds ? "bronze" : null;
  if (!medal) return;
  const previous = progression.snapshot().timeTrialMedals[entry.id];
  if ((MEDAL_RANK[previous ?? ""] ?? 0) < MEDAL_RANK[medal]!) await progression.recordTimeTrialMedal(entry.id, medal);
  if (medal !== "gold") return;
  void progression.unlock("gold-line");
  const medals = progression.snapshot().timeTrialMedals;
  if (TIME_TRIAL_ENTRIES.every((course) => medals[course.id] === "gold")) void progression.unlock("all-gold");
}

function syncMainMenuAchievementCount(progression: TraversalProgression): void {
  const choice = document.querySelector<HTMLElement>(
    '[data-screen-id="main-menu"] [data-choice-id="achievements"]'
  );
  if (!choice) return;

  const text = `${progression.snapshot().achievements.length} / ${ACHIEVEMENTS.length}`;
  const description = choice.querySelector<HTMLElement>(
    ".slu-choice-description, .slu-choice-desc, [class*='description'], small"
  );
  if (description) {
    description.textContent = text;
    return;
  }

  let fallback = choice.querySelector<HTMLElement>(".traversal-achievement-count");
  if (!fallback) {
    fallback = document.createElement("small");
    fallback.className = "traversal-achievement-count";
    choice.appendChild(fallback);
  }
  fallback.textContent = text;
}

function unlockTrainingRoom(progression: TraversalProgression, roomIndex: number): void {
  if (roomIndex === 2) void progression.unlock("airborne-chain");
  if (roomIndex === 5) void progression.unlock("low-profile");
  if (roomIndex === 6) void progression.unlock("moving-endpoint");
  if (roomIndex === 7) void progression.unlock("reorientation");
}

function showAchievementToast(achievement: AchievementDefinition): void {
  let host = document.getElementById("achievement-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "achievement-toast-host";
    document.body.appendChild(host);
  }

  const toast = document.createElement("div");
  toast.className = "achievement-toast";
  toast.innerHTML = `
    <span>ACHIEVEMENT // UNLOCKED</span>
    <strong>${escapeHtml(achievement.label)}</strong>
    <small>${escapeHtml(achievement.description)}</small>
  `;
  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  window.setTimeout(() => toast.classList.remove("show"), 3300);
  window.setTimeout(() => toast.remove(), 3800);
}

export function achievementChoices(progression: TraversalProgression) {
  return ACHIEVEMENTS.map((achievement) => {
    const unlocked = progression.isUnlocked(achievement.id);
    return {
      id: achievement.id,
      label: `${unlocked ? "✓" : "◇"} ${achievement.label}`,
      description: achievement.description,
      disabled: true
    };
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]!));
}
