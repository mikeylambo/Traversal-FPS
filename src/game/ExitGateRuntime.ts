import * as THREE from "three";
import {
  emitTraversalAudioAt,
  startTraversalAudioLoop,
  type TraversalAudioLoopHandle
} from "../audio/TraversalAudio";
import { mountRegisteredVisual } from "../art/procedural/ProceduralVisualRegistry";
import { ROOMS } from "../world/stages";

type RuntimeState = {
  roomIndex: number;
  roomKills: number;
  exactKills: boolean;
  goal: THREE.Mesh;
  goalMaterial: THREE.MeshBasicMaterial;
  goalLight: THREE.PointLight;
  loadRoom(index: number): void;
  updateHUD(): void;
  flashMessage(message: string, duration: number): void;
};

const READY_COLOR = 0x78ffb2;
const LOCKED_COLOR = 0x6f95a6;
const BEACON_HEIGHT = 70;

/**
 * Gravity Rings are the only sector exits. The semantic torus remains authoritative;
 * generated visuals are presentation-only children mounted through the registry.
 */
export function installExitGateRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  let wasReady = false;
  // A positional bed on the open exit. Same job the landing ground cue does for a
  // warp: it tells you where the way out is without requiring you to be looking at it.
  let ringLoop: TraversalAudioLoopHandle | null = null;
  decorateGravityRing(state.goal);
  mountRegisteredVisual(state.goal, "exit.gravity-ring.default");
  // The exit must read from anywhere in the sector, locked or not: the ring
  // ignores fog, and a faint light pillar marks it above the geometry.
  const beacon = createBeacon();
  const ignoreFog = () => state.goal.traverse((child) => {
    const materials = child instanceof THREE.Mesh ? (Array.isArray(child.material) ? child.material : [child.material]) : [];
    for (const material of materials) {
      if ("fog" in material && material.fog) { material.fog = false; material.needsUpdate = true; }
    }
  });

  const sync = () => {
    const room = ROOMS[state.roomIndex];
    if (!room) return;
    const ready = state.exactKills
      ? state.roomKills === room.requiredKills
      : state.roomKills >= room.requiredKills;

    state.goalMaterial.color.setHex(ready ? READY_COLOR : LOCKED_COLOR);
    state.goalMaterial.opacity = ready ? 0.96 : 0.5;
    if (!beacon.parent && state.goal.parent) state.goal.parent.add(beacon);
    beacon.position.copy(state.goal.position);
    beacon.visible = state.goal.visible;
    const beaconMaterial = beacon.material as THREE.ShaderMaterial;
    beaconMaterial.uniforms.uColor.value.setHex(ready ? READY_COLOR : LOCKED_COLOR);
    beaconMaterial.uniforms.uStrength.value = ready ? 0.55 : 0.22;
    state.goalLight.color.setHex(READY_COLOR);
    state.goalLight.intensity = ready ? 4 : 0;
    state.goal.userData.gravityRingReady = ready;
    document.body.classList.toggle("gravity-ring-ready", ready);
    document.body.classList.toggle("gravity-ring-locked", !ready);
    document.body.classList.toggle("exit-ready", ready);
    document.body.classList.toggle("exit-locked", !ready);

    for (const child of state.goal.children) {
      if (child.userData.traversalPresentationOnly) continue;
      const material = child instanceof THREE.Mesh ? child.material : undefined;
      if (material instanceof THREE.MeshBasicMaterial) material.opacity = ready ? 0.7 : 0.3;
    }

    if (ready && !wasReady) {
      document.body.classList.remove("exit-activated");
      void document.body.offsetWidth;
      document.body.classList.add("exit-activated");
      state.flashMessage("GRAVITY RING ONLINE // ENTER TO ADVANCE", 1800);
      emitTraversalAudioAt("exit.online", state.goal.position);
      window.setTimeout(() => document.body.classList.remove("exit-activated"), 520);
    }

    if (ready && !ringLoop) ringLoop = startTraversalAudioLoop("exit.loop", state.goal.position);
    ringLoop?.setPosition(state.goal.position.x, state.goal.position.y, state.goal.position.z);
    ringLoop?.setIntensity(ready ? 1 : 0);

    wasReady = ready;
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    wasReady = false;
    originalLoadRoom(index);
    ignoreFog();
    sync();
  };

  const originalHUD = state.updateHUD.bind(game);
  state.updateHUD = () => {
    originalHUD();
    sync();
  };

  sync();
}

function decorateGravityRing(goal: THREE.Mesh): void {
  if (goal.userData.gravityRingDecorated) return;
  goal.userData.gravityRingDecorated = true;

  const material = () => new THREE.MeshBasicMaterial({
    color: 0xb8ffcf,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const outer = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.035, 8, 64), material());
  outer.rotation.x = Math.PI * 0.5;
  outer.rotation.z = Math.PI * 0.18;

  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.028, 8, 48), material());
  inner.rotation.y = Math.PI * 0.5;
  inner.rotation.z = -Math.PI * 0.22;

  const axis = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.018, 6, 56), material());
  axis.rotation.x = Math.PI * 0.28;
  axis.rotation.y = Math.PI * 0.22;

  goal.add(outer, inner, axis);
}

/** A thin vertical light column above the ring, fading upward; fog-immune. */
function createBeacon(): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(0.07, 0.07, BEACON_HEIGHT, 10, 1, true);
  geometry.translate(0, BEACON_HEIGHT / 2 + 1.8, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(LOCKED_COLOR) }, uStrength: { value: 0.22 } },
    vertexShader: `
      varying float vT;
      void main() {
        vT = (position.y - 1.8) / ${BEACON_HEIGHT.toFixed(1)};
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uStrength;
      varying float vT;
      void main() {
        float a = uStrength * smoothstep(0.0, 0.04, vT) * pow(1.0 - vT, 2.2);
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "gravity-ring-beacon";
  mesh.frustumCulled = false;
  return mesh;
}
