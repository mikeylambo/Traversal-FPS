import * as THREE from "three";
import { ROOMS, type EnemySpec, type HazardSpec } from "../world/stages";
import { UTILITY_KINDS, utilityRoleColor, type UtilityKind } from "./TraversalAccessibility";

type ActiveEnemy = { spec: EnemySpec; mesh: THREE.Mesh; alive: boolean };

type RuntimeState = {
  scene: THREE.Scene;
  enemies: ActiveEnemy[];
  platformMeshes: THREE.Mesh[];
  roomIndex: number;
  loadRoom(index: number): void;
};

type Target = { position: () => THREE.Vector3; size: THREE.Vector3; hazard?: HazardSpec; platform?: boolean };

type Link = {
  actorId: string;
  kind: UtilityKind;
  curve: THREE.QuadraticBezierCurve3;
  tube: THREE.Mesh;
  packets: THREE.Mesh[];
  target: Target;
  color: number;
  firedAt: number;
  reacted: boolean;
  /** A Prism's aperture shift, so the reaction can outline the new window. */
  offset: number;
};

type Idle = { mesh: THREE.Mesh; kind: UtilityKind; baseY: number; seed: number; ornament: THREE.Group; halo: THREE.Sprite };
type Transient = { object: THREE.Object3D; born: number; duration: number; update: (age: number, dt: number) => void };

const PACKET_SPEED = 0.22;
const FIRE_DURATION = 0.55;
const TUBE_SEGMENTS = 28;

/**
 * Makes Cubes, Diamonds and Prisms legible as machinery, at a distance and in
 * consequence. Each wears its role colour as a halo and an ornament that moves
 * the way its job does (frames lock, rings lift, blades aim), and a conduit
 * tube carries a slow trickle of energy to whatever it controls.
 *
 * Resolving one fires the conduit, and the thing that changed answers visibly
 * where it stands: a disabled barrier breaks apart slab by slab, a woken
 * platform ignites along its edges and keeps a moving rim, a shifted aperture
 * flares and outlines its new window. Presentation only: gameplay effects stay
 * in the hazard and platform runtimes.
 */
