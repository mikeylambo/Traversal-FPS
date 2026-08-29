import * as THREE from "three";

type EndpointFx = {
  root: THREE.Group;
  materials: Array<THREE.MeshBasicMaterial | THREE.LineBasicMaterial>;
  light: THREE.PointLight;
  age: number;
  duration: number;
  arrival: boolean;
};

export class WarpSystem {
  private anchor: { origin: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private fraction = 1;
  private transit: { from: THREE.Vector3; to: THREE.Vector3; elapsed: number; duration: number } | null = null;
  private readonly line: THREE.Line;
  private readonly beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private readonly marker = new THREE.Group();
  private readonly markerCore: THREE.Mesh;
  private readonly markerRing: THREE.Mesh;
  private readonly trails = new THREE.Group();
  private readonly endpointFx: EndpointFx[] = [];
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(private readonly scene: THREE.Scene) {
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xbffcff, transparent: true, opacity: 0.96 });
    this.line = new THREE.Line(lineGeometry, lineMaterial);
    this.line.visible = false;
    scene.add(this.line);

    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 1, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x36e8ff,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.beam.visible = false;
    scene.add(this.beam);

    this.markerCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    this.markerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.035, 8, 36),
      new THREE.MeshBasicMaterial({
        color: 0x78f7ff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.marker.add(this.markerCore, this.markerRing);
    this.marker.visible = false;
    scene.add(this.marker, this.trails);
  }

  write(origin: THREE.Vector3, target: THREE.Vector3): void {
    this.anchor = { origin: origin.clone(), target: target.clone() };
    this.fraction = 1;
    this.refreshLiveVector();
  }

  setSelectionFraction(fraction: number): void {
    if (!this.anchor) return;
    this.fraction = THREE.MathUtils.clamp(fraction, 0.12, 1);
  }

  updateSelection(isHeld: boolean, wheelDelta: number, timeSeconds = 0): void {
    if (!this.anchor) return;
    if (isHeld && wheelDelta !== 0) {
      // Fine enough for puzzle placement, coarse enough that a shoulder tap is meaningful.
      this.fraction = THREE.MathUtils.clamp(this.fraction - wheelDelta * 0.04, 0.12, 1);
    }

    const selected = this.selectedPoint();
    const lineMaterial = this.line.material as THREE.LineBasicMaterial;
    lineMaterial.opacity = isHeld ? 0.42 : 0.78;
    this.beam.material.opacity = isHeld ? 0.36 : 0.1;

    // The thin line always preserves the full written vector. While placing a
    // landing, the brighter beam terminates at the selected point. The player can
    // therefore read both the original endpoint and the route they are actually buying.
    this.positionBeam(
      this.beam,
      this.anchor.origin,
      isHeld ? selected : this.anchor.target
    );

    this.marker.visible = isHeld;
    if (isHeld) {
      this.marker.position.copy(selected);
      const pulse = 1 + Math.sin(timeSeconds * 11) * 0.1;
      const shortScale = this.fraction < 0.995 ? 1.16 : 1;
      this.marker.scale.setScalar(pulse * shortScale);
      this.markerRing.rotation.z = timeSeconds * 1.8;

      const ringMaterial = this.markerRing.material as THREE.MeshBasicMaterial;
      ringMaterial.color.setHex(this.fraction < 0.995 ? 0xffffff : 0x78f7ff);
      ringMaterial.opacity = this.fraction < 0.995 ? 1 : 0.9;
    }
  }

  commit(currentPosition: THREE.Vector3): boolean {
    if (!this.anchor || this.transit) return false;
    const to = this.selectedPoint();
    const distance = currentPosition.distanceTo(to);
    this.transit = {
      from: currentPosition.clone(),
      to,
      elapsed: 0,
      duration: Math.max(0.075, distance / 82)
    };
    this.addTrail(this.anchor.origin, this.anchor.target);
    this.addEndpointBurst(currentPosition, false, to.clone().sub(currentPosition));
    this.addDestinationLock(to, to.clone().sub(currentPosition));
    this.anchor = null;
    this.line.visible = false;
    this.beam.visible = false;
    this.marker.visible = false;
    return true;
  }

  updateTransit(dt: number, position: THREE.Vector3): boolean {
    this.updateEndpointFx(dt);
    if (!this.transit) return false;
    this.transit.elapsed += dt;
    const raw = THREE.MathUtils.clamp(this.transit.elapsed / this.transit.duration, 0, 1);
    const eased = raw < 0.5
      ? 4 * raw * raw * raw
      : 1 - Math.pow(-2 * raw + 2, 3) / 2;
    position.lerpVectors(this.transit.from, this.transit.to, eased);
    if (raw >= 1) {
      const direction = this.transit.to.clone().sub(this.transit.from);
      this.addEndpointBurst(this.transit.to, true, direction);
      this.transit = null;
    }
    return true;
  }

  hasAnchor(): boolean {
    return this.anchor !== null;
  }

  isTransiting(): boolean {
    return this.transit !== null;
  }

  transitProgress(): number {
    if (!this.transit) return 0;
    return THREE.MathUtils.clamp(this.transit.elapsed / this.transit.duration, 0, 1);
  }

  selectionPercent(): number {
    return Math.round(this.fraction * 100);
  }

  reset(): void {
    this.anchor = null;
    this.transit = null;
    this.fraction = 1;
    this.line.visible = false;
    this.beam.visible = false;
    this.marker.visible = false;
    this.trails.clear();
    for (const effect of this.endpointFx) this.disposeEndpointFx(effect);
    this.endpointFx.length = 0;
  }

  private selectedPoint(): THREE.Vector3 {
    if (!this.anchor) return new THREE.Vector3();
    return this.anchor.origin.clone().lerp(this.anchor.target, this.fraction);
  }

  private refreshLiveVector(): void {
    if (!this.anchor) return;
    this.line.geometry.dispose();
    this.line.geometry = new THREE.BufferGeometry().setFromPoints([this.anchor.origin, this.anchor.target]);
    this.line.visible = true;
    this.positionBeam(this.beam, this.anchor.origin, this.anchor.target);
    this.beam.visible = true;
  }

  private addTrail(origin: THREE.Vector3, target: THREE.Vector3): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([origin, target]);
    const material = new THREE.LineBasicMaterial({ color: 0x78f7ff, transparent: true, opacity: 0.22 });
    this.trails.add(new THREE.Line(geometry, material));
  }

  private addDestinationLock(position: THREE.Vector3, direction: THREE.Vector3): void {
    const root = new THREE.Group();
    root.position.copy(position);
    const materials: Array<THREE.MeshBasicMaterial | THREE.LineBasicMaterial> = [];

    const lockMaterial = new THREE.LineBasicMaterial({
      color: 0x9cf9ff,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    materials.push(lockMaterial);

    const vertices: number[] = [];
    const s = 0.72;
    const gap = 0.2;
    const segments = [
      [-s, -s, 0, -gap, -s, 0], [gap, -s, 0, s, -s, 0],
      [-s, s, 0, -gap, s, 0], [gap, s, 0, s, s, 0],
      [-s, -s, 0, -s, -gap, 0], [-s, gap, 0, -s, s, 0],
      [s, -s, 0, s, -gap, 0], [s, gap, 0, s, s, 0]
    ];
    for (const segment of segments) vertices.push(...segment);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    const corners = new THREE.LineSegments(geometry, lockMaterial);
    root.add(corners);

    const forward = direction.lengthSq() > 0.001 ? direction.clone().normalize() : new THREE.Vector3(0, 0, -1);
    root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
    this.scene.add(root);

    const light = new THREE.PointLight(0x73efff, 2.4, 5, 2);
    light.position.copy(position);
    this.scene.add(light);
    this.endpointFx.push({ root, materials, light, age: 0, duration: 0.24, arrival: false });
  }

  private addEndpointBurst(position: THREE.Vector3, arrival: boolean, direction: THREE.Vector3): void {
    const root = new THREE.Group();
    root.position.copy(position);
    const materials: Array<THREE.MeshBasicMaterial | THREE.LineBasicMaterial> = [];
    const color = arrival ? 0xd8ffff : 0x79efff;

    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    materials.push(coreMaterial);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(arrival ? 0.38 : 0.28, 0), coreMaterial);
    root.add(core);

    const shellMaterial = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    materials.push(shellMaterial);
    const shell = new THREE.Mesh(new THREE.OctahedronGeometry(arrival ? 0.9 : 0.72, 0), shellMaterial);
    shell.rotation.set(0.35, 0.65, 0.2);
    root.add(shell);

    const spikeMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    materials.push(spikeMaterial);
    const spikeVertices: number[] = [];
    const directions = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
      [0.7, 0.7, 0], [-0.7, 0.7, 0], [0.7, -0.7, 0], [-0.7, -0.7, 0]
    ];
    const length = arrival ? 1.85 : 1.3;
    for (const [x, y, z] of directions) spikeVertices.push(0, 0, 0, x * length, y * length, z * length);
    const spikeGeometry = new THREE.BufferGeometry();
    spikeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(spikeVertices, 3));
    root.add(new THREE.LineSegments(spikeGeometry, spikeMaterial));

    const forward = direction.lengthSq() > 0.001 ? direction.clone().normalize() : new THREE.Vector3(0, 0, -1);
    root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
    this.scene.add(root);

    const light = new THREE.PointLight(color, arrival ? 8 : 5, arrival ? 10 : 7, 2);
    light.position.copy(position);
    this.scene.add(light);
    this.endpointFx.push({
      root,
      materials,
      light,
      age: 0,
      duration: arrival ? 0.42 : 0.28,
      arrival
    });
  }

  private updateEndpointFx(dt: number): void {
    for (let index = this.endpointFx.length - 1; index >= 0; index -= 1) {
      const effect = this.endpointFx[index]!;
      effect.age += dt;
      const t = THREE.MathUtils.clamp(effect.age / effect.duration, 0, 1);
      const fade = 1 - t;
      const scale = effect.arrival ? 0.75 + t * 1.9 : 0.8 + t * 1.35;
      effect.root.scale.setScalar(scale);
      effect.root.rotation.z += dt * (effect.arrival ? 5.5 : -4.2);
      for (const material of effect.materials) material.opacity = Math.max(0, fade * fade);
      effect.light.intensity *= Math.pow(0.025, dt / Math.max(0.01, effect.duration));
      if (t < 1) continue;
      this.disposeEndpointFx(effect);
      this.endpointFx.splice(index, 1);
    }
  }

  private disposeEndpointFx(effect: EndpointFx): void {
    effect.root.traverse((object) => {
      const drawable = object as THREE.Mesh | THREE.LineSegments;
      drawable.geometry?.dispose?.();
    });
    for (const material of effect.materials) material.dispose();
    this.scene.remove(effect.root, effect.light);
  }

  private positionBeam(mesh: THREE.Mesh, origin: THREE.Vector3, target: THREE.Vector3): void {
    const direction = target.clone().sub(origin);
    const distance = direction.length();
    if (distance <= 0.001) return;
    mesh.position.copy(origin).add(target).multiplyScalar(0.5);
    mesh.scale.set(1, distance, 1);
    mesh.quaternion.setFromUnitVectors(this.up, direction.normalize());
  }
}
