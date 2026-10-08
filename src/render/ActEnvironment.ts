import * as THREE from "three";
import { motionScale } from "../game/TraversalAccessibility";
import type { RoomSpec } from "../world/stages";
import { hasProceduralVisual, mountRegisteredVisual, type ProceduralVisualKey } from "../art/procedural/ProceduralVisualRegistry";

/**
 * Per-act architecture around a Campaign field. The campaign travels outside →
 * inside → deeper inside → breaking open:
 *   I   OPEN CONSTRUCT  open void, distant pylons and horizon traces
 *   II  THE MACHINE     an interior hall: ribbed walls, light strips, a ceiling,
 *                       great drums turning slowly in the walls
 *   III DEEP CORE       a tighter, darker hall: warning bands that pulse and
 *                       wall pistons that heave
 *   IV  BREACH          the shell breaks open: wall panels missing to the stars,
 *                       slabs drifting off the ceiling, colossal rings outside
 *
 * Everything sits well outside the playable bounds and is presentation only: no
 * collision, never in the shot or warp lists, so it can never block a line.
 */
export type Act = "I" | "II" | "III" | "IV";

export function actForSector(sector: number): Act {
  return sector <= 8 ? "I" : sector <= 18 ? "II" : sector <= 30 ? "III" : "IV";
}

export const FINALE_SECTORS = new Set([8, 18, 30, 42]);

type Bounds = { min: THREE.Vector3; max: THREE.Vector3; centre: THREE.Vector3; size: THREE.Vector3 };

export function roomBounds(room: RoomSpec): Bounds {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const grow = (p: readonly number[], h: readonly number[] = [0, 0, 0]) => {
    min.min(new THREE.Vector3(p[0]! - h[0]!, p[1]! - h[1]!, p[2]! - h[2]!));
    max.max(new THREE.Vector3(p[0]! + h[0]!, p[1]! + h[1]!, p[2]! + h[2]!));
  };
  grow(room.spawn);
  grow(room.goal);
  for (const p of room.platforms) grow(p.center, p.size.map((s) => s / 2));
  for (const e of room.enemies) grow(e.position, [2, 2, 2]);
  return { min, max, centre: min.clone().add(max).multiplyScalar(0.5), size: max.clone().sub(min) };
}

/**
 * Authored art hook: when a model slot (src/art/models/modelSlots.ts) has loaded
 * a GLB for `key`, it stands in for the procedural `fallback`, taking its place,
 * facing and size (longest side = `size` metres). Otherwise the fallback stays.
 * Returns whichever object is in the scene, so animation drives either.
 */
function dress(parent: THREE.Object3D, key: ProceduralVisualKey, fallback: THREE.Object3D, size: number): THREE.Object3D {
  if (!hasProceduralVisual(key)) return fallback;
  const anchor = new THREE.Group();
  anchor.position.copy(fallback.position);
  anchor.quaternion.copy(fallback.quaternion);
  const visual = mountRegisteredVisual(anchor, key);
  if (!visual) return fallback;
  const extent = new THREE.Box3().setFromObject(visual).getSize(new THREE.Vector3());
  anchor.scale.setScalar(size / Math.max(extent.x, extent.y, extent.z, 1e-6));
  parent.remove(fallback);
  parent.add(anchor);
  return anchor;
}

export interface ActEnvironment {
  group: THREE.Group;
  update(time: number, dt: number): void;
}

const PALETTE: Record<Act, { wall: number; line: number; accent: number }> = {
  I: { wall: 0x071624, line: 0x70efff, accent: 0x70efff },
  II: { wall: 0x061a22, line: 0x5ff2e0, accent: 0x9ffff0 },
  III: { wall: 0x120914, line: 0xc77dff, accent: 0xffb347 },
  IV: { wall: 0x140c10, line: 0xffb38a, accent: 0xffd6a8 }
};

