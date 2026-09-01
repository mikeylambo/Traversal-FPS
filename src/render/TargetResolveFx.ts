import * as THREE from "three";
import type { EnemySpec } from "../world/stages";

type ActiveFx = {
  root: THREE.Group;
  born: number;
  duration: number;
  update: (age: number, dt: number) => void;
};

const colorFor = (kind: EnemySpec["kind"]): number =>
  kind === "shield" ? 0xffa45e : kind === "orbit" ? 0x7dffd2 : kind === "drifter" ? 0xff72c5 : 0x78f7ff;

export class TargetResolveFx {
  private readonly active: ActiveFx[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  resolve(position: THREE.Vector3, kind: EnemySpec["kind"]): void {
    const color = colorFor(kind);
    const root = new THREE.Group();
    root.position.copy(position);

    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), coreMat);
    root.add(core);

    const ringMats: THREE.MeshBasicMaterial[] = [];
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i += 1) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52 + i * 0.2, 0.018, 6, 48), mat);
      ring.rotation.set(i === 0 ? Math.PI / 2 : 0.4 * i, i === 1 ? Math.PI / 2 : 0.2 * i, i * 0.35);
      ringMats.push(mat);
      rings.push(ring);
      root.add(ring);
    }

    const axisMats: THREE.LineBasicMaterial[] = [];
    const axes: THREE.Line[] = [];
    const pairs = [
      [new THREE.Vector3(-1.05, 0, 0), new THREE.Vector3(1.05, 0, 0)],
      [new THREE.Vector3(0, -1.05, 0), new THREE.Vector3(0, 1.05, 0)],
      [new THREE.Vector3(0, 0, -1.05), new THREE.Vector3(0, 0, 1.05)]
    ];
    for (const pair of pairs) {
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
      const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pair), mat);
      axisMats.push(mat);
      axes.push(axis);
      root.add(axis);
    }

    const shards: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; velocity: THREE.Vector3 }> = [];
    for (let i = 0; i < 10; i += 1) {
      const a = i / 10 * Math.PI * 2;
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, wireframe: i % 3 === 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.08, 0), mat);
      root.add(mesh);
      shards.push({ mesh, mat, velocity: new THREE.Vector3(Math.cos(a), ((i % 5) - 2) * 0.18, Math.sin(a)).normalize().multiplyScalar(1.5 + (i % 3) * 0.3) });
    }

    this.scene.add(root);
    this.active.push({
      root,
      born: performance.now(),
      duration: 620,
      update: (age, dt) => {
        const lock = THREE.MathUtils.smoothstep(age, 0.16, 0.46);
        core.scale.setScalar(THREE.MathUtils.lerp(1.7, 0.38, Math.min(1, age / 0.34)));
        core.rotation.x += dt * 5;
        core.rotation.y += dt * 7;
        coreMat.opacity = age < 0.65 ? 1 : (1 - age) / 0.35;
        rings.forEach((ring, index) => {
          ring.rotation.z += dt * (2.4 + index * 0.7) * (index % 2 ? -1 : 1);
          ring.scale.setScalar(THREE.MathUtils.lerp(1.45, 0.8 + index * 0.08, lock));
          ringMats[index]!.opacity = (0.3 + lock * 0.6) * Math.max(0, 1 - Math.max(0, age - 0.72) / 0.28);
        });
        axes.forEach((axis, index) => {
          axis.scale.setScalar(0.3 + lock * 0.8);
          axisMats[index]!.opacity = lock * 0.7 * Math.max(0, 1 - Math.max(0, age - 0.78) / 0.22);
        });
        shards.forEach((shard) => {
          shard.mesh.position.addScaledVector(shard.velocity, dt);
          shard.mesh.rotation.x += dt * 2.8;
          shard.mesh.rotation.y += dt * 4.2;
          shard.mat.opacity = (1 - age) * 0.8;
        });
      }
    });
  }

  write(origin: THREE.Vector3, target: THREE.Vector3): void {
    const root = new THREE.Group();
    const pointCount = 48;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < pointCount; i += 1) points.push(origin.clone().lerp(target, i / (pointCount - 1)));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setDrawRange(0, 2);
    const mat = new THREE.LineBasicMaterial({ color: 0xf0ffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geometry, mat);
    root.add(line);

    const markerMat = new THREE.MeshBasicMaterial({ color: 0xbffcff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.19, 36), markerMat);
    marker.position.copy(target);
    marker.lookAt(origin);
    root.add(marker);

    this.scene.add(root);
    this.active.push({
      root,
      born: performance.now(),
      duration: 720,
      update: (age, dt) => {
        const draw = THREE.MathUtils.smoothstep(age, 0, 0.3);
        geometry.setDrawRange(0, Math.max(2, Math.floor(pointCount * draw)));
        const fade = age < 0.44 ? 1 : Math.max(0, 1 - (age - 0.44) / 0.56);
        mat.opacity = fade;
        markerMat.opacity = fade * 0.95;
        marker.scale.setScalar(1 + draw * 0.5 + Math.sin(age * Math.PI * 8) * 0.12 * (1 - age));
        marker.rotation.z += dt * 5;
      }
    });
  }

  update(dt: number): void {
    const now = performance.now();
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const fx = this.active[i]!;
      const age = Math.min(1, (now - fx.born) / fx.duration);
      fx.update(age, dt);
      if (age < 1) continue;
      this.dispose(fx.root);
      this.active.splice(i, 1);
    }
  }

  clear(): void {
    for (const fx of this.active) this.dispose(fx.root);
    this.active.length = 0;
  }

  private dispose(root: THREE.Group): void {
    this.scene.remove(root);
    root.traverse((object) => {
      const drawable = object as THREE.Mesh | THREE.Line;
      drawable.geometry?.dispose?.();
      const material = drawable.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose?.();
    });
  }
}
