import * as THREE from "three";
import { CAMPAIGN_MAPS } from "../world/campaign";
import {
  buildChallengeSuite,
  buildTimeTrialSuite,
  CHALLENGE_ENTRIES,
  TIME_TRIAL_ENTRIES
} from "../world/modeSuites";
import { buildReversalLabyrinth } from "../world/reversalLabyrinth";
import type { RoomSpec } from "../world/stages";
import { validateRoom } from "../world/contentValidation";
import type { ContentRuntime } from "../game/ContentRuntime";

type LabFamily = "campaign" | "time-trial" | "challenge" | "reversal";
type Triage = "untested" | "keep" | "evolve" | "rework" | "replace";
type CameraPreset = "top" | "side" | "spawn" | "goal" | "free";

type RoomDescriptor = {
  key: string;
  family: LabFamily;
  label: string;
  sublabel: string;
  room: RoomSpec;
  roomIndex: number;
  mapId?: string;
  sourceMapId?: string;
  sourceRoomIndex?: number;
  act?: string;
  challengeFamily?: string;
  medal?: string;
};

type RuntimeState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  roomIndex: number;
  loadRoom(index: number): void;
  beginRun(): void;
  input: {
    setEnabled(value: boolean): void;
    capture(): void;
    releasePointerLock(): void;
  };
};

type ShellLike = {
  modes: {
    activate(id: string): unknown;
    active(): { id: string } | null;
  };
  session: {
    phase: string;
    setPhase?(phase: string): void;
  };
};

const TRIAGE_KEY = "traversal-level-lab:triage:v1";
const NOTE_KEY = "traversal-level-lab:notes:v1";
const CAMERA_SPEED = 22;
const FAST_CAMERA_SPEED = 54;

