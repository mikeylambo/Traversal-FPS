import { startTraversalAudioLoop, type TraversalAudioLoopHandle } from "../audio/TraversalAudio";

type RuntimeState = { shell: { events: { on(event: string, handler: () => void): void } } };

export function installConstructAmbienceRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  let primary: TraversalAudioLoopHandle | null = null;
  let low: TraversalAudioLoopHandle | null = null;
  let restoreTimer = 0;

  const setMix = (a: number, b: number) => {
    primary?.setIntensity(a);
    low?.setIntensity(b);
  };

  const start = () => {
    if (primary || low) return;
    primary = startTraversalAudioLoop("ambience.construct", { x: 0, y: 0, z: 0 });
    low = startTraversalAudioLoop("ambience.construct-low", { x: 0, y: 0, z: 0 });
    setMix(0.12, 0.08);
    window.setTimeout(() => setMix(1, 1), 650);
  };

  const stop = () => {
    window.clearTimeout(restoreTimer);
    primary?.stop();
    low?.stop();
    primary = null;
    low = null;
  };

  state.shell.events.on("level:loaded", start);
  state.shell.events.on("game:quit", stop);

  window.addEventListener("traversal:audio", (raw) => {
    if (!primary && !low) return;
    const event = (raw as CustomEvent<{ event?: string }>).detail?.event ?? "";
    if (event.startsWith("ambience.")) return;
    if (!/^(rifle\.fire|warp\.|rewind\.|hazard\.|exit\.|sector\.)/.test(event)) return;
    setMix(0.68, 0.48);
    window.clearTimeout(restoreTimer);
    restoreTimer = window.setTimeout(() => setMix(1, 1), 720);
  });
}
