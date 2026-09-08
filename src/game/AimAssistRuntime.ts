import * as THREE from "three";
import { resolveTraversalAction } from "../input/TraversalBindings";
import { evaluateActorOrigin } from "../world/spatialActors";
import type { EnemySpec } from "../world/stages";
import type { AimAssistStrength, TraversalSettingsStore } from "./TraversalSettings";

type LookDevice = "mouse" | "gamepad" | "touch";

type ActiveEnemy = {
  spec: EnemySpec;
  mesh: THREE.Mesh;
  alive: boolean;
};

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  input: {
    consumeLook(): { x: number; y: number };
  };
  enemies: ActiveEnemy[];
  platformMeshes: THREE.Mesh[];
  yaw: number;
  pitch: number;
  warp: {
    isTransiting(): boolean;
  };
};

type AssistProfile = {
  coneDegrees: number;
  friction: number;
  trackingRate: number;
  maxDegreesPerSecond: number;
};

type Candidate = {
  enemy: ActiveEnemy;
  yawError: number;
  pitchError: number;
  angularError: number;
  center: number;
  intent: number;
  score: number;
};

const ZERO_ASSIST: AssistProfile = {
  coneDegrees: 0,
  friction: 0,
  trackingRate: 0,
  maxDegreesPerSecond: 0
};

const CONTROLLER_PROFILES: Record<AimAssistStrength, AssistProfile> = {
  off: ZERO_ASSIST,
  low: { coneDegrees: 4.0, friction: 0.18, trackingRate: 2.0, maxDegreesPerSecond: 12 },
  standard: { coneDegrees: 6.5, friction: 0.28, trackingRate: 3.4, maxDegreesPerSecond: 22 },
  strong: { coneDegrees: 9.0, friction: 0.38, trackingRate: 4.8, maxDegreesPerSecond: 32 }
};

/**
 * Intent-aware camera assistance for controller and touch.
 *
 * It never changes the rifle raycast, enemy collision, or hitboxes. The only
 * output is a small modification to the look stream before TraversalGame applies
 * its normal yaw/pitch update, so "I shot that object" stays authoritative.
 */