export function installActorLinkRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  const group = new THREE.Group();
  group.name = "actor-links";
  let links: Link[] = [];
  let idles: Idle[] = [];
  let transients: Transient[] = [];
  let last = performance.now() / 1000;

  const clear = () => {
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | undefined;
      material?.dispose?.();
    });
    group.clear();
    for (const idle of idles) idle.mesh.remove(idle.ornament, idle.halo);
    links = [];
    idles = [];
    transients = [];
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    clear();
    if (group.parent !== state.scene) state.scene.add(group);
    const room = ROOMS[index];
    if (!room) return;

    for (const enemy of state.enemies) {
      const kind = enemy.spec.kind as UtilityKind;
      if (!UTILITY_KINDS.includes(kind)) continue;
      const radius = enemy.spec.radius ?? 0.72;
      enemy.mesh.userData.radius = radius;
      const ornament = buildOrnament(kind, radius);
      const halo = buildHalo(kind, radius);
      enemy.mesh.add(ornament, halo);
      idles.push({ mesh: enemy.mesh, kind, baseY: enemy.mesh.position.y, seed: idles.length * 1.7, ornament, halo });
      for (const targetId of enemy.spec.effect?.targetIds ?? []) {
        const target = locateTarget(state, room.platforms, room.hazards ?? [], targetId);
        if (target) links.push(buildLink(group, enemy, kind, target));
      }
    }
  };

  window.addEventListener("traversal:puzzle-actor", ((event: CustomEvent<{ actorId?: string }>) => {
    const now = performance.now() / 1000;
    const idle = idles.find((entry) => entry.mesh === state.enemies.find((e) => e.spec.id === event.detail?.actorId)?.mesh);
    if (idle) transients.push(burst(group, idle.mesh.position.clone(), utilityRoleColor(idle.kind), now));
    for (const link of links) {
      if (link.actorId !== event.detail?.actorId || link.firedAt) continue;
      link.firedAt = now;
    }
  }) as EventListener);

  const tick = () => {
    requestAnimationFrame(tick);
    const now = performance.now() / 1000;
    const dt = Math.min(0.1, now - last);
    last = now;

    for (const idle of idles) {
      if (!idle.mesh.visible) continue;
      const t = now + idle.seed;
      // Absolute poses: these override the generic enemy spin in TraversalGame.
      if (idle.kind === "cube") {
        idle.mesh.rotation.set(0.22 + t * 0.35, 0.35 + t * 0.5, 0.12);
        // State switch: two frames counter-turn and click square every few seconds.
        const snap = Math.round(t * 0.5) / 0.5;
        const settle = THREE.MathUtils.smoothstep(Math.abs(t - snap), 0, 0.35);
        idle.ornament.children[0]!.rotation.set(0, settle * t * 0.9, 0);
        idle.ornament.children[1]!.rotation.set(settle * -t * 0.7, 0, Math.PI / 4);
        idle.ornament.quaternion.copy(idle.mesh.quaternion).invert();
      } else if (idle.kind === "diamond") {
        // Motion node: it bobs, the only utility that travels, and its rings lift.
        idle.mesh.position.y = idle.baseY + Math.sin(t * 1.6) * 0.14;
        idle.mesh.rotation.set(0, t * 0.9, Math.PI * 0.25);
        idle.ornament.quaternion.copy(idle.mesh.quaternion).invert();
        idle.ornament.children.forEach((ring, i) => {
          const phase = (t * 0.45 + i / idle.ornament.children.length) % 1;
          ring.position.y = (phase - 0.5) * 2.6 * (idle.mesh.userData.radius ?? 0.72);
          ((ring as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.sin(phase * Math.PI) * 0.9;
        });
      } else {
        // Prism turns about its own long axis, like a lens being aimed.
        idle.mesh.rotation.set(Math.PI * 0.5, t * 1.2, 0);
        idle.ornament.rotation.set(0, -t * 0.6, 0);
      }
      idle.halo.material.opacity = 0.55 + Math.sin(t * 2.1) * 0.12;
    }

    for (const link of links) {
      const end = link.target.position();
      const start = link.curve.v0;
      const moved = !link.curve.v2.equals(end);
      if (moved || !link.tube.userData.built) {
        link.curve.v2.copy(end);
        link.curve.v1.copy(start).add(end).multiplyScalar(0.5);
        link.curve.v1.y += Math.max(1.2, start.distanceTo(end) * 0.18);
        link.tube.geometry.dispose();
        link.tube.geometry = new THREE.TubeGeometry(link.curve, TUBE_SEGMENTS, 0.05, 6, false);
        link.tube.userData.built = true;
      }
      const material = link.tube.material as THREE.MeshBasicMaterial;

      if (!link.firedAt) {
        material.opacity = 0.34;
        link.packets.forEach((packet, i) => {
          packet.position.copy(link.curve.getPoint((now * PACKET_SPEED + i / link.packets.length) % 1));
        });
        continue;
      }

      const age = now - link.firedAt;
      const progress = Math.min(1, age / FIRE_DURATION);
      material.opacity = progress < 1 ? 0.95 : Math.max(0, 0.95 - (age - FIRE_DURATION) * 1.1);
      link.packets.forEach((packet, i) => {
        packet.position.copy(link.curve.getPoint(Math.min(1, progress * (1 + i * 0.1))));
        packet.scale.setScalar(2.2 - i * 0.4);
        packet.visible = material.opacity > 0.02;
      });
      link.tube.visible = material.opacity > 0.02;
      if (progress >= 1 && !link.reacted) {
        link.reacted = true;
        transients.push(...react(group, link, now));
      }
    }

    transients = transients.filter((entry) => {
      const age = now - entry.born;
      if (age > entry.duration) {
        group.remove(entry.object);
        entry.object.traverse((object) => {
          (object as THREE.Mesh).geometry?.dispose?.();
          ((object as THREE.Mesh).material as THREE.Material | undefined)?.dispose?.();
        });
        return false;
      }
      entry.update(age, dt);
      return true;
    });
  };
  requestAnimationFrame(tick);
}

const additive = (color: number, opacity: number, extra: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, ...extra });