export function installLevelLab(game: object, content: ContentRuntime, shell: ShellLike): void {
  const enabled = import.meta.env.DEV || new URLSearchParams(location.search).get("lab") === "1";
  if (!enabled || matchMedia("(pointer: coarse)").matches) return;

  const state = game as unknown as RuntimeState;
  const descriptors = buildDescriptors();
  const triage = readRecord<Triage>(TRIAGE_KEY);
  const notes = readRecord<string>(NOTE_KEY);
  const similarity = buildSimilarity(descriptors);
  const root = buildRoot(descriptors.length);
  const grid = root.querySelector<HTMLElement>("[data-lab-grid]")!;
  const detail = root.querySelector<HTMLElement>("[data-lab-detail]")!;
  const search = root.querySelector<HTMLInputElement>("[data-lab-search]")!;
  const compare = root.querySelector<HTMLElement>("[data-lab-compare]")!;
  const compareBody = root.querySelector<HTMLElement>("[data-compare-body]")!;
  const toast = root.querySelector<HTMLElement>("[data-lab-toast]")!;
  const count = root.querySelector<HTMLElement>("[data-lab-count]")!;
  const debugGroup = new THREE.Group();
  debugGroup.name = "LEVEL_LAB_DEBUG";
  debugGroup.renderOrder = 999;
  state.scene.add(debugGroup);

  let open = false;
  let inspectMode = false;
  let family: LabFamily | "all" = "all";
  let triageFilter: Triage | "all" = "all";
  let selected: RoomDescriptor | null = null;
  let compareA: RoomDescriptor | null = null;
  let cameraPreset: CameraPreset = "top";
  let resumeOnClose = false;
  let keys = new Set<string>();
  let lastFrame = performance.now();
  let drag = false;
  let lastPointer = { x: 0, y: 0 };
  let freeYaw = 0;
  let freePitch = -0.2;
  const overlays = { geometry: true, actors: true, hazards: true, paths: true, origin: true };

  document.body.appendChild(root);
  const toggle = document.createElement("button");
  toggle.id = "level-lab-toggle";
  toggle.type = "button";
  toggle.textContent = "F3 // LEVEL LAB";
  document.body.appendChild(toggle);

  function flash(message: string): void {
    toast.textContent = message;
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 900);
  }

  function setOpen(next: boolean): void {
    if (next === open) return;
    open = next;
    root.hidden = !next;
    document.body.classList.toggle("level-lab-open", next);
    if (next) {
      resumeOnClose = shell.session.phase === "playing";
      if (resumeOnClose && shell.session.setPhase) {
        try { shell.session.setPhase("paused"); } catch { /* dev surface may bypass flow policy */ }
      }
      state.input.setEnabled(false);
      state.input.releasePointerLock();
      renderGrid();
    } else {
      setInspectMode(false);
      clearDebug();
      if (resumeOnClose) {
        try { shell.session.setPhase?.("playing"); } catch { shell.session.phase = "playing"; }
        state.input.setEnabled(true);
        state.input.capture();
      }
      resumeOnClose = false;
    }
  }

  function setInspectMode(next: boolean): void {
    inspectMode = next;
    root.classList.toggle("inspect", next);
    if (!next) {
      keys.clear();
      drag = false;
    }
  }

  function renderGrid(): void {
    const q = search.value.trim().toLowerCase();
    const filtered = descriptors.filter((d) => {
      if (family !== "all" && d.family !== family) return false;
      if (triageFilter !== "all" && (triage[d.key] ?? "untested") !== triageFilter) return false;
      if (!q) return true;
      const haystack = [d.label, d.sublabel, d.mapId, d.sourceMapId, d.room.title, d.room.lesson, ...d.room.grammar]
        .filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });

    count.textContent = `${filtered.length} / ${descriptors.length} ROOMS`;
    grid.innerHTML = filtered.map((d) => cardHtml(d, triage[d.key] ?? "untested", similarity.get(d.key)?.[0])).join("");
  }

  function showDetail(d: RoomDescriptor): void {
    selected = d;
    const report = validateRoom(d.room);
    const stats = roomStats(d.room);
    const sims = similarity.get(d.key) ?? [];
    const status = triage[d.key] ?? "untested";
    const note = notes[d.key] ?? "";
    detail.innerHTML = `
      <div class="lab-detail-head">
        <div>
          <span>${esc(d.family.toUpperCase())}${d.act ? ` // ${esc(d.act)}` : ""}</span>
          <h2>${esc(d.label)}</h2>
          <p>${esc(d.sublabel)}</p>
        </div>
        <button data-lab-action="back-grid">BACK TO GRID</button>
      </div>
      <div class="lab-detail-columns">
        <section class="lab-detail-map">
          ${thumbSvg(d.room, true)}
          <div class="lab-metrics">
            <span>PLATFORMS <b>${stats.platforms}</b></span>
            <span>SPHERES <b>${stats.enemies}</b></span>
            <span>HAZARDS <b>${stats.hazards}</b></span>
            <span>PAR <b>${d.room.requiredKills}</b></span>
            <span>SPAN <b>${stats.spanX.toFixed(0)}×${stats.spanZ.toFixed(0)}</b></span>
            <span>HEIGHT <b>${stats.height.toFixed(0)}m</b></span>
          </div>
          <div class="lab-actions-primary">
            <button data-lab-action="inspect" data-key="${esc(d.key)}">INSPECT 3D</button>
            <button data-lab-action="play" data-key="${esc(d.key)}">PLAY ROOM</button>
            <button data-lab-action="compare" data-key="${esc(d.key)}">COMPARE</button>
          </div>
        </section>
        <section class="lab-detail-data">
          <h3>DESIGN READ</h3>
          <p><b>Grammar</b> // ${esc(d.room.grammar.join(" · ") || "none")}</p>
          <p><b>Lesson</b> // ${esc(d.room.lesson)}</p>
          ${d.sourceMapId ? `<p><b>Source</b> // ${esc(d.sourceMapId)} · room ${(d.sourceRoomIndex ?? 0) + 1}</p>` : ""}
          ${d.challengeFamily ? `<p><b>Family</b> // ${esc(d.challengeFamily)}</p>` : ""}
          ${d.medal ? `<p><b>Gold</b> // ${esc(d.medal)}</p>` : ""}
          <h3>VALIDATION</h3>
          <div class="lab-validation ${report.errors ? "error" : report.warnings ? "warn" : "pass"}">
            ${report.errors} ERRORS // ${report.warnings} WARNINGS
            ${report.issues.slice(0, 6).map((i) => `<small>${esc(i.severity.toUpperCase())} · ${esc(i.code)} — ${esc(i.message)}</small>`).join("")}
          </div>
          <h3>NEAREST STRUCTURAL RELATIVES</h3>
          <div class="lab-similar">
            ${sims.slice(0, 4).map((s) => `<button data-lab-select="${esc(s.key)}"><b>${Math.round(s.score * 100)}%</b> ${esc(s.label)}</button>`).join("") || "<small>None</small>"}
          </div>
          <h3>TRIAGE</h3>
          <div class="lab-triage">
            ${(["keep","evolve","rework","replace","untested"] as Triage[]).map((t) =>
              `<button data-lab-triage="${t}" class="${status === t ? "active" : ""}">${t.toUpperCase()}</button>`
            ).join("")}
          </div>
          <textarea data-lab-note placeholder="Playtest note for this room…">${esc(note)}</textarea>
          <button data-lab-action="save-note">SAVE NOTE</button>
        </section>
      </div>
    `;
  }

  function selectByKey(key: string): void {
    const d = descriptors.find((entry) => entry.key === key);
    if (!d) return;
    showDetail(d);
    setInspectMode(false);
    root.classList.add("detail-open");
  }

  function loadDescriptor(d: RoomDescriptor): void {
    if (d.family === "campaign") {
      shell.modes.activate("standard");
      content.setSelectedMap(d.mapId!);
    } else if (d.family === "time-trial") {
      shell.modes.activate("time-trial");
      content.setModeSuite("time-trial");
    } else if (d.family === "challenge") {
      shell.modes.activate("challenge");
      content.setModeSuite("challenge");
    } else {
      shell.modes.activate("reversal");
      content.setModeSuite("reversal");
    }
    content.reloadSelected();
    document.body.classList.add("vector-lab-launching");
    state.beginRun();
    state.loadRoom(d.roomIndex);
    document.body.classList.remove("vector-lab-launching");
    state.input.setEnabled(false);
    state.input.releasePointerLock();
  }

  function inspect(d: RoomDescriptor): void {
    selected = d;
    loadDescriptor(d);
    setInspectMode(true);
    buildDebug(d.room);
    applyCameraPreset("top");
    updateInspectorHud();
    flash("3D INSPECT");
  }

  function play(d: RoomDescriptor, fromCamera = false): void {
    selected = d;
    loadDescriptor(d);
    if (fromCamera) {
      const room = content.activeRooms()[state.roomIndex];
      room.spawn = [
        round(state.camera.position.x),
        round(state.camera.position.y),
        round(state.camera.position.z)
      ];
      state.loadRoom(state.roomIndex);
    }
    clearDebug();
    setInspectMode(false);
    root.hidden = true;
    open = false;
    document.body.classList.remove("level-lab-open");
    try { shell.session.setPhase?.("playing"); } catch { shell.session.phase = "playing"; }
    shell.session.phase = "playing";
    state.input.setEnabled(true);
    state.input.capture();
  }

  function applyCameraPreset(preset: CameraPreset): void {
    if (!selected) return;
    cameraPreset = preset;
    const room = content.activeRooms()[state.roomIndex] ?? selected.room;
    const b = bounds3(room);
    const center = new THREE.Vector3((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 12);
    state.camera.up.set(0, 1, 0);

    if (preset === "top") {
      state.camera.position.set(center.x, b.maxY + span * 1.1 + 18, center.z);
      state.camera.up.set(0, 0, -1);
      state.camera.lookAt(center);
    } else if (preset === "side") {
      state.camera.position.set(b.maxX + span * 1.05 + 12, center.y + span * 0.18, center.z);
      state.camera.up.set(0, 1, 0);
      state.camera.lookAt(center);
    } else if (preset === "spawn") {
      const p = room.spawn;
      state.camera.position.set(p[0], p[1] + 0.4, p[2]);
      state.camera.lookAt(room.goal[0], room.goal[1] + 1.1, room.goal[2]);
    } else if (preset === "goal") {
      const p = room.goal;
      state.camera.position.set(p[0], p[1] + 1.2, p[2]);
      state.camera.lookAt(room.spawn[0], room.spawn[1] + 1.1, room.spawn[2]);
    } else {
      const dir = new THREE.Vector3();
      state.camera.getWorldDirection(dir);
      freeYaw = Math.atan2(-dir.x, -dir.z);
      freePitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    }
    updateInspectorHud();
  }

  function buildDebug(room: RoomSpec): void {
    clearDebug();
    const addBox = (center: readonly number[], size: readonly number[], color: number, category: string) => {
      const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
      const mat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.7, depthTest: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(center[0], center[1], center[2]);
      mesh.userData.labCategory = category;
      debugGroup.add(mesh);
    };
    for (const p of room.platforms) addBox(p.center, p.size, (p.size[1] ?? 1) > 2.4 ? 0x58a6ff : 0x274b75, "geometry");
    for (const h of room.hazards ?? []) addBox(h.center, h.size, 0xff557c, "hazards");

    const spawn = marker(0x64f5c7, 0.6);
    spawn.position.set(...room.spawn);
    spawn.userData.labCategory = "actors";
    debugGroup.add(spawn);
    const goal = marker(0xffcf60, 0.7);
    goal.position.set(...room.goal);
    goal.userData.labCategory = "actors";
    debugGroup.add(goal);

    for (const e of room.enemies) {
      const color = actorColor(e.kind);
      const m = marker(color, e.radius ?? 0.55);
      m.position.set(...e.position);
      m.userData.labCategory = "actors";
      debugGroup.add(m);
      if (e.drift) {
        const a = new THREE.Vector3(...e.position);
        const b = a.clone();
        const axis = e.drift.axis === "x" ? "x" : "y";
        a[axis] -= e.drift.amplitude;
        b[axis] += e.drift.amplitude;
        debugGroup.add(line(a, b, color, "paths"));
      }
      if (e.orbit) {
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= 48; i++) {
          const t = (i / 48) * Math.PI * 2;
          const v = new THREE.Vector3(...e.position);
          if (e.orbit.plane === "xy") { v.x += Math.cos(t) * e.orbit.radiusA; v.y += Math.sin(t) * e.orbit.radiusB; }
          if (e.orbit.plane === "xz") { v.x += Math.cos(t) * e.orbit.radiusA; v.z += Math.sin(t) * e.orbit.radiusB; }
          if (e.orbit.plane === "yz") { v.y += Math.cos(t) * e.orbit.radiusA; v.z += Math.sin(t) * e.orbit.radiusB; }
          points.push(v);
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6, depthTest: false });
        const path = new THREE.Line(geo, mat);
        path.userData.labCategory = "paths";
        debugGroup.add(path);
      }
      if (e.originConstraint) {
        const start = new THREE.Vector3(...e.position);
        const end = start.clone();
        const c = e.originConstraint;
        const sign = typeof c.min === "number" ? -1 : 1;
        if (c.axis === "x") end.x += 7 * sign;
        else if (c.axis === "y") end.y += 7 * sign;
        else end.z += 7 * sign;
        debugGroup.add(line(start, end, 0xffe06a, "origin"));
      }
    }
    applyOverlayVisibility();
  }

  function clearDebug(): void {
    for (const child of [...debugGroup.children]) {
      debugGroup.remove(child);
      const obj = child as THREE.Mesh;
      obj.geometry?.dispose?.();
      const material = obj.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose?.();
    }
  }

  function applyOverlayVisibility(): void {
    for (const child of debugGroup.children) {
      const category = child.userData.labCategory as keyof typeof overlays | undefined;
      child.visible = category ? overlays[category] : true;
    }
    root.querySelectorAll<HTMLElement>("[data-overlay]").forEach((button) => {
      const key = button.dataset.overlay as keyof typeof overlays;
      button.classList.toggle("active", overlays[key]);
    });
  }

  function updateInspectorHud(): void {
    const d = selected;
    if (!d) return;
    const hud = root.querySelector<HTMLElement>("[data-lab-inspector-hud]");
    if (!hud) return;
    const p = state.camera.position;
    hud.innerHTML = `
      <b>${esc(d.label)}</b>
      <span>${esc(d.sublabel)}</span>
      <span>CAM ${cameraPreset.toUpperCase()} // ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}</span>
      <span>FAMILY ${esc(d.room.grammar.join(" · "))}</span>
    `;
  }

  function stepRoom(delta: number): void {
    if (!selected) return;
    const index = descriptors.findIndex((d) => d.key === selected!.key);
    let nextIndex = index + delta;
    while (nextIndex >= 0 && nextIndex < descriptors.length && descriptors[nextIndex]!.family !== selected.family) nextIndex += delta;
    const next = descriptors[nextIndex];
    if (!next || next.family !== selected.family) return;
    inspect(next);
  }

  function openCompare(d: RoomDescriptor): void {
    if (!compareA) {
      compareA = d;
      flash("COMPARE A SET // CHOOSE B");
      setInspectMode(false);
      root.classList.remove("detail-open");
      renderGrid();
      return;
    }
    const a = compareA;
    const b = d;
    compareA = null;
    compareBody.innerHTML = compareHtml(a, b);
    compare.hidden = false;
  }

  function exportQa(): void {
    const payload = {
      generatedAt: new Date().toISOString(),
      build: "level-lab-v1",
      rooms: descriptors.map((d) => {
        const report = validateRoom(d.room);
        return {
          key: d.key,
          family: d.family,
          label: d.label,
          sourceMapId: d.sourceMapId ?? d.mapId ?? null,
          triage: triage[d.key] ?? "untested",
          note: notes[d.key] ?? "",
          grammar: d.room.grammar,
          requiredKills: d.room.requiredKills,
          stats: roomStats(d.room),
          validation: { errors: report.errors, warnings: report.warnings, issues: report.issues },
          nearest: (similarity.get(d.key) ?? []).slice(0, 4)
        };
      })
    };
    downloadJson(`traversal-level-lab-${new Date().toISOString().replaceAll(":", "-")}.json`, payload);
  }

  root.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-lab-select],[data-lab-action],[data-lab-family],[data-lab-triage-filter],[data-lab-triage],[data-camera],[data-overlay]");
    if (!target) return;

    if (target.dataset.labSelect) { selectByKey(target.dataset.labSelect); return; }
    if (target.dataset.labFamily) {
      family = target.dataset.labFamily as LabFamily | "all";
      root.querySelectorAll("[data-lab-family]").forEach((x) => x.classList.toggle("active", (x as HTMLElement).dataset.labFamily === family));
      renderGrid();
      return;
    }
    if (target.dataset.labTriageFilter) {
      triageFilter = target.dataset.labTriageFilter as Triage | "all";
      renderGrid();
      return;
    }
    if (target.dataset.labTriage && selected) {
      triage[selected.key] = target.dataset.labTriage as Triage;
      localStorage.setItem(TRIAGE_KEY, JSON.stringify(triage));
      showDetail(selected);
      renderGrid();
      return;
    }
    if (target.dataset.camera) { applyCameraPreset(target.dataset.camera as CameraPreset); return; }
    if (target.dataset.overlay) {
      const key = target.dataset.overlay as keyof typeof overlays;
      overlays[key] = !overlays[key];
      applyOverlayVisibility();
      return;
    }

    const action = target.dataset.labAction;
    if (action === "close") setOpen(false);
    if (action === "back-grid") { setInspectMode(false); root.classList.remove("detail-open"); clearDebug(); }
    if (action === "inspect") {
      const d = descriptors.find((x) => x.key === target.dataset.key);
      if (d) inspect(d);
    }
    if (action === "play") {
      const d = descriptors.find((x) => x.key === target.dataset.key);
      if (d) play(d);
    }
    if (action === "compare") {
      const d = descriptors.find((x) => x.key === target.dataset.key);
      if (d) openCompare(d);
    }
    if (action === "save-note" && selected) {
      notes[selected.key] = (detail.querySelector<HTMLTextAreaElement>("[data-lab-note]")?.value ?? "").trim();
      localStorage.setItem(NOTE_KEY, JSON.stringify(notes));
      flash("NOTE SAVED");
    }
    if (action === "export") exportQa();
    if (action === "compare-close") compare.hidden = true;
    if (action === "prev") stepRoom(-1);
    if (action === "next") stepRoom(1);
    if (action === "play-camera" && selected) play(selected, true);
    if (action === "editor") {
      const editorToggle = document.getElementById("editor-toggle") as HTMLButtonElement | null;
      if (editorToggle) editorToggle.click();
    }
  });

  search.addEventListener("input", renderGrid);
  root.querySelector<HTMLSelectElement>("[data-lab-triage-filter]")?.addEventListener("change", (event) => {
    triageFilter = (event.currentTarget as HTMLSelectElement).value as Triage | "all";
    renderGrid();
  });
  toggle.addEventListener("click", () => setOpen(!open));

  window.addEventListener("keydown", (event) => {
    const editable = (event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']");
    if (event.code === "F3" && !editable) {
      event.preventDefault();
      setOpen(!open);
      return;
    }
    if (!open || editable) return;
    if (event.code === "Escape") {
      event.preventDefault();
      if (inspectMode) { setInspectMode(false); root.classList.add("detail-open"); clearDebug(); }
      else setOpen(false);
      return;
    }
    if (inspectMode) {
      if (event.code === "BracketLeft") { event.preventDefault(); stepRoom(-1); return; }
      if (event.code === "BracketRight") { event.preventDefault(); stepRoom(1); return; }
      if (event.code === "Digit1") applyCameraPreset("top");
      if (event.code === "Digit2") applyCameraPreset("side");
      if (event.code === "Digit3") applyCameraPreset("spawn");
      if (event.code === "Digit4") applyCameraPreset("goal");
      if (event.code === "Digit5") applyCameraPreset("free");
      keys.add(event.code);
    }
  }, true);
  window.addEventListener("keyup", (event) => keys.delete(event.code), true);

  const canvas = document.getElementById("game-canvas");
  canvas?.addEventListener("pointerdown", (event) => {
    if (!open || !inspectMode || cameraPreset !== "free") return;
    drag = true;
    lastPointer = { x: event.clientX, y: event.clientY };
  });
  window.addEventListener("pointerup", () => { drag = false; });
  window.addEventListener("pointermove", (event) => {
    if (!drag || !open || !inspectMode || cameraPreset !== "free") return;
    freeYaw -= (event.clientX - lastPointer.x) * 0.004;
    freePitch -= (event.clientY - lastPointer.y) * 0.004;
    freePitch = THREE.MathUtils.clamp(freePitch, -1.45, 1.45);
    lastPointer = { x: event.clientX, y: event.clientY };
  });
  canvas?.addEventListener("wheel", (event) => {
    if (!open || !inspectMode) return;
    const dir = new THREE.Vector3();
    state.camera.getWorldDirection(dir);
    state.camera.position.addScaledVector(dir, event.deltaY * -0.018);
    updateInspectorHud();
  }, { passive: true });

  const tick = (now: number) => {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    if (open && inspectMode && cameraPreset === "free") {
      const forward = new THREE.Vector3(-Math.sin(freeYaw) * Math.cos(freePitch), Math.sin(freePitch), -Math.cos(freeYaw) * Math.cos(freePitch));
      const flatForward = new THREE.Vector3(forward.x, 0, forward.z).normalize();
      const right = new THREE.Vector3().crossVectors(flatForward, new THREE.Vector3(0, 1, 0)).normalize();
      const speed = (keys.has("ShiftLeft") || keys.has("ShiftRight") ? FAST_CAMERA_SPEED : CAMERA_SPEED) * dt;
      if (keys.has("KeyW")) state.camera.position.addScaledVector(flatForward, speed);
      if (keys.has("KeyS")) state.camera.position.addScaledVector(flatForward, -speed);
      if (keys.has("KeyA")) state.camera.position.addScaledVector(right, -speed);
      if (keys.has("KeyD")) state.camera.position.addScaledVector(right, speed);
      if (keys.has("KeyE") || keys.has("Space")) state.camera.position.y += speed;
      if (keys.has("KeyQ") || keys.has("ControlLeft")) state.camera.position.y -= speed;
      const target = state.camera.position.clone().add(forward);
      state.camera.up.set(0, 1, 0);
      state.camera.lookAt(target);
      updateInspectorHud();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  renderGrid();
  root.hidden = true;
}

function buildDescriptors(): RoomDescriptor[] {
  const out: RoomDescriptor[] = [];
  for (const map of CAMPAIGN_MAPS.filter((m) => m.implemented)) {
    const sector = Number(map.id.match(/\d+/)?.[0] ?? 0);
    const act = sector <= 8 ? "ACT I" : sector <= 18 ? "ACT II" : sector <= 30 ? "ACT III" : "ACT IV";
    map.campaignRooms.forEach((room, roomIndex) => out.push({
      key: `campaign:${map.id}:${roomIndex}`,
      family: "campaign",
      label: map.label.replace(/^ACT [IVX]+ \/\/ /, ""),
      sublabel: room.title,
      room,
      roomIndex,
      mapId: map.id,
      act
    }));
  }

  buildTimeTrialSuite().forEach((room, roomIndex) => {
    const entry = TIME_TRIAL_ENTRIES[roomIndex];
    out.push({
      key: `time-trial:${room.id}`,
      family: "time-trial",
      label: room.title,
      sublabel: entry ? `SOURCE ${entry.sourceMapId} · ROOM ${entry.sourceRoomIndex + 1}` : "CURATED RACE",
      room, roomIndex,
      sourceMapId: entry?.sourceMapId,
      sourceRoomIndex: entry?.sourceRoomIndex,
      medal: entry ? `${entry.goldSeconds.toFixed(1)}s` : undefined
    });
  });

  buildChallengeSuite().forEach((room, roomIndex) => {
    const entry = CHALLENGE_ENTRIES[roomIndex];
    out.push({
      key: `challenge:${room.id}`,
      family: "challenge",
      label: room.title,
      sublabel: entry ? `${entry.family} · SOURCE ${entry.sourceMapId} · ROOM ${entry.sourceRoomIndex + 1}` : "CURATED CHALLENGE",
      room, roomIndex,
      sourceMapId: entry?.sourceMapId,
      sourceRoomIndex: entry?.sourceRoomIndex,
      challengeFamily: entry?.family
    });
  });

  buildReversalLabyrinth().forEach((room, roomIndex) => out.push({
    key: `reversal:${room.id}`,
    family: "reversal",
    label: `THE REVERSE ${String(roomIndex + 1).padStart(2, "0")} // ${room.title}`,
    sublabel: room.lesson,
    room, roomIndex
  }));
  return out;
}

