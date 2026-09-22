/**
 * RC-only editor input hardening.
 * The actual editor owns its panel/state; this only guarantees the shortcut
 * reaches the existing toggle even when another shell listener captures F2.
 */
export function installRCEditorInputFix(): void {
  const activate = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (event.code !== "F2" && event.code !== "Backquote") return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
    const toggle = document.getElementById("editor-toggle") as HTMLButtonElement | null;
    if (!toggle) return;
    event.preventDefault();
    event.stopPropagation();
    toggle.click();
  };
  window.addEventListener("keydown", activate, true);
}
