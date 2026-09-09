import { resolveTraversalAction } from "./TraversalBindings";

type GyroMode = "off" | "always" | "fire";

export class FPSInput {
  private keys = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  private fireQueued = false;
  private crouchHeld = false;
  private touchCrouchLatched = false;
  private touchFireHeld = false;
  private warpHeld = false;
  private warpReleased = false;
  private wheelDelta = 0;
  private warpFraction: number | null = null;
  private resetQueued = false;
  private tutorialSkipQueued = false;
  private pauseQueued = false;
  private enabled = false;
  private touchMoveX = 0;
  private touchMoveZ = 0;
  private gyroMode: GyroMode = "off";
  private gyroPermissionGranted = false;
  private readonly touchCapable = navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;
  private readonly onPointerLock = () => this.updateCaptureHint();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly captureHint: HTMLElement
  ) {
    canvas.tabIndex = 0;
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("pointerlockchange", this.onPointerLock);

    if (this.touchCapable) {
      document.body.classList.add("touch-device");
      window.addEventListener("devicemotion", this.onDeviceMotion);
      this.bindTouchControls();
    }

    this.updateCaptureHint();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    document.body.classList.toggle("touch-gameplay", enabled && this.touchCapable);
    if (!enabled) {
      this.keys.clear();
      this.warpHeld = false;
      this.crouchHeld = false;
      this.touchCrouchLatched = false;
      this.touchFireHeld = false;
      this.touchMoveX = 0;
      this.touchMoveZ = 0;
      document.body.classList.remove("mobile-tools-open");
      this.resetStickVisual();
      this.syncTouchCrouchVisual();
      this.releasePointerLock();
    }
    this.updateCaptureHint();
  }

  capture(): void {
    if (this.touchCapable || !this.enabled || document.pointerLockElement === this.canvas) return;
    void this.canvas.requestPointerLock?.();
  }

  releasePointerLock(): void {
    if (document.pointerLockElement === this.canvas) void document.exitPointerLock?.();
  }

  isCaptured(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  movement(): { x: number; z: number } {
    const move = resolveTraversalAction("move").keyboardMouse.moveKeys;
    const keyboardX = move
      ? (this.keys.has(move.right) ? 1 : 0) - (this.keys.has(move.left) ? 1 : 0)
      : 0;
    const keyboardZ = move
      ? (this.keys.has(move.forward) ? 1 : 0) - (this.keys.has(move.backward) ? 1 : 0)
      : 0;
    const x = keyboardX + this.touchMoveX;
    const z = keyboardZ + this.touchMoveZ;
    const length = Math.max(1, Math.hypot(x, z));
    return { x: x / length, z: z / length };
  }

  consumeLook(): { x: number; y: number } {
    const value = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return value;
  }

  consumeFire(): boolean {
    const value = this.fireQueued;
    this.fireQueued = false;
    return value;
  }

  isCrouchHeld(): boolean {
    return this.crouchHeld || this.touchCrouchLatched;
  }

  isWarpHeld(): boolean {
    return this.warpHeld;
  }

  consumeWarpRelease(): boolean {
    const value = this.warpReleased;
    this.warpReleased = false;
    return value;
  }

  consumeWheel(): number {
    const value = this.wheelDelta;
    this.wheelDelta = 0;
    return value;
  }

  consumeWarpFraction(): number | null {
    const value = this.warpFraction;
    this.warpFraction = null;
    return value;
  }

  consumeReset(): boolean {
    const value = this.resetQueued;
    this.resetQueued = false;
    return value;
  }

  consumeTutorialSkip(): boolean {
    const value = this.tutorialSkipQueued;
    this.tutorialSkipQueued = false;
    return value;
  }

  consumePause(): boolean {
    const value = this.pauseQueued;
    this.pauseQueued = false;
    return value;
  }

  private readonly onMouseDown = (event: MouseEvent) => {
    if (!this.enabled) return;

    const fireButtons = resolveTraversalAction("fire").keyboardMouse.mouseButtons ?? [];
    const warpButtons = resolveTraversalAction("warp").keyboardMouse.mouseButtons ?? [];
    const resetButtons = resolveTraversalAction("reset").keyboardMouse.mouseButtons ?? [];

    if (fireButtons.includes(event.button)) {
      this.fireQueued = true;
      this.capture();
    }
    if (warpButtons.includes(event.button)) {
      event.preventDefault();
      this.warpHeld = true;
      this.capture();
    }
    if (resetButtons.includes(event.button)) this.resetQueued = true;
  };

  private readonly onMouseUp = (event: MouseEvent) => {
    if (!this.enabled) return;
    const warpButtons = resolveTraversalAction("warp").keyboardMouse.mouseButtons ?? [];
    if (!warpButtons.includes(event.button)) return;
    this.warpHeld = false;
    this.warpReleased = true;
  };

  private readonly onMouseMove = (event: MouseEvent) => {
    if (!this.enabled) return;
    if (this.isCaptured()) {
      this.lookX += event.movementX;
      this.lookY += event.movementY;
      return;
    }
    if (event.buttons !== 0 && event.target === this.canvas) {
      this.lookX += event.movementX;
      this.lookY += event.movementY;
    }
  };

  private readonly onWheel = (event: WheelEvent) => {
    if (!this.enabled || !this.warpHeld) return;
    const direction = event.deltaY >= 0 ? "down" : "up";
    const shorter = resolveTraversalAction("landing-shorter").keyboardMouse.wheel;
    const longer = resolveTraversalAction("landing-longer").keyboardMouse.wheel;
    if (direction !== shorter && direction !== longer) return;

    event.preventDefault();
    if (direction === shorter) this.wheelDelta += 1;
    if (direction === longer) this.wheelDelta -= 1;
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!this.enabled) return;
    this.keys.add(event.code);

    const crouchKeys = resolveTraversalAction("crouch").keyboardMouse.keys ?? [];
    const resetKeys = resolveTraversalAction("reset").keyboardMouse.keys ?? [];
    const fireKeys = resolveTraversalAction("fire").keyboardMouse.keys ?? [];
    const warpKeys = resolveTraversalAction("warp").keyboardMouse.keys ?? [];
    const shorterKeys = resolveTraversalAction("landing-shorter").keyboardMouse.keys ?? [];
    const longerKeys = resolveTraversalAction("landing-longer").keyboardMouse.keys ?? [];

    if (crouchKeys.includes(event.code)) this.crouchHeld = true;
    if (!event.repeat && resetKeys.includes(event.code)) this.resetQueued = true;
    if (!event.repeat && fireKeys.includes(event.code)) this.fireQueued = true;
    if (warpKeys.includes(event.code)) this.warpHeld = true;
    if (!event.repeat && this.warpHeld && shorterKeys.includes(event.code)) this.wheelDelta += 1;
    if (!event.repeat && this.warpHeld && longerKeys.includes(event.code)) this.wheelDelta -= 1;
    if (event.code === "KeyT") this.tutorialSkipQueued = true;
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);

    const crouchKeys = resolveTraversalAction("crouch").keyboardMouse.keys ?? [];
    const warpKeys = resolveTraversalAction("warp").keyboardMouse.keys ?? [];

    if (crouchKeys.includes(event.code)) {
      this.crouchHeld = crouchKeys.some((code) => this.keys.has(code));
    }
    if (warpKeys.includes(event.code)) {
      const stillHeld = warpKeys.some((code) => this.keys.has(code));
      if (!stillHeld && this.warpHeld) {
        this.warpHeld = false;
        this.warpReleased = true;
      }
    }
  };

  private readonly onDeviceMotion = (event: DeviceMotionEvent) => {
    if (!this.enabled || !this.gyroPermissionGranted || this.gyroMode === "off") return;
    if (this.gyroMode === "fire" && !this.touchFireHeld) return;
    const rotation = event.rotationRate;
    if (!rotation) return;

    const angle = Number(screen.orientation?.angle ?? 0);
    let yaw = rotation.gamma ?? 0;
    let pitch = rotation.beta ?? 0;

    // DeviceMotion axes are device-relative. Remap for the two landscape
    // orientations so turning the phone left/right always means camera yaw.
    if (angle === 90) {
      yaw = rotation.beta ?? 0;
      pitch = -(rotation.gamma ?? 0);
    } else if (angle === 270 || angle === -90) {
      yaw = -(rotation.beta ?? 0);
      pitch = rotation.gamma ?? 0;
    }

    const intervalScale = Math.max(0.5, Math.min(2, (event.interval || 16.67) / 16.67));
    const sensitivity = 0.15 * intervalScale;
    this.lookX += yaw * sensitivity;
    this.lookY += pitch * sensitivity;
  };

  private async cycleGyroMode(): Promise<void> {
    if (this.gyroMode === "off") {
      const motionCtor = DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      try {
        const result = motionCtor.requestPermission ? await motionCtor.requestPermission() : "granted";
        this.gyroPermissionGranted = result === "granted";
      } catch {
        this.gyroPermissionGranted = false;
      }
      if (!this.gyroPermissionGranted) {
        this.syncGyroButton("GYRO BLOCKED");
        return;
      }
      this.gyroMode = "always";
    } else if (this.gyroMode === "always") {
      this.gyroMode = "fire";
    } else {
      this.gyroMode = "off";
    }
    this.syncGyroButton();
  }

  private syncGyroButton(forcedLabel?: string): void {
    const button = document.getElementById("mobile-gyro");
    if (!button) return;
    button.textContent = forcedLabel ?? (
      this.gyroMode === "always" ? "GYRO ON" :
      this.gyroMode === "fire" ? "GYRO FIRE" : "GYRO OFF"
    );
    button.dataset.mode = this.gyroMode;
  }

  private bindTouchControls(): void {
    const stick = document.getElementById("move-stick");
    const knob = document.getElementById("move-stick-knob");
    const look = document.getElementById("look-pad");
    const fire = document.getElementById("mobile-fire");
    const warp = document.getElementById("mobile-warp");
    const crouch = document.getElementById("mobile-crouch");
    const reset = document.getElementById("mobile-reset");
    const skip = document.getElementById("mobile-skip");
    const pause = document.getElementById("mobile-pause");
    const range = document.getElementById("mobile-range") as HTMLInputElement | null;
    const toolsToggle = document.getElementById("mobile-tools-toggle");
    const toolsPanel = document.getElementById("mobile-tools-panel");
    const gyro = document.getElementById("mobile-gyro");
    if (!stick || !knob || !look || !fire || !warp || !crouch || !reset || !skip || !pause || !range) return;

    let stickPointer: number | null = null;
    const updateStick = (event: PointerEvent) => {
      const rect = stick.getBoundingClientRect();
      const radius = Math.max(28, Math.min(rect.width, rect.height) * 0.36);
      let dx = event.clientX - (rect.left + rect.width * 0.5);
      let dy = event.clientY - (rect.top + rect.height * 0.5);
      const length = Math.hypot(dx, dy);
      if (length > radius) {
        dx = dx / length * radius;
        dy = dy / length * radius;
      }
      this.touchMoveX = dx / radius;
      this.touchMoveZ = -dy / radius;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    stick.addEventListener("pointerdown", (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      stickPointer = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      updateStick(event);
    });
    stick.addEventListener("pointermove", (event) => {
      if (event.pointerId === stickPointer) updateStick(event);
    });
    const releaseStick = (event: PointerEvent) => {
      if (event.pointerId !== stickPointer) return;
      stickPointer = null;
      this.touchMoveX = 0;
      this.touchMoveZ = 0;
      knob.style.transform = "translate(0px, 0px)";
    };
    stick.addEventListener("pointerup", releaseStick);
    stick.addEventListener("pointercancel", releaseStick);

    const applyTouchLook = (dx: number, dy: number) => {
      this.lookX += dx * 1.35;
      this.lookY += dy * 1.35;
    };

    let lookPointer: number | null = null;
    let lastLookX = 0;
    let lastLookY = 0;
    look.addEventListener("pointerdown", (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      if (lookPointer !== null && event.pointerId !== lookPointer) {
        this.fireQueued = true;
        return;
      }
      lookPointer = event.pointerId;
      lastLookX = event.clientX;
      lastLookY = event.clientY;
      look.setPointerCapture(event.pointerId);
    });
    look.addEventListener("pointermove", (event) => {
      if (event.pointerId !== lookPointer) return;
      event.preventDefault();
      const dx = event.clientX - lastLookX;
      const dy = event.clientY - lastLookY;
      lastLookX = event.clientX;
      lastLookY = event.clientY;
      applyTouchLook(dx, dy);
    });
    const releaseLook = (event: PointerEvent) => {
      if (event.pointerId === lookPointer) lookPointer = null;
    };
    look.addEventListener("pointerup", releaseLook);
    look.addEventListener("pointercancel", releaseLook);

    let firePointer: number | null = null;
    let lastFireX = 0;
    let lastFireY = 0;
    fire.addEventListener("pointerdown", (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      this.fireQueued = true;
      this.touchFireHeld = true;
      firePointer = event.pointerId;
      lastFireX = event.clientX;
      lastFireY = event.clientY;
      fire.setPointerCapture(event.pointerId);
    });
    fire.addEventListener("pointermove", (event) => {
      if (event.pointerId !== firePointer) return;
      event.preventDefault();
      const dx = event.clientX - lastFireX;
      const dy = event.clientY - lastFireY;
      lastFireX = event.clientX;
      lastFireY = event.clientY;
      applyTouchLook(dx, dy);
    });
    const releaseFire = (event: PointerEvent) => {
      if (event.pointerId !== firePointer) return;
      firePointer = null;
      this.touchFireHeld = false;
    };
    fire.addEventListener("pointerup", releaseFire);
    fire.addEventListener("pointercancel", releaseFire);

    crouch.addEventListener("pointerdown", (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      this.touchCrouchLatched = !this.touchCrouchLatched;
      this.syncTouchCrouchVisual();
    });

    let warpPointer: number | null = null;
    let warpStartY = 0;
    let warpStartFraction = 1;
    const setTouchWarpFraction = (fraction: number) => {
      const clamped = Math.max(0.12, Math.min(1, fraction));
      range.value = String(Math.round(clamped * 100));
      this.warpFraction = clamped;
    };
    const startWarp = (event: PointerEvent) => {
      if (!this.enabled) return;
      event.preventDefault();
      this.warpHeld = true;
      warpPointer = event.pointerId;
      warpStartY = event.clientY;
      warpStartFraction = Math.max(0.12, Math.min(1, Number(range.value) / 100));
      warp.setPointerCapture(event.pointerId);
      warp.classList.add("dragging");
    };
    warp.addEventListener("pointermove", (event) => {
      if (event.pointerId !== warpPointer || !this.warpHeld) return;
      event.preventDefault();
      // The button lives near the bottom edge, so dragging upward has the most
      // physical travel. Pull upward to stop shorter; slide back down for longer.
      const deltaY = event.clientY - warpStartY;
      setTouchWarpFraction(warpStartFraction + deltaY / 180);
    });
    const endWarp = (event: PointerEvent) => {
      if (event.pointerId !== warpPointer || !this.warpHeld) return;
      event.preventDefault();
      warpPointer = null;
      warp.classList.remove("dragging");
      this.warpHeld = false;
      this.warpReleased = true;
    };
    warp.addEventListener("pointerdown", startWarp);
    warp.addEventListener("pointerup", endWarp);
    warp.addEventListener("pointercancel", endWarp);

    range.addEventListener("input", () => {
      this.warpFraction = Math.max(0.12, Math.min(1, Number(range.value) / 100));
    });
    range.addEventListener("pointerdown", (event) => event.stopPropagation());

    reset.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (this.enabled) this.resetQueued = true;
    });
    skip.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (this.enabled) this.tutorialSkipQueued = true;
    });
    pause.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      document.body.classList.remove("mobile-tools-open");
      toolsToggle?.setAttribute("aria-expanded", "false");
      toolsPanel?.setAttribute("aria-hidden", "true");
      if (this.enabled) this.pauseQueued = true;
    });

    toolsToggle?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const open = !document.body.classList.contains("mobile-tools-open");
      document.body.classList.toggle("mobile-tools-open", open);
      toolsToggle.setAttribute("aria-expanded", String(open));
      toolsPanel?.setAttribute("aria-hidden", String(!open));
    });

    gyro?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.cycleGyroMode();
    });
    this.syncGyroButton();
  }

  private syncTouchCrouchVisual(): void {
    document.getElementById("mobile-crouch")?.classList.toggle("latched", this.touchCrouchLatched);
  }

  private resetStickVisual(): void {
    const knob = document.getElementById("move-stick-knob");
    if (knob) knob.style.transform = "translate(0px, 0px)";
  }

  private updateCaptureHint(): void {
    const show = this.enabled && !this.touchCapable && !this.isCaptured();
    this.captureHint.classList.toggle("visible", show);
  }
}