function buildRoot(total: number): HTMLElement {
  const root = document.createElement("section");
  root.id = "level-lab";
  root.innerHTML = `
    <div class="lab-shell">
      <header class="lab-header">
        <div><span>DEVELOPMENT // RELEASE CANDIDATE QA</span><h1>LEVEL LAB</h1></div>
        <div class="lab-header-actions">
          <span data-lab-count>${total} ROOMS</span>
          <button data-lab-action="export">EXPORT QA</button>
          <button data-lab-action="close">CLOSE // F3</button>
        </div>
      </header>
      <div class="lab-toolbar">
        <nav>
          <button class="active" data-lab-family="all">ALL</button>
          <button data-lab-family="campaign">CAMPAIGN</button>
          <button data-lab-family="time-trial">TIME TRIAL</button>
          <button data-lab-family="challenge">CHALLENGE</button>
          <button data-lab-family="reversal">REVERSE</button>
        </nav>
        <input data-lab-search placeholder="Search title, grammar, source…" />
        <select data-lab-triage-filter aria-label="Triage filter">
          <option value="all">ALL TRIAGE</option>
          <option value="untested">UNTESTED</option>
          <option value="keep">KEEP</option>
          <option value="evolve">EVOLVE</option>
          <option value="rework">REWORK</option>
          <option value="replace">REPLACE</option>
        </select>
      </div>
      <main class="lab-grid" data-lab-grid></main>
      <aside class="lab-detail" data-lab-detail></aside>
      <div class="lab-inspect-chrome">
        <div class="lab-inspector-hud" data-lab-inspector-hud></div>
        <div class="lab-camera-bar">
          <button data-camera="top">1 TOP</button>
          <button data-camera="side">2 SIDE</button>
          <button data-camera="spawn">3 SPAWN</button>
          <button data-camera="goal">4 GOAL</button>
          <button data-camera="free">5 FREE</button>
          <i></i>
          <button class="active" data-overlay="geometry">GEOMETRY</button>
          <button class="active" data-overlay="actors">ACTORS</button>
          <button class="active" data-overlay="hazards">HAZARDS</button>
          <button class="active" data-overlay="paths">PATHS</button>
          <button class="active" data-overlay="origin">ORIGIN</button>
          <i></i>
          <button data-lab-action="prev">[ PREV</button>
          <button data-lab-action="next">] NEXT</button>
          <button data-lab-action="editor">MAP EDITOR</button>
          <button data-lab-action="play-camera">PLAY FROM CAMERA</button>
          <button data-lab-action="back-grid">EXIT INSPECT</button>
        </div>
        <div class="lab-free-help">FREE // drag mouse · WASD move · Q/E vertical · Shift boost · wheel dolly</div>
      </div>
      <div class="lab-compare" data-lab-compare hidden>
        <div class="lab-compare-panel">
          <button data-lab-action="compare-close">CLOSE</button>
          <div data-compare-body></div>
        </div>
      </div>
      <div class="lab-toast" data-lab-toast></div>
    </div>
  `;
  return root;
}

