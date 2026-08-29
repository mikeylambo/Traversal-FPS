/** Adds a Mac-friendly editor shortcut without interfering with the editor's F2 binding. */
export function installEditorShortcut(): void {
  window.addEventListener("keydown", (event) => {
    if (event.code !== "Backquote") return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
    const toggle = document.getElementById("editor-toggle") as HTMLButtonElement | null;
    if (!toggle) return;
    event.preventDefault();
    toggle.click();
  });
}
