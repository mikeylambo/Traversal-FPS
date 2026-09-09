type GyroMode = "off" | "always" | "fire";

type PermissionResult = "granted" | "denied" | "prompt" | string;

type PermissionCtor = {
  requestPermission?: () => Promise<PermissionResult>;
};

const coarse = matchMedia("(pointer: coarse)");
if (coarse.matches) installMobileCombatFixes();

function installMobileCombatFixes(): void {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
  const originalGyro = document.getElementById("mobile-gyro") as HTMLButtonElement | null;
  const originalSkip = document.getElementById("mobile-skip") as HTMLButtonElement | null;
  const fire = document.getElementById("mobile-fire") as HTMLButtonElement | null;
  const toolsToggle = document.getElementById("mobile-tools-toggle") as HTMLButtonElement | null;
  const toolsPanel = document.getElementById("mobile-tools-panel");
  const runPrimary = document.getElementById("run-primary");

  if (!canvas) return;

  const closeTools = () => {
    document.body.classList.remove("mobile-tools-open");
    toolsToggle?.setAttribute("aria-expanded", "false");
    toolsPanel?.setAttribute("aria-hidden", "true");
  };

  if (originalSkip) {
    const skip = originalSkip.cloneNode(true) as HTMLButtonElement;
    originalSkip.replaceWith(skip);
    skip.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.dispatchEvent(new CustomEvent("traversal:mobile-skip"));
      closeTools();
    });
  }

  const bindScope = () => {
    const oldScope = document.getElementById("mobile-scope") as HTMLButtonElement | null;
    if (!oldScope || oldScope.dataset.mobileMultitouchBound === "true") return;
    const scope = oldScope.cloneNode(true) as HTMLButtonElement;
    scope.dataset.mobileMultitouchBound = "true";
    oldScope.replaceWith(scope);
    scope.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.dispatchEvent(new CustomEvent("traversal:scope-toggle"));
    });
  };
  bindScope();
  const scopeObserver = new MutationObserver(bindScope);
  scopeObserver.observe(document.getElementById("mobile-controls") ?? document.body, {
    childList: true,
    subtree: true
  });

  let gyroMode: GyroMode = "off";
  let gyroGranted = false;
  let fireHeld = false;
  let sensorSeen = false;
  let lastOrientation: { alpha: number; beta: number; gamma: number } | null = null;

  fire?.addEventListener("pointerdown", () => { fireHeld = true; }, true);
  fire?.addEventListener("pointerup", () => { fireHeld = false; }, true);
  fire?.addEventListener("pointercancel", () => { fireHeld = false; }, true);

  const injectLook = (x: number, y: number) => {
    if (!document.body.classList.contains("touch-gameplay")) return;
    if (gyroMode === "off" || !gyroGranted) return;
    if (gyroMode === "fire" && !fireHeld) return;
    const dx = Math.max(-18, Math.min(18, x));
    const dy = Math.max(-18, Math.min(18, y));
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

    const synthetic = new MouseEvent("mousemove", {
      bubbles: true,
      cancelable: true,
      buttons: 1,
      clientX: 0,
      clientY: 0
    });
    Object.defineProperty(synthetic, "movementX", { configurable: true, value: dx });
    Object.defineProperty(synthetic, "movementY", { configurable: true, value: dy });
    canvas.dispatchEvent(synthetic);
  };

  const onMotion = (event: DeviceMotionEvent) => {
    const rate = event.rotationRate;
    if (!rate) return;
    sensorSeen = true;
    const angle = Number(screen.orientation?.angle ?? 0);
    let yaw = rate.gamma ?? 0;
    let pitch = rate.beta ?? 0;
    if (angle === 90) {
      yaw = rate.beta ?? 0;
      pitch = -(rate.gamma ?? 0);
    } else if (angle === 270 || angle === -90) {
      yaw = -(rate.beta ?? 0);
      pitch = rate.gamma ?? 0;
    }
    injectLook(yaw * 0.12, pitch * 0.12);
  };

  const wrappedDelta = (next: number, previous: number) => {
    let delta = next - previous;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
  };

  const onOrientation = (event: DeviceOrientationEvent) => {
    if (event.alpha == null || event.beta == null || event.gamma == null) return;
    sensorSeen = true;
    const current = { alpha: event.alpha, beta: event.beta, gamma: event.gamma };
    if (!lastOrientation) {
      lastOrientation = current;
      return;
    }
    const previous = lastOrientation;
    const angle = Number(screen.orientation?.angle ?? 0);
    const dBeta = wrappedDelta(current.beta, previous.beta);
    const dGamma = wrappedDelta(current.gamma, previous.gamma);
    const dAlpha = wrappedDelta(current.alpha, previous.alpha);
    lastOrientation = current;

    if (angle === 90) injectLook(dBeta * 1.15, -dGamma * 1.15);
    else if (angle === 270 || angle === -90) injectLook(-dBeta * 1.15, dGamma * 1.15);
    else injectLook(dAlpha * 1.1, dBeta * 1.1);
  };

  const requestGyroPermission = async (): Promise<boolean> => {
    if (!window.isSecureContext) return false;

    const orientationCtor = (window as unknown as { DeviceOrientationEvent?: PermissionCtor }).DeviceOrientationEvent;
    const motionCtor = (window as unknown as { DeviceMotionEvent?: PermissionCtor }).DeviceMotionEvent;
    const requests: Promise<PermissionResult>[] = [];

    try {
      if (orientationCtor?.requestPermission) requests.push(orientationCtor.requestPermission());
    } catch {}
    try {
      if (motionCtor?.requestPermission) requests.push(motionCtor.requestPermission());
    } catch {}

    if (!requests.length) return "DeviceMotionEvent" in window || "DeviceOrientationEvent" in window;
    const results = await Promise.allSettled(requests);
    return results.some((result) => result.status === "fulfilled" && result.value === "granted");
  };

  const setGyroLabel = (button: HTMLButtonElement, label?: string) => {
    button.textContent = label ?? (
      gyroMode === "always" ? "GYRO ON" : gyroMode === "fire" ? "GYRO FIRE" : "GYRO OFF"
    );
    button.dataset.mode = gyroMode;
  };

  if (originalGyro) {
    const gyro = originalGyro.cloneNode(true) as HTMLButtonElement;
    originalGyro.replaceWith(gyro);
    setGyroLabel(gyro);

    gyro.addEventListener("pointerdown", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (gyroMode === "off") {
        setGyroLabel(gyro, "GYRO …");
        gyroGranted = await requestGyroPermission();
        if (!gyroGranted) {
          setGyroLabel(gyro, "GYRO UNAVAILABLE");
          return;
        }
        sensorSeen = false;
        lastOrientation = null;
        window.addEventListener("devicemotion", onMotion, { passive: true });
        window.addEventListener("deviceorientation", onOrientation, { passive: true });
        gyroMode = "always";
        setGyroLabel(gyro);

        window.setTimeout(() => {
          if (gyroMode !== "off" && !sensorSeen) setGyroLabel(gyro, "GYRO NO SENSOR");
        }, 1400);
      } else if (gyroMode === "always") {
        gyroMode = "fire";
        setGyroLabel(gyro);
      } else {
        gyroMode = "off";
        lastOrientation = null;
        setGyroLabel(gyro);
      }
    });
  }

  const syncTrainingClass = () => {
    const text = runPrimary?.textContent?.trim().toUpperCase() ?? "";
    document.body.classList.toggle("mobile-training", text === "TRAINING");
  };
  syncTrainingClass();
  if (runPrimary) {
    const observer = new MutationObserver(syncTrainingClass);
    observer.observe(runPrimary, { childList: true, characterData: true, subtree: true });
  }
}
