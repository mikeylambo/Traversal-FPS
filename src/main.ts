import "./styles.css";
import {
  createArcadeAssembly,
  createFPSAssembly,
  createGameApp,
  createThreeStarterAdapter
} from "@slu/web-shell";
import { TraversalGame } from "./game/TraversalGame";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
const uiRoot = document.getElementById("ui");
if (!canvas || !uiRoot) throw new Error("Traversal FPS boot DOM is incomplete");

const rendererAdapter = createThreeStarterAdapter(canvas);
const app = await createGameApp({
  gameId: "traversal-fps",
  gameName: "Traversal FPS",
  version: "0.1.0",
  renderer: rendererAdapter,
  root: uiRoot,
  assemblies: [
    (shell) => createFPSAssembly({ shell }),
    (shell) => createArcadeAssembly({ shell })
  ]
});

app.ui.updateScreen("loadout", {
  title: "Traversal Rig",
  choices: [
    {
      id: "continue",
      label: "Vector Rig",
      description: "One kill writes one line. Any committed warp consumes it completely."
    }
  ]
});

app.ui.updateScreen("stage-select", {
  title: "Vertical Slice",
  choices: [
    {
      id: "stage-01",
      label: "Five-Room Certification Run",
      description: "Full warp → stop-short → chain → origin → mastery."
    }
  ]
});

const game = new TraversalGame(canvas, app.shell, app.flow);
game.start();

console.info("Traversal FPS ready", {
  shellVersion: "1.0.2",
  shellCommit: "4a7b80a4a50d5bddb0d3ab5aff47657e9703e989",
  assemblies: app.composer.listAssemblies()
});
