export function installMapEditorNaming(): void {
  const toggle = document.getElementById("editor-toggle");
  if (toggle) toggle.textContent = "F2 // MAP EDITOR";

  const panel = document.getElementById("traversal-editor");
  if (!panel) return;

  const header = panel.querySelector("header div");
  const kicker = header?.querySelector("span");
  const title = header?.querySelector("strong");
  const footer = panel.querySelector("footer");

  if (kicker) kicker.textContent = "BUILD // TEST";
  if (title) title.textContent = "MAP EDITOR";
  if (footer) footer.textContent = "` / F2 TOGGLE // 0.5m SNAP";
}