export function installAimAssistRuntime(
  game: object,
  settings: TraversalSettingsStore
): void {
  const state = game as unknown as RuntimeState;
  const input = state.input;
  const originalLook = input.consumeLook.bind(input);

  const occlusionRay = new THREE.Raycaster();
  const cameraForward = new THREE.Vector3();
  const toTarget = new THREE.Vector3();
  const previousCameraPosition = state.camera.position.clone();

  let previousTarget: THREE.Object3D | null = null;
  let lastDevice: LookDevice = document.body.classList.contains("touch-device") ? "touch" : "mouse";
  let lastPointerLookAt = -1;
  let lastPadLookAt = -1;
  let lastSampleAt = performance.now();

  const notePointerLook = (device: "mouse" | "touch") => {
    if (!document.body.classList.contains("playing")) return;
    lastDevice = device;
    lastPointerLookAt = performance.now();
  };

  window.addEventListener("mousemove", (event) => {
    if (event.movementX !== 0 || event.movementY !== 0) notePointerLook("mouse");
  }, true);

  const lookPad = document.getElementById("look-pad");
  lookPad?.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") notePointerLook("touch");
  }, true);

  input.consumeLook = () => {
    const look = originalLook();
    const now = performance.now();
    const padActive = gamepadLookActive(settings);
    if (padActive) {
      lastDevice = "gamepad";
      lastPadLookAt = now;
    } else if (lastPointerLookAt > lastPadLookAt && now - lastPointerLookAt < 1200) {
      // Pointer events win back ownership as soon as the right stick is at rest.
      lastDevice = document.body.classList.contains("touch-device") && lastDevice === "touch"
        ? "touch"
        : "mouse";
    }

    document.body.dataset.lookDevice = lastDevice;
    document.body.dataset.aimAssist = settings.value.aimAssist;

    if (lastDevice === "mouse" || settings.value.aimAssist === "off") {
      previousTarget = null;
      previousCameraPosition.copy(state.camera.position);
      lastSampleAt = now;
      return look;
    }

    const sensitivity = Math.max(0.0001, 0.0021 * settings.value.mouseSensitivity);
    const invertY = settings.value.invertY ? -1 : 1;
    const intendedYaw = -look.x * sensitivity;
    const intendedPitch = -look.y * sensitivity * invertY;
    const intendedMagnitude = Math.hypot(intendedYaw, intendedPitch);
    const dt = Math.max(1 / 120, Math.min(1 / 30, (now - lastSampleAt) / 1000 || 1 / 60));
    lastSampleAt = now;

    // Assistance translates active intent; it never moves a stationary camera.
    if (intendedMagnitude < 0.00008) {
      previousCameraPosition.copy(state.camera.position);
      return look;
    }

    const travel = state.camera.position.distanceTo(previousCameraPosition);
    previousCameraPosition.copy(state.camera.position);
    const speed = dt > 0 ? travel / dt : 0;
    const plausibleSpeed = !state.warp.isTransiting() && speed > 45 ? 0 : Math.min(45, speed);
    const motionScale = 1 + Math.min(1, plausibleSpeed / 24) * 0.22
      + (state.warp.isTransiting() ? 0.12 : 0);

    const profile = profileFor(settings.value.aimAssist, lastDevice);
    const candidate = chooseCandidate({
      state,
      profile,
      motionScale,
      intendedYaw,
      intendedPitch,
      intendedMagnitude,
      previousTarget,
      occlusionRay,
      cameraForward,
      toTarget
    });

    if (!candidate) {
      previousTarget = null;
      return look;
    }

    previousTarget = candidate.enemy.mesh;

    // Strong player intent away from the candidate releases friction immediately.
    const escaping = candidate.intent < -0.18;
    const frictionWeight = escaping ? 0 : candidate.center * candidate.center;
    const lookScale = 1 - profile.friction * frictionWeight;

    let yawCorrection = 0;
    let pitchCorrection = 0;
    if (!escaping && candidate.intent > 0.05) {
      const tracking = profile.trackingRate
        * dt
        * (0.35 + candidate.center * 0.65);
      const blend = 1 - Math.exp(-tracking);
      yawCorrection = candidate.yawError * blend;
      pitchCorrection = candidate.pitchError * blend;

      const correctionMagnitude = Math.hypot(yawCorrection, pitchCorrection);
      const maxStep = THREE.MathUtils.degToRad(profile.maxDegreesPerSecond) * dt;
      if (correctionMagnitude > maxStep && correctionMagnitude > 0.000001) {
        const scale = maxStep / correctionMagnitude;
        yawCorrection *= scale;
        pitchCorrection *= scale;
      }
    }

    // Convert angular correction back into look units. TraversalGame then applies
    // its ordinary sensitivity and exact center-ray shot logic unchanged.
    return {
      x: look.x * lookScale - yawCorrection / sensitivity,
      y: look.y * lookScale - pitchCorrection / (sensitivity * invertY)
    };
  };
}

function profileFor(strength: AimAssistStrength, device: LookDevice): AssistProfile {
  const base = CONTROLLER_PROFILES[strength];
  if (device !== "touch" || strength === "off") return base;

  // Touch receives a wider, slightly stronger interpretation of the same setting.
  // Standard touch therefore lands near Strong controller without a second menu.
  return {
    coneDegrees: base.coneDegrees * 1.32,
    friction: Math.min(0.52, base.friction * 1.18 + 0.03),
    trackingRate: base.trackingRate * 1.32,
    maxDegreesPerSecond: base.maxDegreesPerSecond * 1.28
  };
}

