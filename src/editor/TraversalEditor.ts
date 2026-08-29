import * as THREE from "three";
import type { ContentRuntime } from "../game/ContentRuntime";
import {
  ROOMS,
  type EnemySpec,
  type HazardSpec,
  type PlatformSpec,
  type RoomSpec,
  type Vec3Tuple
} from "../world/stages";

type Selection =
  | { type: "platform"; index: number }
  | { type: "enemy"; index: number }
  | { type: "hazard"; index: number };

type RuntimeState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  roomIndex: number;
  loadRoom: (index: number) => void;
  input: {
    setEnabled(value: boolean): void;
    capture(): void;
    releasePointerLock(): void;
  };
};

const SNAP = 0.5;
const DRAFT_PREFIX = "traversal-vector-lab:v0:";

/**
 * Internal authoring layer. It edits the same RoomSpec data the game consumes, then
 * reloads the active field for immediate playtesting. This is intentionally data-first
 * so it can evolve into a player-facing Vector Lab once the schema stabilizes.
 */
export function installTraversalEditor(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  if (matchMedia("(pointer: coarse)").matches) return;

  const toggle = document.createElement("button");
  toggle.id = "editor-toggle";
  toggle.type = "button";
  toggle.textContent = "F2 // VECTOR LAB";
  document.body.appendChild(toggle);

  const panel = document.createElement("aside");
  panel.id = "traversal-editor";
  panel.innerHTML = `
    <header>
      <div><span>INTERNAL AUTHORING</span><strong>VECTOR LAB // v0</strong></div>
      <button type="button" data-editor="close">CLOSE</button>
    </header>
    <p id="editor-context"></p>
    <section class="editor-block">
      <h3>PLACE</h3>
      <div class="editor-grid">
        <button type="button" data-editor="add-platform">PLATFORM</button>
        <button type="button" data-editor="add-sentry">SENTRY</button>
        <button type="button" data-editor="add-drifter">DRIFTER X</button>
        <button type="button" data-editor="add-field">LETHAL FIELD</button>
        <button type="button" data-editor="add-sweep">SWEEP</button>
        <button type="button" data-editor="set-spawn">SET SPAWN</button>
        <button type="button" data-editor="set-goal">SET EXIT</button>
      </div>
    </section>
    <section class="editor-block">
      <h3>SELECTION</h3>
      <div class="editor-row">
        <button type="button" data-editor="prev">◀</button>
        <strong id="editor-selection">NONE</strong>
        <button type="button" data-editor="next">▶</button>
      </div>
      <pre id="editor-selection-info"></pre>
      <div class="editor-grid editor-grid-3">
        <button type="button" data-editor="x-minus">X−</button><button type="button" data-editor="x-plus">X+</button>
        <button type="button" data-editor="y-minus">Y−</button><button type="button" data-editor="y-plus">Y+</button>
        <button type="button" data-editor="z-minus">Z−</button><button type="button" data-editor="z-plus">Z+</button>
        <button type="button" data-editor="wide-minus">WIDTH−</button><button type="button" data-editor="wide-plus">WIDTH+</button>
        <button type="button" data-editor="tall-minus">HEIGHT−</button><button type="button" data-editor="tall-plus">HEIGHT+</button>
        <button type="button" data-editor="deep-minus">DEPTH−</button><button type="button" data-editor="deep-plus">DEPTH+</button>
        <button type="button" data-editor="duplicate">DUPLICATE</button>
        <button type="button" data-editor="delete">DELETE</button>
      </div>
      <div class="editor-row editor-par">
        <span>REQUIRED KILLS</span>
        <button type="button" data-editor="par-minus">−</button>
        <strong id="editor-par"></strong>
        <button type="button" data-editor="par-plus">+</button>
      </div>
    </section>
    <section class="editor-block">
      <h3>DATA</h3>
      <div class="editor-grid">
        <button type="button" data-editor="playtest">RELOAD / TEST</button>
        <button type="button" data-editor="save">SAVE DRAFT</button>
        <button type="button" data-editor="load">LOAD DRAFT</button>
        <button type="button" data-editor="export">EXPORT JSON</button>
        <button type="button" data-editor="import">IMPORT JSON</button>
        <button type="button" data-editor="reset">RESET SOURCE</button>
      </div>
      <textarea id="editor-json" spellcheck="false" placeholder="RoomSpec JSON appears here for export/import."></textarea>
    </section>
    <footer>F2 toggles // placement uses the reticle direction // snap ${SNAP}m</footer>
  `;
  document.body.appendChild(panel);

  const markerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffe36e,
    wireframe: true,
    transparent: true,
    opacity: 0.9,
    depthTest: false
  });
  const marker = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), markerMaterial);
  marker.renderOrder = 999;
  marker.visible = false;
  state.scene.add(marker);

  let open = false;
  let selection: Selection | null = null;
  const sourceSnapshots = new Map<string, RoomSpec>();

  const room = () => ROOMS[state.roomIndex]!;
  const textarea = panel.querySelector<HTMLTextAreaElement>("#editor-json")!;
  const context = panel.querySelector<HTMLElement>("#editor-context")!;
  const selectionLabel = panel.querySelector<HTMLElement>("#editor-selection")!;
  const selectionInfo = panel.querySelector<HTMLElement>("#editor-selection-info")!;
  const par = panel.querySelector<HTMLElement>("#editor-par")!;

  const rememberSource = () => {
    const current = room();
    if (!sourceSnapshots.has(current.id)) sourceSnapshots.set(current.id, structuredClone(current));
  };

  const toggleOpen = (next = !open) => {
    open = next;
    document.body.classList.toggle("traversal-editor-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    if (open) {
      rememberSource();
      state.input.releasePointerLock();
      state.input.setEnabled(false);
      refreshUI();
    } else {
      marker.visible = false;
      state.input.setEnabled(true);
      state.input.capture();
    }
  };

  toggle.addEventListener("click", () => toggleOpen());
  window.addEventListener("keydown", (event) => {
    if (event.code !== "F2" || event.repeat) return;
    if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
    event.preventDefault();
    toggleOpen();
  });

  panel.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-editor]");
    if (!button) return;
    handle(button.dataset.editor ?? "");
  });

  function handle(action: string): void {
    const current = room();
    if (action === "close") return toggleOpen(false);
    if (action === "add-platform") {
      const p = pointAhead(9);
      const spec: PlatformSpec = { center: [p.x, snap(p.y - 2.2), p.z], size: [6, 1, 6] };
      current.platforms.push(spec);
      selection = { type: "platform", index: current.platforms.length - 1 };
      return reload();
    }
    if (action === "add-sentry") {
      addEnemy({ id: nextId("node"), kind: "sentry", position: tuple(pointAhead(10)) });
      return reload();
    }
    if (action === "add-drifter") {
      addEnemy({
        id: nextId("drift"),
        kind: "drifter",
        position: tuple(pointAhead(10)),
        drift: { axis: "x", amplitude: 6, speed: 0.8 }
      });
      return reload();
    }
    if (action === "add-field") {
      addHazard({ id: nextId("field"), kind: "lethal-field", center: tuple(pointAhead(8)), size: [6, 3, 6] });
      return reload();
    }
    if (action === "add-sweep") {
      addHazard({
        id: nextId("sweep"),
        kind: "sweep",
        center: tuple(pointAhead(10)),
        size: [0.5, 7, 14],
        drift: { axis: "x", amplitude: 10, speed: 0.55 }
      });
      return reload();
    }
    if (action === "set-spawn") {
      current.spawn = tuple(state.camera.position);
      return refreshUI();
    }
    if (action === "set-goal") {
      current.goal = [snap(state.camera.position.x), snap(state.camera.position.y - 1.1), snap(state.camera.position.z)];
      return reload();
    }
    if (action === "prev" || action === "next") return cycleSelection(action === "next" ? 1 : -1);
    if (action === "delete") return deleteSelection();
    if (action === "duplicate") return duplicateSelection();
    if (action === "par-minus") {
      current.requiredKills = Math.max(0, current.requiredKills - 1);
      return refreshUI();
    }
    if (action === "par-plus") {
      current.requiredKills += 1;
      return refreshUI();
    }
    if (action === "playtest") return reload();
    if (action === "save") return saveDraft();
    if (action === "load") return loadDraft();
    if (action === "export") return exportJson();
    if (action === "import") return importJson();
    if (action === "reset") return resetSource();

    const movement: Record<string, [number, number, number]> = {
      "x-minus": [-SNAP, 0, 0], "x-plus": [SNAP, 0, 0],
      "y-minus": [0, -SNAP, 0], "y-plus": [0, SNAP, 0],
      "z-minus": [0, 0, -SNAP], "z-plus": [0, 0, SNAP]
    };
    if (movement[action]) return nudge(...movement[action]);

    const resizeMap: Record<string, [number, number, number]> = {
      "wide-minus": [-1, 0, 0], "wide-plus": [1, 0, 0],
      "tall-minus": [0, -1, 0], "tall-plus": [0, 1, 0],
      "deep-minus": [0, 0, -1], "deep-plus": [0, 0, 1]
    };
    if (resizeMap[action]) return resize(...resizeMap[action]);
  }

  function addEnemy(spec: EnemySpec): void {
    room().enemies.push(spec);
    selection = { type: "enemy", index: room().enemies.length - 1 };
  }

  function addHazard(spec: HazardSpec): void {
    room().hazards ??= [];
    room().hazards!.push(spec);
    selection = { type: "hazard", index: room().hazards!.length - 1 };
  }

  function cycleSelection(delta: number): void {
    const flat = flatten(room());
    if (!flat.length) {
      selection = null;
      return refreshUI();
    }
    let index = selection ? flat.findIndex((item) => sameSelection(item.selection, selection!)) : -1;
    index = (index + delta + flat.length) % flat.length;
    selection = flat[index]!.selection;
    refreshUI();
  }

  function nudge(dx: number, dy: number, dz: number): void {
    const target = selectedObject();
    if (!target) return;
    const position = "center" in target ? target.center : target.position;
    position[0] = snap(position[0] + dx);
    position[1] = snap(position[1] + dy);
    position[2] = snap(position[2] + dz);
    reload();
  }

  function resize(dx: number, dy: number, dz: number): void {
    const target = selectedObject();
    if (!target || !("size" in target)) return;
    target.size[0] = Math.max(0.25, snap(target.size[0] + dx));
    target.size[1] = Math.max(0.25, snap(target.size[1] + dy));
    target.size[2] = Math.max(0.25, snap(target.size[2] + dz));
    reload();
  }

  function duplicateSelection(): void {
    const current = room();
    if (!selection) return;
    if (selection.type === "platform") {
      const clone = structuredClone(current.platforms[selection.index]!);
      clone.center[0] += 2;
      current.platforms.push(clone);
      selection = { type: "platform", index: current.platforms.length - 1 };
    } else if (selection.type === "enemy") {
      const clone = structuredClone(current.enemies[selection.index]!);
      clone.id = nextId(clone.kind);
      clone.position[0] += 2;
      current.enemies.push(clone);
      selection = { type: "enemy", index: current.enemies.length - 1 };
    } else {
      current.hazards ??= [];
      const clone = structuredClone(current.hazards[selection.index]!);
      clone.id = nextId(clone.kind);
      clone.center[0] += 2;
      current.hazards.push(clone);
      selection = { type: "hazard", index: current.hazards.length - 1 };
    }
    reload();
  }

  function deleteSelection(): void {
    const current = room();
    if (!selection) return;
    if (selection.type === "platform") current.platforms.splice(selection.index, 1);
    else if (selection.type === "enemy") current.enemies.splice(selection.index, 1);
    else current.hazards?.splice(selection.index, 1);
    selection = null;
    reload();
  }

  function selectedObject(): PlatformSpec | EnemySpec | HazardSpec | null {
    if (!selection) return null;
    const current = room();
    if (selection.type === "platform") return current.platforms[selection.index] ?? null;
    if (selection.type === "enemy") return current.enemies[selection.index] ?? null;
    return current.hazards?.[selection.index] ?? null;
  }

  function refreshUI(): void {
    const current = room();
    context.textContent = `${content.selectedContentId().toUpperCase()} // ${content.activeForm().toUpperCase()} // ${current.title}`;
    par.textContent = String(current.requiredKills);

    const selected = selectedObject();
    if (!selection || !selected) {
      selectionLabel.textContent = "NONE";
      selectionInfo.textContent = `${current.platforms.length} platforms // ${current.enemies.length} targets // ${current.hazards?.length ?? 0} hazards`;
      marker.visible = false;
      return;
    }

    selectionLabel.textContent = `${selection.type.toUpperCase()} ${selection.index + 1}`;
    selectionInfo.textContent = JSON.stringify(selected, null, 2);
    updateMarker(selected);
  }

  function updateMarker(selected: PlatformSpec | EnemySpec | HazardSpec): void {
    const position = "center" in selected ? selected.center : selected.position;
    marker.position.set(...position);
    if ("size" in selected) marker.scale.set(...selected.size);
    else marker.scale.setScalar((selected.radius ?? 0.72) * 2.5);
    marker.visible = open;
  }

  function reload(): void {
    state.loadRoom(state.roomIndex);
    refreshUI();
  }

  function saveDraft(): void {
    try {
      localStorage.setItem(draftKey(), JSON.stringify(room()));
      context.textContent = `${context.textContent} // DRAFT SAVED`;
    } catch {
      context.textContent = `${context.textContent} // SAVE BLOCKED`;
    }
  }

  function loadDraft(): void {
    try {
      const raw = localStorage.getItem(draftKey());
      if (!raw) return;
      replaceRoom(JSON.parse(raw) as RoomSpec);
    } catch {
      context.textContent = `${context.textContent} // INVALID DRAFT`;
    }
  }

  function exportJson(): void {
    const json = JSON.stringify(room(), null, 2);
    textarea.value = json;
    void navigator.clipboard?.writeText(json).catch(() => undefined);
  }

  function importJson(): void {
    try {
      replaceRoom(JSON.parse(textarea.value) as RoomSpec);
    } catch {
      context.textContent = `${context.textContent} // INVALID JSON`;
    }
  }

  function resetSource(): void {
    const snapshot = sourceSnapshots.get(room().id);
    if (!snapshot) return;
    replaceRoom(structuredClone(snapshot));
  }

  function replaceRoom(next: RoomSpec): void {
    if (!next || !Array.isArray(next.platforms) || !Array.isArray(next.enemies)) throw new Error("Invalid RoomSpec");
    ROOMS[state.roomIndex] = structuredClone(next);
    selection = null;
    reload();
  }

  function draftKey(): string {
    return `${DRAFT_PREFIX}${content.selectedContentId()}:${room().id}`;
  }

  function nextId(prefix: string): string {
    const used = new Set([
      ...room().enemies.map((item) => item.id),
      ...(room().hazards ?? []).map((item) => item.id)
    ]);
    let index = used.size + 1;
    while (used.has(`${prefix}-${index}`)) index += 1;
    return `${prefix}-${index}`;
  }

  function pointAhead(distance: number): THREE.Vector3 {
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(state.camera.quaternion);
    const point = state.camera.position.clone().add(direction.multiplyScalar(distance));
    point.set(snap(point.x), snap(point.y), snap(point.z));
    return point;
  }
}

function flatten(room: RoomSpec): Array<{ selection: Selection }> {
  return [
    ...room.platforms.map((_, index) => ({ selection: { type: "platform", index } as Selection })),
    ...room.enemies.map((_, index) => ({ selection: { type: "enemy", index } as Selection })),
    ...(room.hazards ?? []).map((_, index) => ({ selection: { type: "hazard", index } as Selection }))
  ];
}

function sameSelection(a: Selection, b: Selection): boolean {
  return a.type === b.type && a.index === b.index;
}

function snap(value: number): number {
  return Math.round(value / SNAP) * SNAP;
}

function tuple(value: THREE.Vector3): Vec3Tuple {
  return [snap(value.x), snap(value.y), snap(value.z)];
}
