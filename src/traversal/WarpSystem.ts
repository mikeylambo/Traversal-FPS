import * as THREE from "three";

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
      this.fraction = THREE.MathUtils.clamp(this.fraction - wheelDelta * 0.08, 0.12, 1);
    }

    const lineMaterial = this.line.material as THREE.LineBasicMaterial;
    lineMaterial.opacity = isHeld ? 1 : 0.78;
    this.beam.material.opacity = isHeld ? 0.24 : 0.1;
    this.marker.visible = isHeld;

    if (isHeld) {
      const selected = this.selectedPoint();
      this.marker.position.copy(selected);
      const pulse = 1 + Math.sin(timeSeconds * 11) * 0.12;
      this.marker.scale.setScalar(pulse);
      this.markerRing.rotation.z = timeSeconds * 1.8;
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
    this.anchor = null;
    this.line.visible = false;
    this.beam.visible = false;
    this.marker.visible = false;
    return true;
  }

  updateTransit(dt: number, position: THREE.Vector3): boolean {
    if (!this.transit) return false;
    this.transit.elapsed += dt;
    const raw = THREE.MathUtils.clamp(this.transit.elapsed / this.transit.duration, 0, 1);
    const eased = raw < 0.5
      ? 4 * raw * raw * raw
      : 1 - Math.pow(-2 * raw + 2, 3) / 2;
    position.lerpVectors(this.transit.from, this.transit.to, eased);
    if (raw >= 1) this.transit = null;
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

  private positionBeam(mesh: THREE.Mesh, origin: THREE.Vector3, target: THREE.Vector3): void {
    const direction = target.clone().sub(origin);
    const distance = direction.length();
    if (distance <= 0.001) return;
    mesh.position.copy(origin).add(target).multiplyScalar(0.5);
    mesh.scale.set(1, distance, 1);
    mesh.quaternion.setFromUnitVectors(this.up, direction.normalize());
  }
}
