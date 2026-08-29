import type { ContentRuntime } from "./ContentRuntime";
import { ACHIEVEMENTS, type AchievementDefinition, type TraversalProgression } from "./Progression";

interface RuntimeState {
  modeId: string;
  roomIndex: number;
  totalKills: number;
  shots: number;
  roomRestarts: number;
  runStartedAt: number;
  warp: {
    selectionPercent(): number;
    commit(position: any): boolean;
  };
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

  progression.onUnlock(showAchievementToast);

  const originalShoot = state.shoot.bind(game);
  state.shoot = () => {
    const killsBefore = state.totalKills;
    originalShoot();
    if (state.totalKills > killsBefore) void progression.unlock("first-vector");
  };

  const originalCommit = state.warp.commit.bind(state.warp);
  state.warp.commit = (position: any) => {
    const fraction = state.warp.selectionPercent();
    const committed = originalCommit(position);
    if (committed && fraction < 100) void progression.unlock("stop-short");
    return committed;
  };

  const originalCheckGoal = state.checkGoal.bind(game);
  state.checkGoal = () => {
    const roomBefore = state.roomIndex;
    const modeBefore = state.modeId;
    originalCheckGoal();
    if (modeBefore !== "training" || state.roomIndex <= roomBefore) return;
    unlockTrainingRoom(progression, roomBefore);
  };

  const originalFinishRun = state.finishRun.bind(game);
  state.finishRun = () => {
    const elapsed = Math.max(0, (performance.now() - state.runStartedAt) / 1000);
    const modeId = state.modeId;
    const contentId = content.selectedContentId();
    const clean = state.roomRestarts === 0 && state.shots === state.totalKills;

    originalFinishRun();

    if (contentId === "training") {
      unlockTrainingRoom(progression, state.roomIndex);
      void progression.unlock("training-complete");
    } else if (contentId === "map-01") {
      void progression.unlock("map-01-complete");
    }
    if (clean) void progression.unlock("clean-run");
    if (modeId === "challenge") void progression.unlock("challenge-clear");
    if (modeId === "time-trial") void progression.unlock("time-trial-clear");
    void progression.recordRun(contentId, modeId, elapsed);
  };
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
      description: unlocked ? achievement.description : "Locked",
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
