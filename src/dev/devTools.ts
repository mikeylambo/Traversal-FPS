const STORAGE_KEY = "traversal:dev-tools";

/**
 * Single gate for authoring/QA tooling (Level Lab, Map Editor, dev console).
 * On in `vite dev`; in built games only after `?dev=1`, which stays on for that
 * browser until `?dev=0`. Players never see these tools by default.
 */
export function devToolsEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  const flag = new URLSearchParams(location.search).get("dev");
  try {
    if (flag === "1") localStorage.setItem(STORAGE_KEY, "1");
    if (flag === "0") localStorage.removeItem(STORAGE_KEY);
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return flag === "1";
  }
}