function cardHtml(d: RoomDescriptor, triage: Triage, nearest?: { score: number }): string {
  const report = validateRoom(d.room);
  const stats = roomStats(d.room);
  return `
    <button class="lab-card" data-lab-select="${esc(d.key)}" data-triage="${triage}">
      <div class="lab-card-top">
        <span>${esc(d.family.toUpperCase())}${d.act ? ` · ${esc(d.act)}` : ""}</span>
        <b class="triage-${triage}">${triage.toUpperCase()}</b>
      </div>
      ${thumbSvg(d.room, false)}
      <strong>${esc(d.label)}</strong>
      <small>${esc(d.sublabel)}</small>
      <div class="lab-card-meta">
        <span>P${stats.platforms}</span><span>S${stats.enemies}</span><span>H${stats.hazards}</span>
        <span>PAR ${d.room.requiredKills}</span>
        <span class="${report.errors ? "bad" : report.warnings ? "warn" : "ok"}">${report.errors ? `${report.errors}E` : report.warnings ? `${report.warnings}W` : "PASS"}</span>
        ${nearest && nearest.score > 0.82 ? `<span class="warn">SIM ${Math.round(nearest.score * 100)}%</span>` : ""}
      </div>
    </button>
  `;
}

function thumbSvg(room: RoomSpec, large: boolean): string {
  const w = large ? 720 : 310;
  const h = large ? 360 : 150;
  const b = bounds3(room);
  const pad = large ? 22 : 10;
  const spanX = Math.max(1, b.maxX - b.minX);
  const spanZ = Math.max(1, b.maxZ - b.minZ);
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanZ);
  const x = (v: number) => pad + (v - b.minX) * scale;
  const y = (v: number) => pad + (b.maxZ - v) * scale;
  const parts: string[] = [];

  for (const p of room.platforms) {
    const px = x(p.center[0] - p.size[0] / 2);
    const py = y(p.center[2] + p.size[2] / 2);
    const pw = Math.max(1, p.size[0] * scale);
    const ph = Math.max(1, p.size[2] * scale);
    const wall = p.size[1] > 2.4;
    parts.push(`<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" class="${wall ? "wall" : "platform"}"/>`);
  }
  for (const hazard of room.hazards ?? []) {
    const px = x(hazard.center[0] - hazard.size[0] / 2);
    const py = y(hazard.center[2] + hazard.size[2] / 2);
    parts.push(`<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${Math.max(1, hazard.size[0] * scale).toFixed(1)}" height="${Math.max(1, hazard.size[2] * scale).toFixed(1)}" class="hazard"/>`);
  }
  parts.push(`<line x1="${x(room.spawn[0])}" y1="${y(room.spawn[2])}" x2="${x(room.goal[0])}" y2="${y(room.goal[2])}" class="route"/>`);
  for (const enemy of room.enemies) {
    parts.push(`<circle cx="${x(enemy.position[0])}" cy="${y(enemy.position[2])}" r="${large ? 4.2 : 2.7}" fill="#${actorColor(enemy.kind).toString(16).padStart(6,"0")}"/>`);
  }
  parts.push(`<polygon points="${x(room.spawn[0])},${y(room.spawn[2])-6} ${x(room.spawn[0])-5},${y(room.spawn[2])+4} ${x(room.spawn[0])+5},${y(room.spawn[2])+4}" class="spawn"/>`);
  parts.push(`<rect x="${x(room.goal[0])-4}" y="${y(room.goal[2])-4}" width="8" height="8" class="goal"/>`);
  return `<svg class="lab-thumb" viewBox="0 0 ${w} ${h}" aria-label="Top-down room view">${parts.join("")}</svg>`;
}

