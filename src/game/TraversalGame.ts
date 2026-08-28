import * as THREE from "three";
import { FPSInput } from "../input/FPSInput";
import { WarpSystem } from "../traversal/WarpSystem";
import { ROOMS, type EnemySpec, type PlatformSpec } from "../world/stages";
import type { TraversalSettingsStore } from "./TraversalSettings";

type ActiveEnemy = {
  spec: EnemySpec;
  mesh: THREE.Mesh;
  base: THREE.Vector3;
  alive: boolean;
};

type TimedFx = {
  object: THREE.Object3D;
  material: THREE.MeshBasicMaterial | THREE.LineBasicMaterial;
  born: number;
  duration: number;
  baseOpacity: number;
  grow?: number;
};

const ROOM_ACCENTS = [0x69e7ff, 0xffcf66, 0xff78c8, 0xff9d67, 0xa1ff91];
const PAR_KILLS = ROOMS.reduce((sum, room) => sum + room.requiredKills, 0);
const PAR_SHOTS = PAR_KILLS;
const TUTORIAL_DURATION_MS = 7000;

export class TraversalGame {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(92, 1, 0.05, 240);
  private readonly clock = new THREE.Clock();
  private readonly input: FPSInput;
  private readonly warp: WarpSystem;
  private readonly roomRoot = new THREE.Group();
  private readonly enemies: ActiveEnemy[] = [];
  private readonly platformMeshes: THREE.Mesh[] = [];
  private readonly effects: TimedFx[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly goalMaterial = new THREE.MeshBasicMaterial({ color: 0xb8ff83, transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending, depthWrite: false });
  private readonly goal = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.095, 12, 40), this.goalMaterial);
  private readonly goalLight = new THREE.PointLight(0xaaff82, 4, 9, 2);
  private readonly weapon = new THREE.Group();
  private readonly weaponRest = new THREE.Vector3(0.34, -0.29, -0.68);
  private readonly weaponMuzzle = new THREE.Object3D();
  private weaponCoreMaterial: THREE.MeshStandardMaterial | null = null;

  private roomIndex = 0;
  private yaw = 0;
  private pitch = 0;
  private smoothedLookX = 0;
  private smoothedLookY = 0;
  private velocityY = 0;
  private lastPhase = "";
  private roomKills = 0;
  private roomShots = 0;
  private totalKills = 0;
  private shots = 0;
  private targetHits = 0;
  private warps = 0;
  private roomRestarts = 0;
  private runStartedAt = 0;
  private transientMessage = "";
  private transientUntil = 0;
  private tutorialUntil = 0;
  private pendingRoomResetAt = 0;
  private warpWasTransiting = false;
  private warpArrivalUntil = 0;
  private airGraceUntil = 0;
  private fireReadyAt = 0;
  private weaponKick = 0;
  private runComplete = false;
  private audioContext: AudioContext | null = null;

  private modeId = "standard";
  private modeLabel = "Standard Run";
  private difficultyId = "standard";
  private difficultyLabel = "Standard";
  private gradingEnabled = true;
  private exactKills = false;
  private clockFocus = false;
  private scoreFocus = false;
  private shotAllowance = Number.POSITIVE_INFINITY;
  private missPenaltySeconds = 0;
  private extraKillPenaltySeconds = 0;
  private airGraceScale = 1;
  private enemySpeedScalar = 1;
  private gravityScalar = 1;
  private goalRadius = 2.3;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly shell: any, private readonly flow: any, private readonly ui: any, private readonly gameSettings: TraversalSettingsStore) {
    const captureHint = document.getElementById("capture-hint");
    if (!captureHint) throw new Error("Missing capture hint");
    this.input = new FPSInput(canvas, captureHint);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.36;
    this.scene.background = new THREE.Color(0x0b1420);
    this.scene.fog = new THREE.FogExp2(0x0b1420, 0.012);
    this.scene.add(this.camera, this.roomRoot, this.goal, this.goalLight);
    this.scene.add(new THREE.HemisphereLight(0xd7f4ff, 0x182337, 2.35));
    const key = new THREE.DirectionalLight(0xffffff, 2.8); key.position.set(8, 18, 7); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x72c9ff, 1.25); fill.position.set(-10, 8, -6); this.scene.add(fill);
    this.raycaster.far = 180;
    this.buildWeapon();
    this.warp = new WarpSystem(this.scene);
    this.goal.visible = false;
    this.resize();
    window.addEventListener("resize", () => this.resize());
    shell.events.on("level:loaded", () => this.beginRun());
    shell.events.on("game:pause", () => this.syncPhase("paused"));
    shell.events.on("game:resume", () => { this.syncPhase("playing"); this.input.capture(); });
    shell.events.on("game:quit", () => this.syncPhase("menu"));
  }

  start(): void { this.renderer.setAnimationLoop(() => this.frame()); }

  private beginRun(): void {
    const mode = this.shell.modes.active();
    const difficulty = this.shell.difficulty.active();
    const rules = mode?.rules ?? {};
    this.modeId = mode?.id ?? "standard";
    this.modeLabel = mode?.label ?? "Standard Run";
    this.difficultyId = difficulty?.id ?? "standard";
    this.difficultyLabel = difficulty?.label ?? "Standard";
    this.gradingEnabled = Boolean(rules.grading ?? true);
    this.exactKills = Boolean(rules.exactKills ?? false);
    this.clockFocus = Boolean(rules.clockFocus ?? false);
    this.scoreFocus = Boolean(rules.scoreFocus ?? false);
    this.shotAllowance = rules.shotAllowance === undefined ? Number.POSITIVE_INFINITY : Number(rules.shotAllowance);
    this.missPenaltySeconds = Number(rules.missPenaltySeconds ?? 0);
    this.extraKillPenaltySeconds = Number(rules.extraKillPenaltySeconds ?? 0);
    this.airGraceScale = Number(rules.airGraceScale ?? 1);
    this.enemySpeedScalar = Number(difficulty?.multipliers?.enemySpeed ?? 1);
    this.gravityScalar = Number(difficulty?.rules?.gravityScalar ?? 1);
    this.goalRadius = Number(difficulty?.rules?.goalRadius ?? 2.3);
    this.roomIndex = 0; this.totalKills = 0; this.shots = 0; this.targetHits = 0; this.warps = 0; this.roomRestarts = 0; this.runComplete = false;
    this.runStartedAt = performance.now();
    this.loadRoom(0);
    this.syncPhase("playing");
    this.input.capture();
  }

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 0.033);
    const phase = this.shell.session.phase;
    if (phase !== this.lastPhase) this.syncPhase(phase);
    if (phase === "playing") this.update(dt);
    this.goal.rotation.y += dt * 1.55;
    this.goal.rotation.x = Math.sin(performance.now() * 0.0012) * 0.08;
    this.updateEffects();
    this.renderer.render(this.scene, this.camera);
  }

  private syncPhase(phase: string): void {
    this.lastPhase = phase;
    const playing = phase === "playing";
    document.body.classList.toggle("playing", playing);
    this.input.setEnabled(playing);
    if (!playing) {
      this.input.releasePointerLock();
      document.body.classList.remove("target-hot", "target-blocked", "warp-preview", "warping", "warp-arrival", "anchor-ready");
    }
  }

  private update(dt: number): void {
    const now = performance.now();
    if (this.pendingRoomResetAt > 0) {
      if (now >= this.pendingRoomResetAt) { this.roomRestarts += 1; this.loadRoom(this.roomIndex); } else this.updateHUD();
      return;
    }
    if (this.input.consumeReset()) { this.roomRestarts += 1; this.loadRoom(this.roomIndex); return; }
    if (this.input.consumeTutorialSkip()) this.tutorialUntil = 0;

    const rawLook = this.input.consumeLook();
    const smoothing = THREE.MathUtils.clamp(this.gameSettings.value.aimSmoothing, 0, 0.8);
    this.smoothedLookX = rawLook.x * (1 - smoothing) + this.smoothedLookX * smoothing;
    this.smoothedLookY = rawLook.y * (1 - smoothing) + this.smoothedLookY * smoothing;
    const sensitivity = 0.0021 * this.gameSettings.value.mouseSensitivity;
    const invert = this.gameSettings.value.invertY ? -1 : 1;
    this.yaw -= this.smoothedLookX * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - this.smoothedLookY * sensitivity * invert, -1.48, 1.48);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    this.updateEnemies(now * 0.001);
    this.updateTargetReticle();
    if (this.input.consumeFire()) this.shoot();
    this.warp.updateSelection(this.input.isWarpHeld(), this.input.consumeWheel(), now * 0.001);
    document.body.classList.toggle("warp-preview", this.input.isWarpHeld() && this.warp.hasAnchor());
    document.body.classList.toggle("anchor-ready", this.warp.hasAnchor());
    if (this.input.consumeWarpRelease() && this.warp.commit(this.camera.position)) { this.warps += 1; this.velocityY = 0; this.playWarpStart(); }

    const transiting = this.warp.updateTransit(dt, this.camera.position);
    document.body.classList.toggle("warping", transiting);
    if (!transiting) {
      if (this.warpWasTransiting) {
        this.warpArrivalUntil = now + 210;
        const baseGrace = this.roomIndex === 2 ? 430 : 150;
        this.airGraceUntil = now + baseGrace * this.airGraceScale;
        this.playWarpArrival();
        this.addArrivalFx(this.camera.position.clone());
      }
      this.updateMovement(dt, now);
    }
    this.warpWasTransiting = transiting;
    document.body.classList.toggle("warp-arrival", now < this.warpArrivalUntil);
    this.updateCameraPresentation(); this.updateWeapon(dt); this.checkGoal(); this.updateHUD();
  }

  private updateMovement(dt: number, now: number): void {
    const move = this.input.movement();
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    this.camera.position.addScaledVector(forward.multiplyScalar(move.z).add(right.multiplyScalar(move.x)), 7.5 * dt);
    const previousY = this.camera.position.y;
    if (now >= this.airGraceUntil) { this.velocityY -= 18 * this.gravityScalar * dt; this.camera.position.y += this.velocityY * dt; } else this.velocityY = 0;
    this.resolvePlatforms(previousY);
    if (this.camera.position.y < -9.5) { this.roomRestarts += 1; this.loadRoom(this.roomIndex); }
  }

  private resolvePlatforms(previousY: number): void {
    const room = ROOMS[this.roomIndex];
    for (const platform of room.platforms) {
      const [cx, cy, cz] = platform.center; const [sx, sy, sz] = platform.size;
      const inside = Math.abs(this.camera.position.x - cx) <= sx * 0.5 - 0.15 && Math.abs(this.camera.position.z - cz) <= sz * 0.5 - 0.15;
      if (!inside) continue;
      const standingY = cy + sy * 0.5 + 1.7;
      if (this.velocityY <= 0 && this.camera.position.y <= standingY + 0.2 && previousY >= standingY - 0.5) { this.camera.position.y = standingY; this.velocityY = 0; return; }
    }
  }

  private shoot(): void {
    const now = performance.now();
    if (now < this.fireReadyAt || this.runComplete || this.pendingRoomResetAt > 0) return;
    this.fireReadyAt = now + 105; this.shots += 1; this.roomShots += 1; this.weaponKick = 1; this.playShot();
    const room = ROOMS[this.roomIndex];
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const liveMeshes = this.enemies.filter((enemy) => enemy.alive).map((enemy) => enemy.mesh);
    const hit = this.raycaster.intersectObjects([...liveMeshes, ...this.platformMeshes], false)[0];
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const endPoint = hit?.point.clone() ?? this.camera.position.clone().add(direction.multiplyScalar(120));
    this.addShotTrace(endPoint);

    if (!hit) { this.enforceChallengeShotBudget(now); return; }
    const enemy = this.enemies.find((candidate) => candidate.mesh === hit.object);
    if (!enemy) { this.addImpactFx(hit.point.clone(), 0x9edcff); this.enforceChallengeShotBudget(now); return; }

    this.targetHits += 1;
    if (enemy.spec.kind === "shield" && this.camera.position.x < 2.5) {
      this.flashMessage("SHIELD REJECT // CHANGE YOUR FIRING ORIGIN", 1800); this.playShieldReject(); this.addImpactFx(hit.point.clone(), 0xffa665); this.enforceChallengeShotBudget(now); return;
    }

    const deathPosition = enemy.mesh.position.clone();
    enemy.alive = false; enemy.mesh.visible = false; this.roomKills += 1; this.totalKills += 1;
    this.addKillFx(deathPosition, enemy.spec.kind); this.playKill();
    if (this.exactKills && this.roomKills > room.requiredKills) { this.failChallenge("CLEAN ROUTE FAILED // EXTRA KILL", now); return; }
    if (this.enforceChallengeShotBudget(now)) return;
    this.warp.write(this.camera.position.clone(), deathPosition);
    this.flashMessage(this.roomKills > room.requiredKills ? "EXTRA KILL // ROUTE EFFICIENCY DOWN" : "WARP VECTOR WRITTEN", this.roomKills > room.requiredKills ? 1800 : 1000);
  }

  private enforceChallengeShotBudget(now: number): boolean {
    if (!Number.isFinite(this.shotAllowance)) return false;
    const misses = Math.max(0, this.roomShots - this.roomKills);
    if (misses <= this.shotAllowance) return false;
    this.failChallenge("CLEAN ROUTE FAILED // MISS BUDGET EXCEEDED", now);
    return true;
  }

  private failChallenge(message: string, now: number): void { this.warp.reset(); this.flashMessage(message, 1500); this.pendingRoomResetAt = now + 1150; }

  private updateTargetReticle(): void {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const liveMeshes = this.enemies.filter((enemy) => enemy.alive).map((enemy) => enemy.mesh);
    const hit = this.raycaster.intersectObjects([...liveMeshes, ...this.platformMeshes], false)[0];
    const enemy = hit ? this.enemies.find((candidate) => candidate.mesh === hit.object) : undefined;
    const blockedShield = Boolean(enemy?.spec.kind === "shield" && this.camera.position.x < 2.5);
    document.body.classList.toggle("target-hot", Boolean(enemy) && !blockedShield);
    document.body.classList.toggle("target-blocked", blockedShield);
  }

  private updateEnemies(time: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (enemy.spec.drift) { const offset = Math.sin(time * enemy.spec.drift.speed * this.enemySpeedScalar) * enemy.spec.drift.amplitude; enemy.mesh.position.copy(enemy.base); enemy.mesh.position[enemy.spec.drift.axis] += offset; }
      enemy.mesh.rotation.x += 0.012 * this.enemySpeedScalar; enemy.mesh.rotation.y += 0.018 * this.enemySpeedScalar;
    }
  }

  private updateCameraPresentation(): void {
    const baseFov = this.gameSettings.value.fov;
    const reducedMotion = Boolean(this.shell.settings.snapshot().reducedMotion);
    let targetFov = baseFov;
    if (this.warp.isTransiting()) { const pulse = Math.sin(this.warp.transitProgress() * Math.PI); targetFov += reducedMotion ? 3 : 8 + pulse * 8; }
    else if (this.input.isWarpHeld() && this.warp.hasAnchor()) targetFov += reducedMotion ? 0 : 2;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.22); this.camera.updateProjectionMatrix();
    const shake = Number(this.shell.settings.snapshot().screenShake ?? 1);
    this.camera.rotation.z = !reducedMotion && this.warp.isTransiting() ? Math.sin(performance.now() * 0.04) * 0.006 * shake : 0;
    document.documentElement.style.setProperty("--reticle-scale", String(this.gameSettings.value.reticleScale));
  }

  private checkGoal(): void {
    if (this.runComplete || this.pendingRoomResetAt > 0) return;
    const room = ROOMS[this.roomIndex];
    if (this.exactKills ? this.roomKills !== room.requiredKills : this.roomKills < room.requiredKills) return;
    if (this.camera.position.distanceTo(this.goal.position) > this.goalRadius) return;
    if (this.roomIndex >= ROOMS.length - 1) { this.finishRun(); return; }
    this.roomIndex += 1; this.loadRoom(this.roomIndex);
  }

  private finishRun(): void {
    this.runComplete = true; this.input.releasePointerLock();
    const elapsed = (performance.now() - this.runStartedAt) / 1000;
    const accuracy = this.shots > 0 ? (this.targetHits / this.shots) * 100 : 0;
    const extraKills = this.extraKills(); const extraShots = Math.max(0, this.shots - PAR_SHOTS); const routeGrade = this.routeGrade(extraKills);
    const penalty = this.timePenalty(); const adjustedTime = elapsed + penalty; const score = this.runScore(elapsed);
    const title = this.modeId === "training" ? "Training Complete" : this.modeId === "time-trial" ? "Time Trial Complete" : this.modeId === "challenge" ? "Clean Route Complete" : "Run Complete";
    const summary = this.modeId === "training" ? `${this.difficultyLabel} · Five rooms cleared` : `${this.modeLabel} · ${this.difficultyLabel}`;
    let resultChoices: Array<{ id: string; label: string; description: string; disabled: boolean }>;
    if (this.modeId === "training") resultChoices = [
      { id: "result-time", label: `Time // ${this.formatTime(elapsed)}`, description: `${this.warps} warps · ${this.roomRestarts} restarts`, disabled: true },
      { id: "result-shots", label: `Shots Fired // ${this.shots}`, description: `${PAR_SHOTS} theoretical minimum · +${extraShots} over`, disabled: true },
      { id: "result-kills", label: `Kills // ${this.totalKills}`, description: `${PAR_KILLS} is the minimum route`, disabled: true }
    ];
    else if (this.modeId === "time-trial") resultChoices = [
      { id: "result-adjusted", label: `Adjusted Time // ${this.formatTime(adjustedTime)}`, description: `Raw ${this.formatTime(elapsed)} · penalties +${penalty.toFixed(2)}s`, disabled: true },
      { id: "result-shots", label: `Shots Fired // ${this.shots}`, description: `${this.wastedShots()} non-kill shots · +${extraShots} over theoretical minimum`, disabled: true },
      { id: "result-route", label: `Route // ${this.totalKills} Kills`, description: `${PAR_KILLS} minimum · +${extraKills} extra`, disabled: true },
      { id: "result-aim", label: `Target Accuracy // ${accuracy.toFixed(0)}%`, description: `${this.targetHits} target hits / ${this.shots} shots`, disabled: true }
    ];
    else if (this.modeId === "challenge") resultChoices = [
      { id: "result-route", label: "Clean Route // PASS", description: `${this.totalKills} kills · exact route requirement met`, disabled: true },
      { id: "result-shots", label: `Shots Fired // ${this.shots}`, description: `${this.wastedShots()} non-kill shots · one miss allowance per room`, disabled: true },
      { id: "result-aim", label: `Target Accuracy // ${accuracy.toFixed(0)}%`, description: `${this.targetHits} target hits / ${this.shots} shots`, disabled: true },
      { id: "result-time", label: `Time // ${this.formatTime(elapsed)}`, description: `${this.warps} warps · ${this.roomRestarts} restarts`, disabled: true }
    ];
    else resultChoices = [
      { id: "result-score", label: `Run Score // ${score.toLocaleString()}`, description: "Time + route discipline + shots fired + restarts", disabled: true },
      { id: "result-route", label: `Route Grade // ${routeGrade}`, description: `${this.totalKills} kills · ${PAR_KILLS} minimum · +${extraKills} extra`, disabled: true },
      { id: "result-shots", label: `Shots Fired // ${this.shots}`, description: `${PAR_SHOTS} theoretical minimum · +${extraShots} over`, disabled: true },
      { id: "result-aim", label: `Target Accuracy // ${accuracy.toFixed(0)}%`, description: `${this.targetHits} target hits / ${this.shots} shots`, disabled: true },
      { id: "result-time", label: `Time // ${this.formatTime(elapsed)}`, description: `${this.warps} warps · ${this.roomRestarts} restarts`, disabled: true }
    ];
    this.ui.updateScreen("results", { title, subtitle: summary, choices: [...resultChoices, { id: "retry", label: "Retry" }, { id: "continue", label: "Change Mode" }, { id: "menu", label: "Main Menu" }] });
    this.flow.showResults();
  }

  private routeGrade(extraKills: number): string { if (!this.gradingEnabled) return "—"; if (extraKills === 0) return "A+"; if (extraKills === 1) return "A"; if (extraKills === 2) return "B"; if (extraKills === 3) return "C"; if (extraKills === 4) return "D"; return "E"; }
  private wastedShots(): number { return Math.max(0, this.shots - this.totalKills); }
  private extraKills(): number { return Math.max(0, this.totalKills - PAR_KILLS); }
  private timePenalty(): number { return this.wastedShots() * this.missPenaltySeconds + this.extraKills() * this.extraKillPenaltySeconds; }
  private runScore(elapsed: number): number { return Math.max(0, Math.round(12000 - (elapsed * 20 + this.extraKills() * 350 + this.wastedShots() * 55 + this.roomRestarts * 250))); }

  private loadRoom(index: number): void {
    const room = ROOMS[index];
    this.clearEffects(); this.roomRoot.clear(); this.platformMeshes.length = 0; this.enemies.length = 0; this.warp.reset();
    this.roomKills = 0; this.roomShots = 0; this.velocityY = 0; this.airGraceUntil = 0; this.yaw = 0; this.pitch = 0; this.smoothedLookX = 0; this.smoothedLookY = 0; this.pendingRoomResetAt = 0; this.warpWasTransiting = false;
    this.camera.position.set(...room.spawn); this.camera.rotation.set(0, 0, 0);
    for (const platform of room.platforms) this.addPlatform(platform);
    for (const spec of room.enemies) this.addEnemy(spec);
    this.goal.position.set(...room.goal); this.goalLight.position.copy(this.goal.position); this.goal.visible = true;
    this.tutorialUntil = performance.now() + TUTORIAL_DURATION_MS;
    this.flashMessage("", 0);
  }

  private addPlatform(spec: PlatformSpec): void {
    const accent = ROOM_ACCENTS[this.roomIndex % ROOM_ACCENTS.length]!;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...spec.size), new THREE.MeshStandardMaterial({ color: 0x26384f, emissive: accent, emissiveIntensity: 0.065, roughness: 0.72, metalness: 0.2 }));
    mesh.position.set(...spec.center); this.roomRoot.add(mesh); this.platformMeshes.push(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.58 }));
    edges.position.copy(mesh.position); this.roomRoot.add(edges);
  }

  private addEnemy(spec: EnemySpec): void {
    const color = spec.kind === "shield" ? 0xffad66 : spec.kind === "drifter" ? 0xff78c8 : 0x7cefff;
    const radius = spec.radius ?? 0.72;
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.42, roughness: 0.22, metalness: 0.46 });
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), material); mesh.position.set(...spec.position);
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.17, 1), new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.26 }));
    mesh.add(shell); this.roomRoot.add(mesh); this.enemies.push({ spec, mesh, base: mesh.position.clone(), alive: true });
  }

  private buildWeapon(): void {
    const shellMaterial = new THREE.MeshStandardMaterial({ color: 0xdfe9f2, metalness: 0.72, roughness: 0.2 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x172536, metalness: 0.8, roughness: 0.24 });
    this.weaponCoreMaterial = new THREE.MeshStandardMaterial({ color: 0x9df8ff, emissive: 0x2ee9ff, emissiveIntensity: 2.4, metalness: 0.18, roughness: 0.16 });
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.76), darkMaterial);
    const upperShell = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.07, 0.58), shellMaterial); upperShell.position.y = 0.09; upperShell.position.z = -0.08;
    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.065, 0.72), shellMaterial); const rightRail = leftRail.clone(); leftRail.position.set(-0.13, 0.01, -0.08); rightRail.position.set(0.13, 0.01, -0.08);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.48, 12), this.weaponCoreMaterial); core.rotation.x = Math.PI / 2; core.position.set(0, -0.005, -0.08);
    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.017, 8, 28), new THREE.MeshBasicMaterial({ color: 0x9df8ff, blending: THREE.AdditiveBlending })); muzzle.position.z = -0.48;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.3, 0.16), darkMaterial); grip.position.set(0, -0.2, 0.18); grip.rotation.x = -0.24;
    this.weaponMuzzle.position.set(0, 0, -0.51); this.weapon.add(spine, upperShell, leftRail, rightRail, core, muzzle, grip, this.weaponMuzzle); this.weapon.position.copy(this.weaponRest); this.weapon.rotation.z = -0.035; this.camera.add(this.weapon);
  }

  private updateWeapon(dt: number): void {
    this.weaponKick *= Math.pow(0.002, dt); this.weapon.position.copy(this.weaponRest); this.weapon.position.z += this.weaponKick * 0.085; this.weapon.position.y -= this.weaponKick * 0.015; this.weapon.rotation.x = this.weaponKick * 0.045; this.weapon.rotation.z = -0.035 - this.weaponKick * 0.018;
    if (this.weaponCoreMaterial) this.weaponCoreMaterial.emissiveIntensity = 2.2 + this.weaponKick * 4.5 + (this.warp.hasAnchor() ? 0.75 : 0);
  }

  private updateHUD(): void {
    const room = ROOMS[this.roomIndex];
    const roomLabel = document.getElementById("room-label"); const stats = document.getElementById("run-stats"); const anchor = document.getElementById("anchor-status"); const tutorialCard = document.getElementById("tutorial-card"); const tutorialRoom = document.getElementById("tutorial-room"); const tutorialText = document.getElementById("tutorial-text");
    if (!roomLabel || !stats || !anchor || !tutorialCard || !tutorialRoom || !tutorialText) return;
    const roomNumber = String(this.roomIndex + 1).padStart(2, "0");
    if (this.modeId === "challenge") {
      const misses = Math.max(0, this.roomShots - this.roomKills);
      roomLabel.textContent = `ROOM ${roomNumber}  ·  CLEAN ${this.roomKills}/${room.requiredKills} KILLS  ·  MISSES ${misses}/${this.shotAllowance}`;
    } else roomLabel.textContent = `ROOM ${roomNumber}  ·  MIN ${room.requiredKills}  ·  K ${this.roomKills}`;
    const elapsed = (performance.now() - this.runStartedAt) / 1000;
    if (this.clockFocus) { const penalty = this.timePenalty(); stats.textContent = `TIME TRIAL  ·  RAW ${this.formatTime(elapsed)}  ·  PEN +${penalty.toFixed(2)}  ·  ADJ ${this.formatTime(elapsed + penalty)}  ·  ${this.shots} SHOTS`; }
    else if (this.scoreFocus) stats.textContent = `STANDARD  ·  SCORE ${this.runScore(elapsed).toLocaleString()}  ·  ${this.formatTime(elapsed)}  ·  ${this.totalKills}K  ·  ${this.shots}S  ·  ${this.warps}W`;
    else stats.textContent = `${this.modeLabel.toUpperCase()}  ·  ${this.difficultyLabel.toUpperCase()}  ·  ${this.formatTime(elapsed)}  ·  ${this.totalKills}K  ·  ${this.shots}S  ·  ${this.warps}W`;
    tutorialRoom.textContent = `ROOM ${roomNumber}`;
    tutorialText.textContent = this.modeId === "challenge" ? `CLEAN ROUTE: EXACT ${room.requiredKills} KILLS · MAX ${this.shotAllowance} MISS · ${room.lesson} · [T] SKIP` : `${room.lesson} · [T] SKIP`;
    tutorialCard.classList.toggle("visible", performance.now() < this.tutorialUntil);
    if (performance.now() < this.transientUntil && this.transientMessage) anchor.textContent = this.transientMessage;
    else if (performance.now() < this.airGraceUntil && this.roomIndex === 2) anchor.textContent = "PHASE HANG // REACQUIRE TARGET TWO";
    else if (this.warp.hasAnchor()) anchor.textContent = this.input.isWarpHeld() ? `VECTOR ${this.warp.selectionPercent()}% // WHEEL TO PLACE // RELEASE RMB` : "VECTOR READY // HOLD RMB";
    else if (this.modeId === "challenge") anchor.textContent = "CLEAN ROUTE // EXACT KILLS // ONE MISS MAX";
    else anchor.textContent = "NO VECTOR // KILL A TARGET TO WRITE";
  }

  private flashMessage(message: string, duration = 900): void { this.transientMessage = message; this.transientUntil = performance.now() + duration; }
  private addShotTrace(end: THREE.Vector3): void { this.camera.updateMatrixWorld(true); const start = new THREE.Vector3(); this.weaponMuzzle.getWorldPosition(start); const geometry = new THREE.BufferGeometry().setFromPoints([start, end]); const material = new THREE.LineBasicMaterial({ color: 0xc9fbff, transparent: true, opacity: 0.92 }); const line = new THREE.Line(geometry, material); this.scene.add(line); this.effects.push({ object: line, material, born: performance.now(), duration: 105, baseOpacity: 0.92 }); }
  private addImpactFx(position: THREE.Vector3, color: number): void { const material = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.9 }); const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), material); mesh.position.copy(position); this.scene.add(mesh); this.effects.push({ object: mesh, material, born: performance.now(), duration: 220, baseOpacity: 0.9, grow: 2.2 }); }
  private addKillFx(position: THREE.Vector3, kind: EnemySpec["kind"]): void { const color = kind === "shield" ? 0xffa45e : kind === "drifter" ? 0xff72c5 : 0x78f7ff; const material = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 1 }); const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.78, 1), material); mesh.position.copy(position); this.scene.add(mesh); this.effects.push({ object: mesh, material, born: performance.now(), duration: 360, baseOpacity: 1, grow: 2.5 }); }
  private addArrivalFx(position: THREE.Vector3): void { const material = new THREE.MeshBasicMaterial({ color: 0x8ff8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); const mesh = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 40), material); mesh.position.copy(position); mesh.quaternion.copy(this.camera.quaternion); this.scene.add(mesh); this.effects.push({ object: mesh, material, born: performance.now(), duration: 260, baseOpacity: 0.9, grow: 8 }); }

  private updateEffects(): void {
    const now = performance.now();
    for (let i = this.effects.length - 1; i >= 0; i -= 1) { const fx = this.effects[i]!; const age = (now - fx.born) / fx.duration; if (age >= 1) { this.scene.remove(fx.object); const geometry = (fx.object as THREE.Mesh | THREE.Line).geometry as THREE.BufferGeometry | undefined; geometry?.dispose?.(); fx.material.dispose(); this.effects.splice(i, 1); continue; } fx.material.opacity = fx.baseOpacity * (1 - age); if (fx.grow) fx.object.scale.setScalar(1 + age * fx.grow); fx.object.rotation.z += 0.018; }
  }
  private clearEffects(): void { for (const fx of this.effects) { this.scene.remove(fx.object); const geometry = (fx.object as THREE.Mesh | THREE.Line).geometry as THREE.BufferGeometry | undefined; geometry?.dispose?.(); fx.material.dispose(); } this.effects.length = 0; }

  private playShot(): void { this.toneSweep(720, 210, 0.078, "sawtooth", 0.052); this.toneSweep(1640, 760, 0.038, "triangle", 0.028, 0.003); this.toneSweep(96, 58, 0.065, "sine", 0.07); this.noiseBurst(0.045, 0.04, 2100, "highpass"); }
  private playKill(): void { this.toneSweep(430, 820, 0.09, "sine", 0.05); this.toneSweep(690, 1120, 0.075, "triangle", 0.032, 0.018); }
  private playShieldReject(): void { this.toneSweep(360, 120, 0.11, "square", 0.045); this.noiseBurst(0.04, 0.028, 1500, "bandpass"); }
  private playWarpStart(): void { this.toneSweep(126, 38, 0.2, "sawtooth", 0.085); this.toneSweep(900, 190, 0.16, "triangle", 0.045); this.noiseBurst(0.18, 0.055, 720, "bandpass"); }
  private playWarpArrival(): void { this.toneSweep(150, 64, 0.13, "sine", 0.09); this.toneSweep(1320, 430, 0.085, "triangle", 0.045); this.noiseBurst(0.065, 0.07, 2400, "highpass"); }

  private toneSweep(startFrequency: number, endFrequency: number, duration: number, type: OscillatorType, volume: number, delay = 0): void {
    try { this.audioContext ??= new AudioContext(); const context = this.audioContext; if (context.state === "suspended") void context.resume(); const start = context.currentTime + delay; const osc = context.createOscillator(); const gain = context.createGain(); const shellSettings = this.shell.settings.snapshot(); const mix = Math.max(0, Number(shellSettings.masterVolume ?? 1)) * Math.max(0, Number(shellSettings.sfxVolume ?? 0.9)); osc.type = type; osc.frequency.setValueAtTime(Math.max(1, startFrequency), start); osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration); gain.gain.setValueAtTime(Math.max(0.0001, volume * mix), start); gain.gain.exponentialRampToValueAtTime(0.0001, start + duration); osc.connect(gain).connect(context.destination); osc.start(start); osc.stop(start + duration + 0.01); } catch {}
  }

  private noiseBurst(duration: number, volume: number, frequency: number, type: BiquadFilterType): void {
    try { this.audioContext ??= new AudioContext(); const context = this.audioContext; if (context.state === "suspended") void context.resume(); const length = Math.max(1, Math.floor(context.sampleRate * duration)); const buffer = context.createBuffer(1, length, context.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < length; i += 1) { const envelope = 1 - i / length; data[i] = (Math.random() * 2 - 1) * envelope; } const source = context.createBufferSource(); const filter = context.createBiquadFilter(); const gain = context.createGain(); const shellSettings = this.shell.settings.snapshot(); const mix = Math.max(0, Number(shellSettings.masterVolume ?? 1)) * Math.max(0, Number(shellSettings.sfxVolume ?? 0.9)); filter.type = type; filter.frequency.value = frequency; filter.Q.value = type === "bandpass" ? 0.9 : 0.45; gain.gain.setValueAtTime(Math.max(0.0001, volume * mix), context.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration); source.buffer = buffer; source.connect(filter).connect(gain).connect(context.destination); source.start(); } catch {}
  }

  private formatTime(seconds: number): string { const minutes = Math.floor(seconds / 60); const remainder = seconds - minutes * 60; return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(2).padStart(5, "0")}`; }
  private resize(): void { const width = window.innerWidth; const height = window.innerHeight; this.camera.aspect = width / Math.max(height, 1); this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); }
}
