import * as THREE from "three";
import { FPSInput } from "../input/FPSInput";
import { WarpSystem } from "../traversal/WarpSystem";
import { ROOMS, type EnemySpec, type PlatformSpec } from "../world/stages";

type ActiveEnemy = {
  spec: EnemySpec;
  mesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>;
  base: THREE.Vector3;
  alive: boolean;
};

export class TraversalGame {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(88, 1, 0.05, 220);
  private readonly clock = new THREE.Clock();
  private readonly input: FPSInput;
  private readonly warp: WarpSystem;
  private readonly roomRoot = new THREE.Group();
  private readonly enemies: ActiveEnemy[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly goal = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.09, 12, 36),
    new THREE.MeshBasicMaterial({ color: 0xb7ff75 })
  );
  private readonly weapon = new THREE.Group();
  private roomIndex = 0;
  private yaw = 0;
  private pitch = 0;
  private velocityY = 0;
  private lastPhase = "";
  private roomKills = 0;
  private totalKills = 0;
  private shots = 0;
  private warps = 0;
  private runStartedAt = 0;
  private transientMessage = "";
  private transientUntil = 0;
  private audioContext: AudioContext | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly shell: any,
    private readonly flow: any
  ) {
    const captureHint = document.getElementById("capture-hint");
    if (!captureHint) throw new Error("Missing capture hint");
    this.input = new FPSInput(canvas, captureHint);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene.background = new THREE.Color(0x05070b);
    this.scene.fog = new THREE.FogExp2(0x05070b, 0.018);
    this.scene.add(this.camera, this.roomRoot, this.goal);
    this.scene.add(new THREE.HemisphereLight(0xb9eaff, 0x10131a, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.3);
    key.position.set(8, 16, 7);
    this.scene.add(key);

    this.buildWeapon();
    this.warp = new WarpSystem(this.scene);
    this.goal.visible = false;
    this.resize();
    window.addEventListener("resize", () => this.resize());

    shell.events.on("level:loaded", () => this.beginRun());
    shell.events.on("game:pause", () => this.syncPhase("paused"));
    shell.events.on("game:resume", () => {
      this.syncPhase("playing");
      this.input.capture();
    });
    shell.events.on("game:quit", () => this.syncPhase("menu"));
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private beginRun(): void {
    this.roomIndex = 0;
    this.totalKills = 0;
    this.shots = 0;
    this.warps = 0;
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
    this.goal.rotation.y += dt * 1.5;
    this.renderer.render(this.scene, this.camera);
  }

  private syncPhase(phase: string): void {
    this.lastPhase = phase;
    const playing = phase === "playing";
    document.body.classList.toggle("playing", playing);
    this.input.setEnabled(playing);
    if (!playing) this.input.releasePointerLock();
  }

  private update(dt: number): void {
    if (this.input.consumeReset()) {
      this.loadRoom(this.roomIndex);
      return;
    }

    const look = this.input.consumeLook();
    this.yaw -= look.x * 0.0021;
    this.pitch = THREE.MathUtils.clamp(this.pitch - look.y * 0.0021, -1.48, 1.48);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    this.updateEnemies(performance.now() * 0.001);

    if (this.input.consumeFire()) this.shoot();
    this.warp.updateSelection(this.input.isWarpHeld(), this.input.consumeWheel());
    if (this.input.consumeWarpRelease() && this.warp.commit(this.camera.position)) {
      this.warps += 1;
      this.velocityY = 0;
      this.sound(92, 0.11, "sawtooth", 0.12);
    }

    if (!this.warp.updateTransit(dt, this.camera.position)) this.updateMovement(dt);
    this.checkGoal();
    this.updateHUD();
  }

  private updateMovement(dt: number): void {
    const move = this.input.movement();
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const horizontal = forward.multiplyScalar(move.z).add(right.multiplyScalar(move.x));
    const speed = 7.5;
    this.camera.position.addScaledVector(horizontal, speed * dt);

    const previousY = this.camera.position.y;
    this.velocityY -= 18 * dt;
    this.camera.position.y += this.velocityY * dt;
    this.resolvePlatforms(previousY);

    if (this.camera.position.y < -9) this.loadRoom(this.roomIndex);
  }

  private resolvePlatforms(previousY: number): void {
    const room = ROOMS[this.roomIndex];
    for (const platform of room.platforms) {
      const [cx, cy, cz] = platform.center;
      const [sx, sy, sz] = platform.size;
      const inside = Math.abs(this.camera.position.x - cx) <= sx * 0.5 - 0.15 && Math.abs(this.camera.position.z - cz) <= sz * 0.5 - 0.15;
      if (!inside) continue;
      const standingY = cy + sy * 0.5 + 1.7;
      if (this.velocityY <= 0 && this.camera.position.y <= standingY + 0.2 && previousY >= standingY - 0.5) {
        this.camera.position.y = standingY;
        this.velocityY = 0;
        return;
      }
    }
  }

  private shoot(): void {
    this.shots += 1;
    this.weapon.position.z = -0.07;
    this.sound(132, 0.055, "square", 0.08);
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const liveMeshes = this.enemies.filter((enemy) => enemy.alive).map((enemy) => enemy.mesh);
    const hit = this.raycaster.intersectObjects(liveMeshes, false)[0];
    if (!hit) return;
    const enemy = this.enemies.find((candidate) => candidate.mesh === hit.object);
    if (!enemy) return;

    if (enemy.spec.kind === "shield" && this.camera.position.x < 2.5) {
      this.flashMessage("SHIELD REJECT // MOVE RIGHT");
      this.sound(420, 0.08, "triangle", 0.05);
      return;
    }

    enemy.alive = false;
    enemy.mesh.visible = false;
    this.roomKills += 1;
    this.totalKills += 1;
    this.warp.write(this.camera.position.clone(), enemy.mesh.position.clone());
    this.sound(620, 0.06, "sine", 0.045);
  }

  private updateEnemies(time: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive || !enemy.spec.drift) continue;
      const offset = Math.sin(time * enemy.spec.drift.speed) * enemy.spec.drift.amplitude;
      enemy.mesh.position.copy(enemy.base);
      enemy.mesh.position[enemy.spec.drift.axis] += offset;
      enemy.mesh.rotation.x += 0.01;
      enemy.mesh.rotation.y += 0.015;
    }
    this.weapon.position.z = THREE.MathUtils.lerp(this.weapon.position.z, 0, 0.22);
  }

  private checkGoal(): void {
    const room = ROOMS[this.roomIndex];
    if (this.roomKills < room.requiredKills) return;
    if (this.camera.position.distanceTo(this.goal.position) > 2.3) return;

    if (this.roomIndex >= ROOMS.length - 1) {
      this.input.releasePointerLock();
      this.flow.showResults();
      return;
    }

    this.roomIndex += 1;
    this.loadRoom(this.roomIndex);
  }

  private loadRoom(index: number): void {
    const room = ROOMS[index];
    this.roomRoot.clear();
    this.enemies.length = 0;
    this.warp.reset();
    this.roomKills = 0;
    this.velocityY = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.camera.position.set(...room.spawn);
    this.camera.rotation.set(0, 0, 0);

    for (const platform of room.platforms) this.addPlatform(platform);
    for (const spec of room.enemies) this.addEnemy(spec);

    this.goal.position.set(...room.goal);
    this.goal.visible = true;
    this.flashMessage(room.lesson, 2400);
  }

  private addPlatform(spec: PlatformSpec): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...spec.size),
      new THREE.MeshStandardMaterial({ color: 0x111824, roughness: 0.78, metalness: 0.18 })
    );
    mesh.position.set(...spec.center);
    this.roomRoot.add(mesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: 0x355169, transparent: true, opacity: 0.45 })
    );
    edges.position.copy(mesh.position);
    this.roomRoot.add(edges);
  }

  private addEnemy(spec: EnemySpec): void {
    const material = new THREE.MeshStandardMaterial({
      color: spec.kind === "shield" ? 0xffaa63 : spec.kind === "drifter" ? 0xff6fae : 0x78f7ff,
      emissive: spec.kind === "shield" ? 0x5a2100 : 0x062f36,
      emissiveIntensity: 1.35,
      roughness: 0.28,
      metalness: 0.42
    });
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), material);
    mesh.position.set(...spec.position);
    this.roomRoot.add(mesh);
    this.enemies.push({ spec, mesh, base: mesh.position.clone(), alive: true });
  }

  private buildWeapon(): void {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.18, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xdde6ee, metalness: 0.7, roughness: 0.24 })
    );
    body.position.set(0.28, -0.23, -0.62);
    this.weapon.add(body);
    this.camera.add(this.weapon);
  }

  private updateHUD(): void {
    const room = ROOMS[this.roomIndex];
    const roomLabel = document.getElementById("room-label");
    const stats = document.getElementById("run-stats");
    const anchor = document.getElementById("anchor-status");
    if (!roomLabel || !stats || !anchor) return;
    roomLabel.textContent = `${String(this.roomIndex + 1).padStart(2, "0")} // ${room.title}`;
    const elapsed = (performance.now() - this.runStartedAt) / 1000;
    stats.textContent = `${elapsed.toFixed(2)}s  ·  ${this.totalKills} KILLS  ·  ${this.shots} SHOTS  ·  ${this.warps} WARPS`;

    if (performance.now() < this.transientUntil) {
      anchor.textContent = this.transientMessage;
    } else if (this.warp.hasAnchor()) {
      anchor.textContent = this.input.isWarpHeld() ? `VECTOR ${this.warp.selectionPercent()}% // RELEASE RMB` : "VECTOR READY // HOLD RMB";
    } else {
      anchor.textContent = room.lesson;
    }
  }

  private flashMessage(message: string, duration = 900): void {
    this.transientMessage = message;
    this.transientUntil = performance.now() + duration;
  }

  private sound(frequency: number, duration: number, type: OscillatorType, volume: number): void {
    try {
      this.audioContext ??= new AudioContext();
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      gain.gain.setValueAtTime(volume, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
      osc.connect(gain).connect(this.audioContext.destination);
      osc.start();
      osc.stop(this.audioContext.currentTime + duration);
    } catch {
      // Audio is enhancement-only; gameplay must remain deterministic if blocked.
    }
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }
}
