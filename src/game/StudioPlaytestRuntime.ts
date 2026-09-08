import {
  installBrowserLifecycle,
  mountBrowserDevConsole
} from "@slu/web-shell";
import type { ContentRuntime } from "./ContentRuntime";
import type { TraversalGame } from "./TraversalGame";

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function installStudioPlaytestRuntime(
  app: any,
  game: TraversalGame,
  content: ContentRuntime,
  canvas: HTMLCanvasElement
): () => void {
  const studio = app.shell.studio;
  const telemetry = studio.telemetry;
  const mutableGame = game as any;

  telemetry.setContext({
    build: "playtest-ready",
    platform: navigator.platform || "browser",
    touch: navigator.maxTouchPoints > 0
  });
  telemetry.record("playtest.ready", {
    campaignMaps: 32,
    timeTrials: 16,
    challenges: 24,
    reversalRooms: 8
  });

  let activeRoomId: string | null = null;
  let activeRoomIndex = -1;

  const originalLoadRoom = mutableGame.loadRoom.bind(game);
  mutableGame.loadRoom = (index: number) => {
    const rooms = content.activeRooms();
    const room = rooms[index];
    const nextRoomId = room?.id ?? `room-${index + 1}`;

    if (activeRoomId !== null) {
      if (index === activeRoomIndex) {
        const position = mutableGame.camera?.position;
        const fell = Number(position?.y ?? 0) < -9;
        if (fell) {
          telemetry.record("player.death", {
            levelId: activeRoomId,
            cause: "fall",
            x: Number(position?.x ?? 0),
            y: Number(position?.y ?? 0),
            z: Number(position?.z ?? 0)
          });
        }
        telemetry.record("game.restart", {
          levelId: activeRoomId,
          reason: fell ? "fall" : "room-reset"
        });
      } else {
        telemetry.record("level.complete", { levelId: activeRoomId });
      }
    }

    const result = originalLoadRoom(index);
    activeRoomId = nextRoomId;
    activeRoomIndex = index;
    telemetry.setContext({
      modeId: app.shell.modes.active()?.id ?? "unknown",
      difficultyId: app.shell.difficulty.active()?.id ?? "unknown",
      contentId: content.selectedContentId(),
      roomId: nextRoomId
    });
    telemetry.record("level.load", {
      levelId: nextRoomId,
      roomIndex: index,
      contentId: content.selectedContentId(),
      contentForm: content.activeForm()
    });
    return result;
  };

  const originalFailChallenge = mutableGame.failChallenge.bind(game);
  mutableGame.failChallenge = (message: string, now: number) => {
    if (activeRoomId) telemetry.record("level.fail", { levelId: activeRoomId, reason: message });
    return originalFailChallenge(message, now);
  };

  const originalFinishRun = mutableGame.finishRun.bind(game);
  mutableGame.finishRun = () => {
    if (activeRoomId) telemetry.record("level.complete", { levelId: activeRoomId });
    telemetry.record("run.complete", {
      contentId: content.selectedContentId(),
      contentForm: content.activeForm(),
      rooms: content.activeRooms().length
    });
    return originalFinishRun();
  };

  const originalStart = game.start.bind(game);
  game.start = () => {
    telemetry.record("run.runtime.start");
    return originalStart();
  };

  studio.dev.register("traversal.content", {
    description: "Show active Traversal content and room count",
    run: () => JSON.stringify({
      id: content.selectedContentId(),
      form: content.activeForm(),
      rooms: content.activeRooms().map((room, index) => ({ index, id: room.id, title: room.title }))
    }, null, 2)
  });
  studio.dev.register("traversal.maps", {
    description: "Show campaign implementation state",
    run: () => JSON.stringify((window as any).__TRAVERSAL_CAMPAIGN_SUMMARY__ ?? [], null, 2)
  });
  studio.dev.register("playtest.clear", {
    description: "Clear local playtest telemetry",
    run: () => { telemetry.clear(); telemetry.record("playtest.cleared"); return "CLEARED"; }
  });
  studio.dev.register("playtest.download", {
    description: "Download the current playtest report",
    run: () => {
      const stamp = new Date().toISOString().replaceAll(":", "-");
      downloadText(`traversal-playtest-${stamp}.json`, JSON.stringify(studio.debugBundle(), null, 2));
      return "DOWNLOADED";
    }
  });

  const stopLifecycle = installBrowserLifecycle({
    onBackground: () => telemetry.record("device.background"),
    onForeground: () => telemetry.record("device.foreground"),
    onControllerConnected: (index, id) => telemetry.record("controller.connected", { index, id }),
    onControllerDisconnected: (index, id) => telemetry.record("controller.disconnected", { index, id }),
    onContextLost: () => {
      telemetry.record("renderer.context-lost");
      studio.diagnostics.capture(new Error("WebGL context lost"), { scope: "renderer" });
    },
    onContextRestored: () => telemetry.record("renderer.context-restored")
  }, canvas);

  const devEnabled = new URLSearchParams(location.search).get("dev") === "1";
  const mountedConsole = devEnabled
    ? mountBrowserDevConsole(studio.dev, { title: "TRAVERSAL DEV" })
    : null;

  return () => {
    mountedConsole?.dispose();
    stopLifecycle();
  };
}