let haloTexture: THREE.Texture | null = null;
function softDisc(): THREE.Texture {
  if (haloTexture) return haloTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.35)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  haloTexture = new THREE.CanvasTexture(canvas);
  return haloTexture;
}

function buildHalo(kind: UtilityKind, radius: number): THREE.Sprite {
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softDisc(), color: utilityRoleColor(kind), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  halo.scale.setScalar(radius * 5.2);
  return halo;
}

/** Each role's ornament moves the way its job does. */
function buildOrnament(kind: UtilityKind, radius: number): THREE.Group {
  const color = utilityRoleColor(kind);
  const group = new THREE.Group();
  if (kind === "cube") {
    for (const scale of [2.5, 3.1]) {
      const frame = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(radius * scale, radius * scale * 0.08, radius * scale)),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      group.add(frame);
    }
  } else if (kind === "diamond") {
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.55, radius * 0.035, 6, 40), additive(color, 0.8));
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(radius * 0.18, radius * 3.6), additive(color, 0.55, { side: THREE.DoubleSide }));
      const angle = (i / 3) * Math.PI * 2;
      blade.position.set(Math.cos(angle) * radius * 1.4, 0, Math.sin(angle) * radius * 1.4);
      blade.rotation.y = -angle;
      group.add(blade);
    }
  }
  return group;
}

function burst(group: THREE.Group, at: THREE.Vector3, color: number, born: number): Transient {
  const root = new THREE.Group();
  root.position.copy(at);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), additive(color, 0.6));
  root.add(shell);
  group.add(root);
  return {
    object: root, born, duration: 0.6,
    update: (age) => {
      const k = age / 0.6;
      shell.scale.setScalar(0.6 + k * 3.4);
      (shell.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k) * (1 - k);
    }
  };
}

