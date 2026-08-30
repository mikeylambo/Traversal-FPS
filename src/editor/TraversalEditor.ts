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
import {
  analyzeVectorLandings,
  validateRoom
} from "../world/contentValidation";

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
 * Data-first authoring layer for the same RoomSpec content consumed by gameplay.
 * The editor visualizes authored bounds, moving paths, and the selected sphere's
 * live vector/landing intersections so geometry mistakes are visible before playtest.
 */
export function installTraversalEditor(game: object, content: ContentRuntime): void {
  const state = game as unknown as RuntimeState;
  if (matchMedia("(pointer: coarse)").matches) return;

  const toggle = document.createElement("button");
  toggle.id = "editor-toggle";
  toggle.type = "button";
  toggle.textContent = "F2 // MAP EDITOR";
  document.body.appendChild(toggle);

  const panel = document.createElement("aside");
  panel.id = "traversal-editor";
  panel.innerHTML = `
    <header>
      <div><span>AUTHORING</span><strong>MAP EDITOR // v1</strong></div>
      <button type="button" data-editor="close">CLOSE</button>
    </header>
    <p id="editor-context"></p>
    <section class="editor-block">
      <h3>PLACE</h3>
      <div class="editor-grid">
        <button type="button" data-editor="add-platform">PLATFORM</button>
        <button type="button" data-editor="add-sentry">SENTRY</button>
        <button type="button" data-editor="add-shield">SHIELD</button>
        <button type="button" data-editor="add-drifter">DRIFTER X</button>
        <button type="button" data-editor="add-field">LETHAL FIELD</button>
        <button type="button" data-editor="add-sweep">SWEEP</button>
        <button type="button" data-editor="add-gate">SIGHTLINE GATE</button>
        <button type="button" data-editor="set-spawn">SET SPAWN</button>
        <button type="button" data-editor="set-goal">SET EXIT</button>
      </div>
    </section>
    <section class="editor-block">
      <h3>INSPECT</h3>
      <div class="editor-grid">
        <button type="button" data-editor="toggle-overlays" id="editor-overlays">OVERLAYS ON</button>
        <button type="button" data-editor="audit">AUDIT ROOM</button>
      </div>
      <pre id="editor-validation"></pre>
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
    <footer>F2 toggles // cyan = selected vector // green = safe landing // snap ${SNAP}m</footer>
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

  const overlayRoot = new THREE.Group();
  overlayRoot.name = "map-editor-intelligence";
  overlayRoot.renderOrder = 990;
  state.scene.add(overlayRoot);

  let open = false;
  let overlaysEnabled = true;
  let selection: Selection | null = null;
  const sourceSnapshots = new Map<string, RoomSpec>();

  const room = () => ROOMS[state.roomIndex]!;
  const textarea = panel.querySelector<HTMLTextAreaElement>("#editor-json")!;
  const context = panel.querySelector<HTMLElement>("#editor-context")!;
  const selectionLabel = panel.querySelector<HTMLElement>("#editor-selection")!;
  const selectionInfo = panel.querySelector<HTMLElement>("#editor-selection-info")!;
  const validation = panel.querySelector<HTMLElement>("#editor-validation")!;
  const overlayButton = panel.querySelector<HTMLButtonElement>("#editor-overlays")!;
  const par = panel.querySelector<HTMLElement>("#editor-par")!;

  const rememberSource = () => {
    const current = room();
    if (!sourceSnapshots.has(current.id)) sourceSnapshots.set(current.id, structuredClone(current));
  };

  const toggleOpen = (next = !open) => {
    open = next;
    document.body.classList.toggle("traversal-editor-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    overlayRoot.visible = open && overlaysEnabled;
    if (open) {
      rememberSource();
      state.input.releasePointerLock();
      state.input.setEnabled(false);
      refreshUI();
    } else {
      marker.visible = false;
      clearOverlayRoot();
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
    if (action === "add-shield") {
      addEnemy({ id: nextId("shield"), kind: "shield", position: tuple(pointAhead(10)) });
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
    if (action === "add-gate") {
      addHazard({
        id: nextId("gate"),
        kind: "sightline-gate",
        center: tuple(pointAhead(10)),
        size: [8, 6, 0.5],
        cycle: { period: 2.5, openFor: 0.9 }
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
    if (action === "toggle-overlays") {
      overlaysEnabled = !overlaysEnabled;
      overlayButton.textContent = overlaysEnabled ? "OVERLAYS ON" : "OVERLAYS OFF";
      overlayRoot.visible = overlaysEnabled;
      return refreshOverlays();
    }
    if (action === "audit") {
      refreshValidation();
      context.textContent = `${baseContext()} // AUDIT COMPLETE`;
      return;
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

  function baseContext(): string {
    const current = room();
    return `${content.selectedContentId().toUpperCase()} // ${content.activeForm().toUpperCase()} // ${current.title}`;
  }

  function refreshUI(): void {
    const current = room();
    context.textContent = baseContext();
    par.textContent = String(current.requiredKills);
    overlayButton.textContent = overlaysEnabled ? "OVERLAYS ON" : "OVERLAYS OFF";

    const selected = selectedObject();
    if (!selection || !selected) {
      selectionLabel.textContent = "NONE";
      selectionInfo.textContent = `${current.platforms.length} platforms // ${current.enemies.length} spheres // ${current.hazards?.length ?? 0} hazards`;
      marker.visible = false;
    } else {
      selectionLabel.textContent = `${selection.type.toUpperCase()} ${selection.index + 1}`;
      selectionInfo.textContent = JSON.stringify(selected, null, 2);
      updateMarker(selected);
    }

    refreshValidation();
    refreshOverlays();
  }

  function refreshValidation(): void {
    const current = room();
    const report = validateRoom(current);
    const lines: string[] = [];
    if (report.errors === 0 && report.warnings === 0) {
      lines.push("PASS // STRUCTURE + OBVIOUS LANDINGS");
    } else {
      lines.push(`${report.errors} ERRORS // ${report.warnings} WARNINGS`);
      for (const issue of report.issues.slice(0, 10)) {
        const mark = issue.severity === "error" ? "E" : "W";
        lines.push(`${mark} ${issue.code}${issue.entityId ? ` // ${issue.entityId}` : ""}`);
        lines.push(`  ${issue.message}`);
      }
      if (report.issues.length > 10) lines.push(`+ ${report.issues.length - 10} MORE`);
    }

    const selected = selectedObject();
    if (selection?.type === "enemy" && selected && "position" in selected) {
      const origin = rawTuple(state.camera.position);
      const landings = analyzeVectorLandings(origin, selected.position, current.platforms);
      lines.push("");
      lines.push(`LIVE VECTOR // ${landings.length} SAFE LANDING${landings.length === 1 ? "" : "S"}`);
      for (const landing of landings.slice(0, 5)) {
        lines.push(`  ${Math.round(landing.fraction * 100)}% → PLATFORM ${landing.platformIndex + 1}`);
      }
    }

    validation.textContent = lines.join("\n");
    validation.dataset.state = report.errors > 0 ? "error" : report.warnings > 0 ? "warning" : "pass";
  }

  function refreshOverlays(): void {
    clearOverlayRoot();
    overlayRoot.visible = open && overlaysEnabled;
    if (!open || !overlaysEnabled) return;

    const current = room();
    current.platforms.forEach((platform) => addBoundsOverlay(platform.center, platform.size, 0x64cfe3, 0.18));

    const selected = selectedObject();
    if (!selection || !selected) return;

    if (selection.type === "enemy" && "position" in selected) {
      const origin = rawTuple(state.camera.position);
      addLine(origin, selected.position, 0x73f4ff, 0.95);
      for (const landing of analyzeVectorLandings(origin, selected.position, current.platforms)) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.32, 0.045, 8, 28),
          new THREE.MeshBasicMaterial({
            color: 0xa1ff91,
            transparent: true,
            opacity: 0.95,
            depthTest: false
          })
        );
        ring.position.set(...landing.point);
        ring.rotation.x = Math.PI * 0.5;
        ring.renderOrder = 997;
        overlayRoot.add(ring);
      }
      if (selected.drift) addDriftPath(selected.position, selected.drift.axis, selected.drift.amplitude);
    }

    if (selection.type === "hazard" && "center" in selected && selected.drift) {
      addDriftPath(selected.center, selected.drift.axis, selected.drift.amplitude, 0xff8c75);
    }
  }

  function addBoundsOverlay(center: Vec3Tuple, size: Vec3Tuple, color: number, opacity: number): void {
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(...size));
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false });
    const edges = new THREE.LineSegments(geometry, material);
    edges.position.set(...center);
    edges.renderOrder = 991;
    overlayRoot.add(edges);
  }

  function addLine(a: Vec3Tuple, b: Vec3Tuple, color: number, opacity: number): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...a),
      new THREE.Vector3(...b)
    ]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 996;
    overlayRoot.add(line);
  }

  function addDriftPath(
    center: Vec3Tuple,
    axis: "x" | "y" | "z",
    amplitude: number,
    color = 0xffcf66
  ): void {
    const a: Vec3Tuple = [...center];
    const b: Vec3Tuple = [...center];
    const index = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    a[index] -= amplitude;
    b[index] += amplitude;
    addLine(a, b, color, 0.82);
  }

  function clearOverlayRoot(): void {
    for (const child of [...overlayRoot.children]) {
      child.traverse((object) => {
        const drawable = object as THREE.Mesh | THREE.Line | THREE.LineSegments;
        drawable.geometry?.dispose?.();
        const material = drawable.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material?.dispose?.();
      });
      overlayRoot.remove(child);
    }
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
      context.textContent = `${baseContext()} // DRAFT SAVED`;
    } catch {
      context.textContent = `${baseContext()} // SAVE BLOCKED`;
    }
  }

  function loadDraft(): void {
    try {
      const raw = localStorage.getItem(draftKey());
      if (!raw) return;
      replaceRoom(JSON.parse(raw) as RoomSpec);
    } catch {
      context.textContent = `${baseContext()} // INVALID DRAFT`;
    }
  }

  function exportJson(): void {
    const json = JSON.stringify(room(), null, 2);
    textarea.value = json;
    void navigator.clipboard?.writeText(json).catch(() => undefined);
    refreshValidation();
  }

  function importJson(): void {
    try {
      replaceRoom(JSON.parse(textarea.value) as RoomSpec);
    } catch {
      context.textContent = `${baseContext()} // INVALID ROOM JSON`;
    }
  }

  function resetSource(): void {
    const snapshot = sourceSnapshots.get(room().id);
    if (!snapshot) return;
    replaceRoom(structuredClone(snapshot));
  }

  function replaceRoom(next: RoomSpec): void {
    if (!next || !Array.isArray(next.platforms) || !Array.isArray(next.enemies)) throw new Error("Invalid RoomSpec");
    const report = validateRoom(next);
    if (report.errors > 0) throw new Error(`RoomSpec has ${report.errors} validation errors`);
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

function rawTuple(value: THREE.Vector3): Vec3Tuple {
  return [value.x, value.y, value.z];
}
