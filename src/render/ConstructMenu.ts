import * as THREE from "three";

/**
 * The evolving menu: the Construct itself, drawn beside the menu panel. Four
 * stacked tiers, one per act, each a ring of its sectors. Cleared sectors burn,
 * the next one pulses, an act's spine lights when the act is done. After the
 * campaign, the Construct turns over and reveals The Reverse hidden beneath it.
 *
 * Renders only while a menu is up, on its own small canvas; pointer-transparent.
 */
export interface ConstructProgress {
  /** Cleared campaign sectors, by number (1-42). */
  cleared: ReadonlySet<number>;
  campaignComplete: boolean;
  reverseComplete: boolean;
}

const ACTS = [
  { first: 1, last: 8, color: 0x70efff },
  { first: 9, last: 18, color: 0x5ff2e0 },
  { first: 19, last: 30, color: 0xc77dff },
  { first: 31, last: 42, color: 0xffb38a }
] as const;
const REVERSE_COLOR = 0xff4d6d;

export function installConstructMenu(uiRoot: HTMLElement, progress: () => ConstructProgress): void {
  const canvas = document.createElement("canvas");
  canvas.id = "construct-menu";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const style = document.createElement("style");
  style.textContent = `
    #construct-menu { position: fixed; right: 0; top: 0; width: 62vw; height: 100vh; pointer-events: none; z-index: 5; opacity: 0; transition: opacity .5s ease; }
    body.construct-menu-on #construct-menu { opacity: 1; }
    body.construct-menu-on #ui .slu-screen::after { opacity: 0 !important; }
    @media (max-width: 900px) { #construct-menu { display: none; } }
  `;
  document.head.appendChild(style);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  camera.position.set(0, 4, 34);
  camera.lookAt(0, 1.5, 0);

  const construct = new THREE.Group();
  scene.add(construct);
  const nodes = new Map<number, THREE.Mesh>();
  const spines: THREE.Line[] = [];
  const reverseNodes: THREE.Mesh[] = [];
  const nodeGeometry = new THREE.OctahedronGeometry(0.32, 0);
  const material = (color: number, opacity: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const lineMaterial = (color: number, opacity: number) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

  ACTS.forEach((act, tier) => {
    const count = act.last - act.first + 1;
    const y = -4.5 + tier * 3.4;
    const radius = 7.5 - tier * 1.15;
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 97 }, (_, k) => new THREE.Vector3(Math.cos((k / 96) * Math.PI * 2) * radius, y, Math.sin((k / 96) * Math.PI * 2) * radius))
    ), lineMaterial(act.color, 0.22));
    construct.add(ring);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const node = new THREE.Mesh(nodeGeometry, material(act.color, 0.25));
      node.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
      construct.add(node);
      nodes.set(act.first + i, node);
    }
    // Spine to the tier above: lights when this act is done.
    if (tier < ACTS.length - 1) {
      const upper = -4.5 + (tier + 1) * 3.4;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const nextRadius = 7.5 - (tier + 1) * 1.15;
        const spine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius),
          new THREE.Vector3(Math.cos(a) * nextRadius, upper, Math.sin(a) * nextRadius)
        ]), lineMaterial(act.color, 0.12));
        spine.userData.tier = tier;
        construct.add(spine);
        spines.push(spine);
      }
    }
  });
  // Crown above the last tier: the destination of the whole campaign.
  const crown = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.05, 8, 48), material(0xfff1c9, 0.15));
  crown.position.y = -4.5 + 4 * 3.4 + 0.6;
  crown.rotation.x = Math.PI / 2;
  construct.add(crown);

  // The Reverse: an inverted tier hung beneath, unseen until the campaign ends.
  const reverse = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const node = new THREE.Mesh(nodeGeometry, material(REVERSE_COLOR, 0));
    node.scale.setScalar(1.5);
    node.position.set(Math.cos(a) * 5.5, -9.5, Math.sin(a) * 5.5);
    reverse.add(node);
    reverseNodes.push(node);
  }
  const reverseRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 97 }, (_, k) => new THREE.Vector3(Math.cos((k / 96) * Math.PI * 2) * 5.5, -9.5, Math.sin((k / 96) * Math.PI * 2) * 5.5))
  ), lineMaterial(REVERSE_COLOR, 0));
  reverse.add(reverseRing);
  construct.add(reverse);

  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);

  let active = false;
  let flip = 0;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const sync = () => {
    const screen = uiRoot.querySelector<HTMLElement>(".slu-screen");
    const id = screen?.dataset.screenId ?? "";
    const show = Boolean(screen) && !document.body.classList.contains("playing") && !["gameplay-placeholder", "settings", "controls", "accessibility", "audio", "display"].includes(id);
    if (show === active) return;
    active = show;
    document.body.classList.toggle("construct-menu-on", show);
    if (show) { resize(); renderer.setAnimationLoop(render); } else renderer.setAnimationLoop(null);
  };
  new MutationObserver(sync).observe(uiRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-screen-id"] });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  sync();

  const clock = new THREE.Clock();
  function render(): void {
    const dt = Math.min(0.05, clock.getDelta());
    const time = clock.elapsedTime;
    const state = progress();
    const nextSector = [...Array(42).keys()].map((i) => i + 1).find((n) => !state.cleared.has(n));
    for (const [sector, node] of nodes) {
      const lit = state.cleared.has(sector);
      const next = sector === nextSector;
      const m = node.material as THREE.MeshBasicMaterial;
      m.opacity = lit ? 0.95 : next ? 0.45 + 0.4 * Math.sin(time * 3) : 0.16;
      node.scale.setScalar(lit ? 1.15 : next ? 1.3 : 0.85);
      node.rotation.y = time * (lit ? 0.8 : 0.3);
    }
    for (const spine of spines) {
      const act = ACTS[spine.userData.tier as number]!;
      let done = true;
      for (let n = act.first; n <= act.last; n++) if (!state.cleared.has(n)) done = false;
      (spine.material as THREE.LineBasicMaterial).opacity = done ? 0.75 : 0.1;
    }
    (crown.material as THREE.MeshBasicMaterial).opacity = state.campaignComplete ? 0.6 : 0.12;
    // After the campaign the Construct turns over to show what was beneath it.
    flip = THREE.MathUtils.lerp(flip, state.campaignComplete ? 1 : 0, Math.min(1, dt * 0.6));
    const reveal = Math.max(0, flip - 0.3) / 0.7;
    reverseNodes.forEach((node, i) => {
      (node.material as THREE.MeshBasicMaterial).opacity = reveal * (state.reverseComplete ? 0.95 : 0.45 + 0.25 * Math.sin(time * 2 + i));
      node.rotation.y = -time * 0.6;
    });
    (reverseRing.material as THREE.LineBasicMaterial).opacity = reveal * 0.45;
    // Tip the Construct toward the viewer and lift it, so The Reverse beneath swings into view.
    construct.rotation.x = flip * Math.PI * 0.16;
    construct.position.y = flip * 0.5;
    camera.position.set(0, 4 - flip * 3, 34 + flip * 9);
    camera.lookAt(0, 1.5 - flip * 0.5, 0);
    construct.rotation.y += dt * (reduceMotion.matches ? 0.02 : 0.09);
    renderer.render(scene, camera);
  }
}