function compareHtml(a: RoomDescriptor, b: RoomDescriptor): string {
  const score = similarityScore(a.room, b.room);
  const sa = roomStats(a.room), sb = roomStats(b.room);
  return `
    <header><span>STRUCTURAL COMPARISON</span><h2>${Math.round(score * 100)}% SIMILAR</h2></header>
    <div class="lab-compare-grid">
      <section><h3>${esc(a.label)}</h3><p>${esc(a.family.toUpperCase())}</p>${thumbSvg(a.room, true)}</section>
      <section><h3>${esc(b.label)}</h3><p>${esc(b.family.toUpperCase())}</p>${thumbSvg(b.room, true)}</section>
    </div>
    <div class="lab-compare-table">
      <span>PLATFORMS <b>${sa.platforms}</b> / <b>${sb.platforms}</b></span>
      <span>SPHERES <b>${sa.enemies}</b> / <b>${sb.enemies}</b></span>
      <span>HAZARDS <b>${sa.hazards}</b> / <b>${sb.hazards}</b></span>
      <span>SPAN X <b>${sa.spanX.toFixed(0)}</b> / <b>${sb.spanX.toFixed(0)}</b></span>
      <span>SPAN Z <b>${sa.spanZ.toFixed(0)}</b> / <b>${sb.spanZ.toFixed(0)}</b></span>
      <span>HEIGHT <b>${sa.height.toFixed(0)}</b> / <b>${sb.height.toFixed(0)}</b></span>
    </div>
  `;
}