export function buildActEnvironment(room: RoomSpec, act: Act): ActEnvironment {
  const bounds = roomBounds(room);
  const palette = PALETTE[act];
  const group = new THREE.Group();
  group.name = `act-environment-${act}`;
  const updaters: ((time: number, dt: number) => void)[] = [];

  const wallMaterial = new THREE.MeshStandardMaterial({ color: palette.wall, emissive: palette.wall, emissiveIntensity: 0.35, roughness: 0.85, metalness: 0.3 });
  const lineMaterial = (opacity: number, color = palette.line) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = (opacity: number, color = palette.accent) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const box = (size: [number, number, number], position: THREE.Vector3, material: THREE.Material = wallMaterial) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.copy(position);
    group.add(mesh);
    return mesh;
  };

  if (act === "I") {
    // Open construct: pylons ring the field at a distance, horizon traces below.
    const radius = Math.max(bounds.size.x, bounds.size.z) * 0.5 + 45;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const h = 40 + (i % 3) * 18;
      const p = new THREE.Vector3(bounds.centre.x + Math.cos(a) * radius, bounds.min.y - 10 + h / 2, bounds.centre.z + Math.sin(a) * radius);
      const pylon = box([3, h, 3], p);
      if (dress(group, "environment.act-i.pylon", pylon, h) !== pylon) continue;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(pylon.geometry), lineMaterial(0.3));
      edges.position.copy(p);
      group.add(edges);
    }
    for (const dy of [-8, -14]) {
      const y = bounds.min.y + dy;
      const w = bounds.size.x + 160;
      for (const dz of [-40, -90]) {
        const z = bounds.min.z + dz;
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(bounds.centre.x - w / 2, y, z), new THREE.Vector3(bounds.centre.x + w / 2, y, z)]), lineMaterial(0.22)));
      }
    }
    return { group, update: () => undefined };
  }

  // Interior acts: a hall around the field.
  const margin = act === "II" ? 34 : act === "III" ? 26 : 30;
  const lo = bounds.min.clone().addScalar(-margin);
  const hi = bounds.max.clone().addScalar(margin);
  lo.y = bounds.min.y - (act === "III" ? 18 : 26);
  hi.y = bounds.max.y + (act === "III" ? 16 : 24);
  const span = hi.clone().sub(lo);
  const mid = lo.clone().add(hi).multiplyScalar(0.5);
  const thickness = 2;

  // Walls as panels on a grid so Act IV can leave gaps.
  const panel = 16;
  const breach = (i: number, j: number, face: number) => act === "IV" && ((i * 7 + j * 3 + face * 5) % 5 === 0 || (i + j + face) % 7 === 0);
  const wallFace = (face: number, axis: "x" | "z", at: number, alongMin: number, alongMax: number) => {
    const cols = Math.max(1, Math.round((alongMax - alongMin) / panel));
    const rows = Math.max(1, Math.round(span.y / panel));
    const cw = (alongMax - alongMin) / cols;
    const rh = span.y / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (breach(i, j, face)) continue;
        const along = alongMin + (i + 0.5) * cw;
        const y = lo.y + (j + 0.5) * rh;
        const p = axis === "x" ? new THREE.Vector3(at, y, along) : new THREE.Vector3(along, y, at);
        const size: [number, number, number] = axis === "x" ? [thickness, rh - 0.4, cw - 0.4] : [cw - 0.4, rh - 0.4, thickness];
        const slab = box(size, p);
        // Faint seams so the hall reads as built panels, not a black void.
        const seam = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), lineMaterial(0.1));
        seam.position.copy(p);
        group.add(seam);
      }
    }
    // Ribs: vertical members every panel, catching the light.
    for (let i = 0; i <= cols; i++) {
      const along = alongMin + i * cw;
      const p = axis === "x" ? new THREE.Vector3(at, mid.y, along) : new THREE.Vector3(along, mid.y, at);
      const rib = box(axis === "x" ? [thickness * 2.2, span.y, 1.2] : [1.2, span.y, thickness * 2.2], p);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(rib.geometry), lineMaterial(0.22));
      edge.position.copy(p);
      group.add(edge);
    }
    // Light strips: horizontal bands that run the length of the wall.
    for (const fraction of act === "III" ? [0.22, 0.5, 0.78] : [0.3, 0.7]) {
      const y = lo.y + span.y * fraction;
      const length = alongMax - alongMin;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(axis === "x" ? 0.3 : length, 0.35, axis === "x" ? length : 0.3), glow(act === "III" ? 0.5 : 0.6, act === "III" ? (fraction === 0.5 ? palette.accent : palette.line) : palette.accent));
      strip.position.copy(axis === "x" ? new THREE.Vector3(at + (at > mid.x ? -1.4 : 1.4), y, (alongMin + alongMax) / 2) : new THREE.Vector3((alongMin + alongMax) / 2, y, at + (at > mid.z ? -1.4 : 1.4)));
      group.add(strip);
      if (act === "III") {
        const material = strip.material as THREE.MeshBasicMaterial;
        const phase = fraction * 9;
        updaters.push((time) => { material.opacity = 0.2 + 0.4 * (0.5 + 0.5 * Math.sin(time * 1.6 + phase)) * motionScale(); });
      }
    }
  };
  wallFace(0, "x", lo.x, lo.z, hi.z);
  wallFace(1, "x", hi.x, lo.z, hi.z);
  wallFace(2, "z", lo.z, lo.x, hi.x);
  wallFace(3, "z", hi.z, lo.x, hi.x);

  // Ceiling beams and a floor grid far below.
  const beams = Math.max(3, Math.round(span.z / 18));
  for (let i = 0; i <= beams; i++) {
    const z = lo.z + (i / beams) * span.z;
    const beam = box([span.x, 2.4, 2.4], new THREE.Vector3(mid.x, hi.y, z));
    if (act === "IV" && i % 3 === 1) {
      // Breaking open: some beams have come loose and hang at an angle, drifting.
      beam.rotation.z = 0.18 * (i % 2 ? 1 : -1);
      const base = beam.position.y;
      updaters.push((time) => { beam.position.y = base - 3 - Math.sin(time * 0.2 + i) * 1.5 * motionScale(); });
    }
  }
  if (act !== "IV") {
    const roof = box([span.x, thickness, span.z], new THREE.Vector3(mid.x, hi.y + 2.2, mid.z));
    roof.material = wallMaterial;
  }
  const grid = new THREE.GridHelper(Math.max(span.x, span.z), Math.round(Math.max(span.x, span.z) / 8), palette.line, palette.line);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.12;
  grid.position.set(mid.x, lo.y, mid.z);
  group.add(grid);

  if (act === "II") {
    // The machine: great drums set into the long walls, turning slowly.
    for (const side of [-1, 1]) {
      for (const along of [0.25, 0.75]) {
        const radius = Math.min(span.y * 0.28, 14);
        const drum = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 4, 40, 1, true), wallMaterial);
        body.rotation.z = Math.PI / 2;
        const teeth = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(radius + 0.6, radius + 0.6, 4.4, 24)), lineMaterial(0.35, palette.accent));
        teeth.rotation.z = Math.PI / 2;
        drum.add(body, teeth);
        drum.position.set(side < 0 ? lo.x + 4 : hi.x - 4, mid.y, lo.z + span.z * along);
        group.add(drum);
        const dressed = dress(group, "environment.act-ii.drum", drum, radius * 2.3);
        updaters.push((_t, dt) => { dressed.rotation.x += dt * 0.08 * side * motionScale(); });
      }
    }
  }

  if (act === "III") {
    // Deep core: wall pistons heave on a slow, uneven beat.
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const z = lo.z + ((i + 0.5) / 6) * span.z;
      const piston = box([5, span.y * 0.45, 5], new THREE.Vector3(side < 0 ? lo.x + 4 : hi.x - 4, lo.y + span.y * 0.22, z));
      const band = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.6, 5.2), glow(0.7, palette.accent));
      piston.add(band);
      band.position.y = span.y * 0.22;
      const base = piston.position.y;
      const dressed = dress(group, "environment.act-iii.piston", piston, span.y * 0.45);
      updaters.push((time) => { dressed.position.y = base + Math.max(0, Math.sin(time * 0.45 + i * 1.3)) * span.y * 0.18 * motionScale(); });
    }
  }

  if (act === "IV") {
    // Outside the breach: colossal rings standing in the void.
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(60 + i * 26, 1.6, 8, 96), glow(0.18, i === 1 ? palette.line : palette.accent));
      ring.position.set(mid.x + (i - 1) * 40, mid.y + 10, lo.z - 70 - i * 30);
      ring.rotation.set(0.3 * i, 0.4 - i * 0.3, 0);
      group.add(ring);
      const dressed = dress(group, "environment.act-iv.ring", ring, (60 + i * 26) * 2.1);
      updaters.push((_t, dt) => { dressed.rotation.z += dt * 0.02 * (i % 2 ? -1 : 1) * motionScale(); });
    }
  }

  return { group, update: (time, dt) => updaters.forEach((fn) => fn(time, dt)) };
}

