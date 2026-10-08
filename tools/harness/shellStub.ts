/**
 * Dev-only stand-in for the private @slu/web-shell package, so the harness can
 * boot the real game where the shell is not installed. Only the surface the
 * game touches during play exists here; menus are not rendered.
 */
type Listener = (...args: unknown[]) => void;

export function createHarnessShell(mode: { id: string; label: string; rules: Record<string, unknown> }) {
  const listeners = new Map<string, Listener[]>();
  const emit = (event: string, ...args: unknown[]) => (listeners.get(event) ?? []).forEach((fn) => fn(...args));
  const difficulty = { id: "standard", label: "Standard", multipliers: { enemySpeed: 1 }, rules: { gravityScalar: 1, goalRadius: 2.3 } };
  const shell = {
    events: { on: (event: string, fn: Listener) => listeners.set(event, [...(listeners.get(event) ?? []), fn]), emit },
    modes: { active: () => mode },
    difficulty: { active: () => difficulty, set: () => undefined },
    session: { phase: "playing" },
    settings: { snapshot: () => ({ reducedMotion: false, screenShake: 1 }) },
    studio: {
      telemetry: { setContext: () => undefined, record: () => undefined, clear: () => undefined },
      dev: { register: () => undefined },
      debugBundle: () => ({}),
      diagnostics: { capture: () => undefined }
    },
    loadLevel: async () => emit("level:loaded")
  };
  const flow = { onActivate: () => undefined, onBack: () => undefined, showResults: () => undefined };
  const ui = { show: () => undefined, updateScreen: () => undefined };
  return { shell, flow, ui };
}

export const installBrowserLifecycle = () => undefined;
export const mountBrowserDevConsole = () => undefined;
