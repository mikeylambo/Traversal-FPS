import "../accessibility.css";
import { onAccessibilityChange, traversalAccessibility } from "./TraversalAccessibility";
import type { CvdPreview } from "./TraversalSettings";

/**
 * Turns the accessibility settings into something the rest of the game can read
 * without importing anything: body classes, CSS custom properties, and — for the
 * authoring aid — an SVG colour-vision filter over the frame.
 *
 * World-space consequences (hazard hues, pulse rates, capped FX) are applied by the
 * systems that own those objects; this runtime owns everything in the DOM.
 */
const FILTER_HOST_ID = "traversal-cvd-filters";

/**
 * Viénot/Brettel dichromat simulation matrices. Accurate enough to catch a palette
 * that relies on hue alone, which is the only job they have here.
 */
const CVD_MATRICES: Record<Exclude<CvdPreview, "off">, string> = {
  deuteranopia:
    "0.625 0.375 0 0 0  0.70 0.30 0 0 0  0 0.30 0.70 0 0  0 0 0 1 0",
  protanopia:
    "0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0",
  tritanopia:
    "0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"
};

export function installAccessibilityRuntime(): void {
  ensureFilterHost();
  apply();
  onAccessibilityChange(apply);

  // The OS preference can change while the game is open (a system toggle, an
  // accessibility shortcut). Follow it for players who never opened Settings.
  try {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    query.addEventListener?.("change", apply);
  } catch {
    // matchMedia is unavailable in some embedded contexts; the toggles still work.
  }
}

function apply(): void {
  const access = traversalAccessibility();
  const root = document.documentElement;
  const body = document.body;

  body.classList.toggle("reduce-flash", access.reduceFlash);
  body.classList.toggle("reduce-motion", access.reduceMotion);
  body.classList.toggle("hud-contrast-high", access.hudContrast === "high");
  body.dataset.colorProfile = access.colorProfile;
  body.dataset.cvdPreview = access.cvdPreview;

  root.style.setProperty("--ui-scale", String(access.uiScale));
  // Flash-driven opacities read this instead of hard-coding their peak, so one
  // toggle caps every screen-space flash in the game at once.
  root.style.setProperty("--flash-scale", access.reduceFlash ? "0.34" : "1");
  root.style.setProperty("--motion-scale", access.reduceMotion ? "0.15" : "1");

  const game = document.getElementById("game");
  if (game) {
    game.style.filter = access.cvdPreview === "off" ? "" : `url(#cvd-${access.cvdPreview})`;
  }
}

function ensureFilterHost(): void {
  if (document.getElementById(FILTER_HOST_ID)) return;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = FILTER_HOST_ID;
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  for (const [name, values] of Object.entries(CVD_MATRICES)) {
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", `cvd-${name}`);
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const matrix = document.createElementNS("http://www.w3.org/2000/svg", "feColorMatrix");
    matrix.setAttribute("type", "matrix");
    matrix.setAttribute("values", values);
    filter.appendChild(matrix);
    svg.appendChild(filter);
  }

  document.body.appendChild(svg);
}
