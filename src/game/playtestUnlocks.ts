import { devToolsEnabled } from "../dev/devTools";

/**
 * Playtest switch: opens every sector in Campaign and unlocks Time Trial,
 * Challenge and The Reverse regardless of save progress.
 *
 * RELEASE: set to false before shipping. Dev sessions (`?dev=1`) keep the
 * unlocks either way.
 */
export const PLAYTEST_UNLOCK_ALL = true;

export function playtestUnlocked(): boolean {
  return PLAYTEST_UNLOCK_ALL || devToolsEnabled();
}
