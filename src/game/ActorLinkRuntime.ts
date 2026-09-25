import * as THREE from "three";
import { ROOMS, type EnemySpec, type HazardSpec } from "../world/stages";
import { UTILITY_ROLE_COLORS } from "./TraversalAccessibility";

type UtilityKind = keyof typeof UTILITY_ROLE_COLORS;

type ActiveEnemy = { spec: EnemySpec; mesh: THREE.Mesh; alive: boolean };

type RuntimeState = {
  scene: THREE.Scene;
  enemies: ActiveEnemy[];
  platformMeshes: THREE.Mesh[];
  roomIndex: number;
  loadRoom(index: number): void;
};

type Link = {
  actorId: string;
  curve: THREE.QuadraticBezierCurve3;
  line: THREE.Line;
  packets: THREE.Mesh[];
  target: () => THREE.Vector3;
  size: THREE.Vector3;
  color: number;
  firedAt: number;
};

type Idle = { mesh: THREE.Mesh; kind: UtilityKind; baseY: number; seed: number };

const PACKET_SPEED = 0.22;
const FIRE_DURATION = 0.7;

/**
 * Makes Cubes, Diamonds and Prisms legible as machinery: each wears a role
 * colour and idle motion, and a faint conduit arcs from it to whatever it
 * controls, with energy packets flowing along it. Resolving the shape fires the
 * conduit and flashes the outline of the thing that changed.
 * Presentation only: gameplay effects stay in the hazard/platform runtimes.
 */
export function installActorLinkRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  const group = new THREE.Group();
  group.name = "actor-links";
  let links: Link[] = [];
  let idles: Idle[] = [];
  const flashes: { mesh: THREE.LineSegments; born: number }[] = [];

  const clear = () => {
    for (const link of links) {
      link.line.geometry.dispose();
      (link.line.material as THREE.Material).dispose();
    }
    group.clear();
    links = [];
    idles = [];
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
      if (!(kind in UTILITY_ROLE_COLORS)) continue;
      idles.push({ mesh: enemy.mesh, kind, baseY: enemy.mesh.position.y, seed: idles.length * 1.7 });
      for (const targetId of enemy.spec.effect?.targetIds ?? []) {
        const locate = locateTarget(state, room.platforms, room.hazards ?? [], targetId);
        if (locate) links.push(buildLink(group, enemy, kind, locate.position, locate.size));
      }
    }
  };

  window.addEventListener("traversal:puzzle-actor", ((event: CustomEvent<{ actorId?: string }>) => {
    const now = performance.now() / 1000;
    for (const link of links) {
      if (link.actorId !== event.detail?.actorId || link.firedAt) continue;
      link.firedAt = now;
    }
  }) as EventListener);

  const tick = () => {
    requestAnimationFrame(tick);
    const now = performance.now() / 1000;

    for (const idle of idles) {
      if (!idle.mesh.visible) continue;
      const t = now + idle.seed;
      // Absolute poses: these override the generic enemy spin in TraversalGame.
      if (idle.kind === "cube") {
        idle.mesh.rotation.set(0.22 + t * 0.35, 0.35 + t * 0.5, 0.12);
      } else if (idle.kind === "diamond") {
        // Motion node: it bobs, the only utility that travels.
        idle.mesh.position.y = idle.baseY + Math.sin(t * 1.6) * 0.14;
        idle.mesh.rotation.set(0, t * 0.9, Math.PI * 0.25);
      } else {
        // Prism turns about its own long axis, like a lens being aimed.
        idle.mesh.rotation.set(Math.PI * 0.5, t * 1.2, 0);
      }
    }

    for (const link of links) {
      const end = link.target();
      const start = link.curve.v0;
      link.curve.v2.copy(end);
      link.curve.v1.copy(start).add(end).multiplyScalar(0.5);
      link.curve.v1.y += Math.max(1.2, start.distanceTo(end) * 0.18);
      const points = link.curve.getPoints(32);
      (link.line.geometry as THREE.BufferGeometry).setFromPoints(points);
      const material = link.line.material as THREE.LineBasicMaterial;

      if (!link.firedAt) {
        material.opacity = 0.22;
        link.packets.forEach((packet, i) => {
          packet.position.copy(link.curve.getPoint((now * PACKET_SPEED + i / link.packets.length) % 1));
        });
        continue;
      }

      const age = now - link.firedAt;
      const progress = Math.min(1, age / FIRE_DURATION);
      material.opacity = progress < 1 ? 0.9 : Math.max(0, 0.9 - (age - FIRE_DURATION) * 1.2);
      link.packets.forEach((packet, i) => {
        const lead = Math.min(1, progress * (1 + i * 0.08));
        packet.position.copy(link.curve.getPoint(lead));
        packet.scale.setScalar(1.6);
        packet.visible = material.opacity > 0.02;
      });
      if (progress >= 1 && !link.line.userData.flashed) {
        link.line.userData.flashed = true;
        const flash = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(link.size.x, link.size.y, link.size.z)),
          new THREE.LineBasicMaterial({ color: link.color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        flash.position.copy(end);
        group.add(flash);
        flashes.push({ mesh: flash, born: now });
      }
      link.line.visible = material.opacity > 0.02;
    }

    for (let i = flashes.length - 1; i >= 0; i -= 1) {
      const flash = flashes[i]!;
      const age = now - flash.born;
      const material = flash.mesh.material as THREE.LineBasicMaterial;
      material.opacity = Math.max(0, 1 - age / 0.9);
      flash.mesh.scale.setScalar(1 + age * 0.12);
      if (age > 0.9) {
        group.remove(flash.mesh);
        flash.mesh.geometry.dispose();
        material.dispose();
        flashes.splice(i, 1);
      }
    }
  };
  requestAnimationFrame(tick);
}

function locateTarget(
  state: RuntimeState,
  platforms: { id?: string; center: readonly number[]; size: readonly number[] }[],
  hazards: HazardSpec[],
  id: string
): { position: () => THREE.Vector3; size: THREE.Vector3 } | null {
  const platformIndex = platforms.findIndex((platform) => platform.id === id);
  if (platformIndex >= 0) {
    const spec = platforms[platformIndex]!;
    const mesh = state.platformMeshes[platformIndex];
    const fixed = new THREE.Vector3(...(spec.center as [number, number, number]));
    return { position: () => mesh ? mesh.position : fixed, size: new THREE.Vector3(...(spec.size as [number, number, number])) };
  }
  const hazard = hazards.find((entry) => entry.id === id);
  if (!hazard) return null;
  const centre = new THREE.Vector3(...hazard.center);
  return { position: () => centre, size: new THREE.Vector3(...hazard.size) };
}

function buildLink(group: THREE.Group, enemy: ActiveEnemy, kind: UtilityKind, target: () => THREE.Vector3, size: THREE.Vector3): Link {
  const color = UTILITY_ROLE_COLORS[kind];
  const start = enemy.mesh.position.clone();
  const curve = new THREE.QuadraticBezierCurve3(start, start.clone(), target().clone());
  const line = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  line.frustumCulled = false;
  const packetGeometry = new THREE.SphereGeometry(0.07, 8, 6);
  const packets = [0, 1, 2].map(() => {
    const packet = new THREE.Mesh(packetGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    packet.frustumCulled = false;
    group.add(packet);
    return packet;
  });
  group.add(line);
  return { actorId: enemy.spec.id, curve, line, packets, target, size, color, firedAt: 0 };
}
