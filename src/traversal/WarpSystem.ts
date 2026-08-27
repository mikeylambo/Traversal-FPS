import * as THREE from "three";

export class WarpSystem {
  private anchor: { origin: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private fraction = 1;
  private transit: { from: THREE.Vector3; to: THREE.Vector3; elapsed: number; duration: number } | null = null;
  private readonly line: THREE.Line;
  private readonly marker: THREE.Mesh;
  private readonly trails = new THREE.Group();

  constructor(private readonly scene: THREE.Scene) {
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x78f7ff, transparent: true, opacity: 0.95 });
    this.line = new THREE.Line(lineGeometry, lineMaterial);
    this.line.visible = false;
    scene.add(this.line);

    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
    );
    this.marker.visible = false;
    scene.add(this.marker);
    scene.add(this.trails);
  }

  write(origin: THREE.Vector3, target: THREE.Vector3): void {
    this.anchor = { origin: origin.clone(), target: target.clone() };
    this.fraction = 1;
    this.refreshLiveVector();
  }

  updateSelection(isHeld: boolean, wheelDelta: number): void {
    if (!this.anchor) return;
    if (isHeld && wheelDelta !== 0) {
      this.fraction = THREE.MathUtils.clamp(this.fraction - wheelDelta * 0.08, 0.12, 1);
    }
    this.marker.visible = isHeld;
    if (isHeld) this.marker.position.copy(this.selectedPoint());
  }

  commit(currentPosition: THREE.Vector3): boolean {
    if (!this.anchor || this.transit) return false;
    const to = this.selectedPoint();
    const distance = currentPosition.distanceTo(to);
    this.transit = {
      from: currentPosition.clone(),
      to,
      elapsed: 0,
      duration: Math.max(0.055, distance / 70)
    };
    this.addTrail(this.anchor.origin, this.anchor.target);
    this.anchor = null;
    this.line.visible = false;
    this.marker.visible = false;
    return true;
  }

  updateTransit(dt: number, position: THREE.Vector3): boolean {
    if (!this.transit) return false;
    this.transit.elapsed += dt;
    const raw = THREE.MathUtils.clamp(this.transit.elapsed / this.transit.duration, 0, 1);
    const eased = raw * raw * (3 - 2 * raw);
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

  selectionPercent(): number {
    return Math.round(this.fraction * 100);
  }

  reset(): void {
    this.anchor = null;
    this.transit = null;
    this.fraction = 1;
    this.line.visible = false;
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
  }

  private addTrail(origin: THREE.Vector3, target: THREE.Vector3): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([origin, target]);
    const material = new THREE.LineBasicMaterial({ color: 0x78f7ff, transparent: true, opacity: 0.16 });
    this.trails.add(new THREE.Line(geometry, material));
  }
}