function buildSimilarity(descriptors: RoomDescriptor[]): Map<string, { key: string; label: string; score: number }[]> {
  const result = new Map<string, { key: string; label: string; score: number }[]>();
  for (const a of descriptors) {
    const ranked = descriptors
      .filter((b) => b.key !== a.key)
      .map((b) => ({ key: b.key, label: b.label, score: similarityScore(a.room, b.room) }))
      .sort((x, y) => y.score - x.score);
    result.set(a.key, ranked);
  }
  return result;
}

function similarityScore(a: RoomSpec, b: RoomSpec): number {
  const av = signature(a), bv = signature(b);
  let distance = 0;
  for (let i = 0; i < av.length; i++) distance += Math.abs(av[i]! - bv[i]!);
  return THREE.MathUtils.clamp(1 - distance / av.length, 0, 1);
}

function signature(room: RoomSpec): number[] {
  const s = roomStats(room);
  const actorKinds = ["sentry","drifter","shield","orbit","cube","diamond","prism"];
  const hazardKinds = ["lethal-field","sweep","sightline-gate","aperture-wall"];
  return [
    norm(s.platforms, 16), norm(s.enemies, 12), norm(s.hazards, 6), norm(room.requiredKills, 10),
    norm(s.spanX, 50), norm(s.spanZ, 170), norm(s.height, 25),
    ...actorKinds.map((kind) => norm(room.enemies.filter((e) => e.kind === kind).length, 6)),
    ...hazardKinds.map((kind) => norm((room.hazards ?? []).filter((h) => h.kind === kind).length, 4)),
    norm(room.platforms.filter((p) => p.size[1] > 2.4).length, 8),
    norm(room.platforms.filter((p) => Boolean(p.motion)).length, 4)
  ];
}