/** The changed thing answers where it stands. */
function react(group: THREE.Group, link: Link, now: number): Transient[] {
  const at = link.target.position().clone();
  const size = link.target.size;
  const hazard = link.target.hazard;

  if (link.kind === "cube" || (hazard && link.kind !== "prism")) {
    // Barrier comes apart: slabs along its longest axis drift outward and fade, staggered.
    const root = new THREE.Group();
    root.position.copy(at);
    const axis = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";
    const count = Math.max(4, Math.min(14, Math.round(size[axis] / 1.2)));
    const slabs: { mesh: THREE.Mesh; delay: number; drift: THREE.Vector3 }[] = [];
    for (let i = 0; i < count; i++) {
      const slabSize = size.clone();
      slabSize[axis] = size[axis] / count * 0.92;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(slabSize.x, slabSize.y, slabSize.z), additive(link.color, 0.55));
      mesh.position[axis] = -size[axis] / 2 + (i + 0.5) * (size[axis] / count);
      const drift = new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.9 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6);
      slabs.push({ mesh, delay: (i / count) * 0.5, drift });
      root.add(mesh);
    }
    group.add(root);
    return [{
      object: root, born: now, duration: 1.4,
      update: (age) => {
        for (const slab of slabs) {
          const k = THREE.MathUtils.clamp((age - slab.delay) / 0.8, 0, 1);
          (slab.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
          slab.mesh.scale.setScalar(1 - k * 0.5);
          slab.mesh.position.addScaledVector(slab.drift, k > 0 && k < 1 ? 0.016 : 0);
        }
      }
    }];
  }

  if (link.kind === "diamond" || link.target.platform) {
    // Platform ignites along its edges, a light column lifts off it, and it keeps a rim.
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x + 0.08, size.y + 0.08, size.z + 0.08)),
      new THREE.LineBasicMaterial({ color: link.color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const column = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(size.x, size.z) * 0.45, Math.max(size.x, size.z) * 0.55, 14, 24, 1, true), additive(link.color, 0.35, { side: THREE.DoubleSide }));
    column.position.y = 7;
    const root = new THREE.Group();
    root.add(outline, column);
    group.add(root);
    const follow = link.target.position;
    return [{
      object: root, born: now, duration: 600,
      update: (age) => {
        root.position.copy(follow());
        const flare = Math.max(0, 1 - age / 0.9);
        (outline.material as THREE.LineBasicMaterial).opacity = 0.35 + flare * 0.65;
        (column.material as THREE.MeshBasicMaterial).opacity = 0.35 * flare;
        column.scale.set(1 + (1 - flare) * 0.3, 0.2 + (1 - flare) * 0.8, 1 + (1 - flare) * 0.3);
        column.visible = flare > 0.01;
      }
    }];
  }

  // Prism: the wall flares, and its new window is outlined where it now sits.
  const root = new THREE.Group();
  root.position.copy(at);
  const flare = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), additive(link.color, 0.5));
  root.add(flare);
  let window: THREE.LineSegments | null = null;
  const aperture = hazard?.aperture;
  if (aperture && hazard) {
    const primary = aperture.axis === "x" ? "x" : "y";
    const secondary = aperture.axis === "x" ? "y" : "x";
    const thin = size.x <= size.y && size.x <= size.z ? "x" : size.y <= size.z ? "y" : "z";
    const box = new THREE.Vector3();
    box[primary] = aperture.span;
    box[secondary] = aperture.axis === "x" ? Math.min(size.y * 0.62, 6.2) : Math.min(size.x * 0.5, 6.2);
    box[thin] = size[thin] + 0.2;
    window = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(box.x, box.y, box.z)),
      new THREE.LineBasicMaterial({ color: link.color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    window.position[primary] = aperture.center + link.offset;
    root.add(window);
  }
  group.add(root);
  return [{
    object: root, born: now, duration: 2.2,
    update: (age) => {
      (flare.material as THREE.MeshBasicMaterial).opacity = 0.5 * Math.max(0, 1 - age / 0.5);
      if (window) (window.material as THREE.LineBasicMaterial).opacity = age < 1.4 ? 1 : Math.max(0, 1 - (age - 1.4) / 0.8);
    }
  }];
}

function locateTarget(
  state: RuntimeState,
  platforms: { id?: string; center: readonly number[]; size: readonly number[] }[],
  hazards: HazardSpec[],
  id: string
): Target | null {
  const platformIndex = platforms.findIndex((platform) => platform.id === id);
  if (platformIndex >= 0) {
    const spec = platforms[platformIndex]!;
    const mesh = state.platformMeshes[platformIndex];
    const fixed = new THREE.Vector3(...(spec.center as [number, number, number]));
    return { position: () => mesh ? mesh.position : fixed, size: new THREE.Vector3(...(spec.size as [number, number, number])), platform: true };
  }
  const hazard = hazards.find((entry) => entry.id === id);
  if (!hazard) return null;
  const centre = new THREE.Vector3(...hazard.center);
  return { position: () => centre, size: new THREE.Vector3(...hazard.size), hazard };
}

function buildLink(group: THREE.Group, enemy: ActiveEnemy, kind: UtilityKind, target: Target): Link {
  const color = utilityRoleColor(kind);
  const start = enemy.mesh.position.clone();
  const curve = new THREE.QuadraticBezierCurve3(start, start.clone(), target.position().clone());
  const tube = new THREE.Mesh(new THREE.BufferGeometry(), additive(color, 0.26));
  tube.frustumCulled = false;
  const packetGeometry = new THREE.SphereGeometry(0.11, 10, 8);
  const packets = [0, 1, 2].map(() => {
    const packet = new THREE.Mesh(packetGeometry, additive(color, 0.9));
    packet.frustumCulled = false;
    group.add(packet);
    return packet;
  });
  group.add(tube);
  const effect = enemy.spec.effect;
  const offset = effect?.type === "shift-aperture" ? effect.offset : 0;
  return { actorId: enemy.spec.id, kind, curve, tube, packets, target, color, firedAt: 0, reacted: false, offset };
}