function chooseCandidate(args: {
  state: RuntimeState;
  profile: AssistProfile;
  motionScale: number;
  intendedYaw: number;
  intendedPitch: number;
  intendedMagnitude: number;
  previousTarget: THREE.Object3D | null;
  occlusionRay: THREE.Raycaster;
  cameraForward: THREE.Vector3;
  toTarget: THREE.Vector3;
}): Candidate | null {
  const {
    state,
    profile,
    motionScale,
    intendedYaw,
    intendedPitch,
    intendedMagnitude,
    previousTarget,
    occlusionRay,
    cameraForward,
    toTarget
  } = args;

  state.camera.getWorldDirection(cameraForward);
  let best: Candidate | null = null;

  for (const enemy of state.enemies) {
    if (!enemy.alive || !enemy.mesh.visible) continue;

    const originRule = evaluateActorOrigin(
      enemy.spec.kind,
      enemy.spec.originConstraint,
      [
        state.camera.position.x,
        state.camera.position.y,
        state.camera.position.z
      ] as [number, number, number]
    );
    if (!originRule.allowed) continue;

    toTarget.copy(enemy.mesh.position).sub(state.camera.position);
    const distance = toTarget.length();
    if (distance <= 0.001 || distance > 180) continue;

    toTarget.multiplyScalar(1 / distance);
    if (cameraForward.dot(toTarget) <= 0.08) continue;
    if (isOccluded(state, occlusionRay, toTarget, distance)) continue;

    const dx = enemy.mesh.position.x - state.camera.position.x;
    const dy = enemy.mesh.position.y - state.camera.position.y;
    const dz = enemy.mesh.position.z - state.camera.position.z;
    const desiredYaw = Math.atan2(-dx, -dz);
    const desiredPitch = Math.atan2(dy, Math.hypot(dx, dz));
    const yawError = shortestAngle(desiredYaw - state.yaw);
    const pitchError = desiredPitch - state.pitch;
    const angularError = Math.hypot(yawError * Math.cos(state.pitch), pitchError);

    const baseCone = THREE.MathUtils.degToRad(profile.coneDegrees) * motionScale;
    const isPrevious = enemy.mesh === previousTarget;
    const cone = baseCone * (isPrevious ? 1.28 : 1);
    if (angularError > cone || cone <= 0) continue;

    const intent = angularError <= 0.00001
      ? 1
      : THREE.MathUtils.clamp(
        (intendedYaw * yawError + intendedPitch * pitchError)
          / (intendedMagnitude * angularError),
        -1,
        1
      );

    const center = 1 - angularError / cone;
    const distanceScore = 1 - THREE.MathUtils.clamp(distance / 180, 0, 1);
    const score =
      center * 0.68
      + Math.max(0, intent) * 0.22
      + distanceScore * 0.06
      + (isPrevious ? 0.14 : 0);

    if (!best || score > best.score) {
      best = {
        enemy,
        yawError,
        pitchError,
        angularError,
        center,
        intent,
        score
      };
    }
  }

  return best;
}

function isOccluded(
  state: RuntimeState,
  ray: THREE.Raycaster,
  direction: THREE.Vector3,
  distance: number
): boolean {
  if (!state.platformMeshes.length || distance <= 0.8) return false;
  ray.set(state.camera.position, direction);
  ray.far = Math.max(0, distance - 0.65);
  return ray.intersectObjects(state.platformMeshes, false).length > 0;
}

function gamepadLookActive(settings: TraversalSettingsStore): boolean {
  const pad = activeGamepad();
  if (!pad) return false;
  const pair = resolveTraversalAction("look").gamepad.axisPair ?? [2, 3];
  const x = pad.axes[pair[0]] ?? 0;
  const y = pad.axes[pair[1]] ?? 0;
  const threshold = Math.min(0.34, Math.max(0.14, settings.value.controllerRightDeadzone + 0.04));
  return Math.hypot(x, y) > threshold;
}

function activeGamepad(): Gamepad | null {
  const pads = navigator.getGamepads?.() ?? [];
  for (const pad of pads) if (pad?.connected && pad.mapping === "standard") return pad;
  for (const pad of pads) if (pad?.connected) return pad;
  return null;
}

function shortestAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}
