/**
 * One clock for everything that moves in a room: Spheres, hazards and platform
 * cycles all start from zero when the room loads and freeze while paused. Every
 * attempt therefore replays identically, which is what makes timing learnable
 * (and a Time Trial restart fair).
 */
let startedAt = 0;
let pausedAt: number | null = null;

export function resetRoomClock(now = performance.now()): void {
  startedAt = now;
  if (pausedAt !== null) pausedAt = now;
}

export function pauseRoomClock(now = performance.now()): void {
  if (pausedAt === null) pausedAt = now;
}

export function resumeRoomClock(now = performance.now()): void {
  if (pausedAt === null) return;
  startedAt += now - pausedAt;
  pausedAt = null;
}

/** Seconds since the current room attempt began, excluding pauses. */
export function roomTime(now = performance.now()): number {
  return ((pausedAt ?? now) - startedAt) / 1000;
}