/**
 * Finale gate: a colossal ring of segments standing beyond the goal. One segment
 * lights per Sphere the room requires as you kill them; when the Gravity Ring
 * unlocks the segments close into alignment and a beam fires through to it.
 */
export interface FinaleGate {
  group: THREE.Group;
  setProgress(kills: number, required: number, time: number): void;
  update(time: number, dt: number): void;
}

export function buildFinaleGate(room: RoomSpec, act: Act): FinaleGate {
  const bounds = roomBounds(room);
  const palette = PALETTE[act];
  const goal = new THREE.Vector3(...room.goal);
  // Stand it beyond the goal, facing back along the room.
  const away = goal.clone().sub(bounds.centre).setY(0);
  if (away.lengthSq() < 1) away.set(0, 0, -1);
  away.normalize();
  // Inside the hall on every act (interior margins are 26m+), framing the goal.
  const radius = Math.max(10, Math.min(18, Math.max(bounds.size.x, bounds.size.z) * 0.3));
  const centre = goal.clone().addScaledVector(away, 20).setY(goal.y + radius * 0.55);

  const group = new THREE.Group();
  group.name = "finale-gate";
  group.position.copy(centre);
  group.lookAt(goal.x, centre.y, goal.z);

  const count = Math.max(4, room.requiredKills);
  const segments: { mesh: THREE.Mesh; angle: number; lit: number }[] = [];
  const arc = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    const geometry = new THREE.TorusGeometry(radius, radius * 0.1, 8, 24, arc * 0.82);
    const material = new THREE.MeshBasicMaterial({ color: palette.accent, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    const angle = i * arc;
    mesh.rotation.z = angle;
    group.add(mesh);
    segments.push({ mesh, angle, lit: 0 });
  }
  const core = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.92, 64), new THREE.MeshBasicMaterial({ color: palette.accent, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  group.add(core);
  const beamLength = centre.distanceTo(goal);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.4, beamLength, 16, 1, true), new THREE.MeshBasicMaterial({ color: palette.accent, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.rotation.x = Math.PI / 2;
  beam.position.z = beamLength / 2;
  group.add(beam);
  // Optional sculpted frame behind the segments (authored art only).
  const framePlace = new THREE.Object3D();
  framePlace.position.z = -1.5;
  group.add(framePlace);
  dress(group, "environment.finale.frame", framePlace, radius * 2.5);

  let target = 0;
  let open = 0;
  let unlockedAt = -1;
  return {
    group,
    setProgress(kills, required, time) {
      target = Math.min(1, kills / Math.max(1, required));
      if (target >= 1 && unlockedAt < 0) {
        unlockedAt = time;
        window.dispatchEvent(new CustomEvent("traversal:finale-unlock", { detail: { roomId: room.id, act } }));
      }
    },
    update(time, dt) {
      const litCount = Math.round(target * count);
      segments.forEach((segment, i) => {
        segment.lit = THREE.MathUtils.lerp(segment.lit, i < litCount ? 1 : 0, Math.min(1, dt * 3));
        const material = segment.mesh.material as THREE.MeshBasicMaterial;
        material.opacity = 0.1 + segment.lit * 0.9;
        // Lit segments are pushed past white so the bloom pass catches them.
        material.color.setHex(palette.accent).multiplyScalar(1 + segment.lit * 2.2);
        // Unlit segments hang slightly out of true; lit ones settle into the ring.
        const drift = (1 - segment.lit) * 0.12 * Math.sin(time * 0.4 + i) * motionScale();
        segment.mesh.rotation.z = segment.angle + drift;
        segment.mesh.position.set(Math.cos(segment.angle) * (1 - segment.lit) * 2, Math.sin(segment.angle) * (1 - segment.lit) * 2, 0);
      });
      if (unlockedAt >= 0) {
        open = Math.min(1, (time - unlockedAt) / 1.6);
        group.rotation.z += dt * 0.15 * motionScale();
      }
      (core.material as THREE.MeshBasicMaterial).opacity = open * 0.32;
      (beam.material as THREE.MeshBasicMaterial).opacity = open * (0.45 + 0.15 * Math.sin(time * 6));
    }
  };
}
