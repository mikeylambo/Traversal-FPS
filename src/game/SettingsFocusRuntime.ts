import { installSettingsAdjustmentRuntime } from "./SettingsAdjustmentRuntime";
import { installSettingsTabsRuntime } from "./SettingsTabsRuntime";
import { activeTraversalSettingsStore } from "./TraversalSettings";

type FlowLike = {
  onActivate(screenId: string, choiceId: string): void;
  onBack(screenId: string): void;
};

type UILike = {
  move(delta: number): void;
};

/**
 * Compatibility seam retained under the original installer name. Traversal now
 * owns a real tabbed Settings presentation, while the pinned Shell remains the
 * source of screen flow and basic UI navigation.
 */
export function installSettingsFocusRetention(
  flow: FlowLike,
  ui: UILike,
  root: HTMLElement
): void {
  const settings = activeTraversalSettingsStore();
  if (!settings) return;
  installSettingsTabsRuntime(flow, ui, root, settings);
  installSettingsAdjustmentRuntime(flow, root, settings);
}
