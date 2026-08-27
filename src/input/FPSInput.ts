export class FPSInput {
  private keys = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  private fireQueued = false;
  private warpHeld = false;
  private warpReleased = false;
  private wheelDelta = 0;
  private resetQueued = false;
  private enabled = false;
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
    this.updateCaptureHint();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.warpHeld = false;
      this.releasePointerLock();
    }
    this.updateCaptureHint();
  }

  capture(): void {
    if (!this.enabled || document.pointerLockElement === this.canvas) return;
    void this.canvas.requestPointerLock?.();
  }

  releasePointerLock(): void {
    if (document.pointerLockElement === this.canvas) void document.exitPointerLock?.();
  }

  isCaptured(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  movement(): { x: number; z: number } {
    const x = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const z = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
    const length = Math.hypot(x, z) || 1;
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

  consumeReset(): boolean {
    const value = this.resetQueued;
    this.resetQueued = false;
    return value;
  }

  private readonly onMouseDown = (event: MouseEvent) => {
    if (!this.enabled) return;
    if (event.button === 0) {
      // Shooting is deliberately NOT gated by pointer lock. The first click both fires
      // and attempts capture, fixing the failure mode from the original HTML prototype.
      this.fireQueued = true;
      this.capture();
    }
    if (event.button === 2) {
      event.preventDefault();
      this.warpHeld = true;
      this.capture();
    }
  };

  private readonly onMouseUp = (event: MouseEvent) => {
    if (!this.enabled || event.button !== 2) return;
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
    // Fallback aim remains usable in embeds/file previews that reject pointer lock.
    if (event.buttons !== 0) {
      this.lookX += event.movementX;
      this.lookY += event.movementY;
    }
  };

  private readonly onWheel = (event: WheelEvent) => {
    if (!this.enabled || !this.warpHeld) return;
    event.preventDefault();
    this.wheelDelta += Math.sign(event.deltaY);
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!this.enabled) return;
    this.keys.add(event.code);
    if (event.code === "KeyR") this.resetQueued = true;
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private updateCaptureHint(): void {
    const show = this.enabled && !this.isCaptured();
    this.captureHint.classList.toggle("visible", show);
  }
}