function norm(value: number, max: number): number { return THREE.MathUtils.clamp(value / max, 0, 1); }

function roomStats(room: RoomSpec) {
  const b = bounds3(room);
  return {
    platforms: room.platforms.length,
    enemies: room.enemies.length,
    hazards: room.hazards?.length ?? 0,
    spanX: b.maxX - b.minX,
    spanZ: b.maxZ - b.minZ,
    height: b.maxY - b.minY
  };
}

function bounds3(room: RoomSpec) {
  let minX = room.spawn[0], maxX = room.spawn[0], minY = room.spawn[1], maxY = room.spawn[1], minZ = room.spawn[2], maxZ = room.spawn[2];
  const point = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    minX = Math.min(minX, x - rx); maxX = Math.max(maxX, x + rx);
    minY = Math.min(minY, y - ry); maxY = Math.max(maxY, y + ry);
    minZ = Math.min(minZ, z - rz); maxZ = Math.max(maxZ, z + rz);
  };
  point(...room.goal);
  room.platforms.forEach((p) => point(p.center[0], p.center[1], p.center[2], p.size[0]/2, p.size[1]/2, p.size[2]/2));
  room.enemies.forEach((e) => point(...e.position, 1, 1, 1));
  (room.hazards ?? []).forEach((h) => point(h.center[0], h.center[1], h.center[2], h.size[0]/2, h.size[1]/2, h.size[2]/2));
  const padX = Math.max(3, (maxX-minX)*0.06), padZ = Math.max(3, (maxZ-minZ)*0.04);
  return { minX:minX-padX, maxX:maxX+padX, minY:Math.min(-2,minY-2), maxY:maxY+3, minZ:minZ-padZ, maxZ:maxZ+padZ };
}

function marker(color: number, radius: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 8),
    new THREE.MeshBasicMaterial({ color, wireframe: true, depthTest: false, transparent: true, opacity: 0.9 })
  );
}

function line(a: THREE.Vector3, b: THREE.Vector3, color: number, category: string): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const mat = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.72 });
  const result = new THREE.Line(geo, mat);
  result.userData.labCategory = category;
  return result;
}

function actorColor(kind: string): number {
  return ({
    sentry: 0x7de3ff, drifter: 0xa980ff, orbit: 0xffb266, shield: 0xff6a7d,
    prism: 0xff9dfb, cube: 0xc8f26b, diamond: 0x6bf2f2
  } as Record<string, number>)[kind] ?? 0xffffff;
}

function readRecord<T>(key: string): Record<string, T> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
}
function round(value: number): number { return Math.round(value * 10) / 10; }
