import * as THREE from "three";

type WeaponState = {
  group: THREE.Group;
  fire(): void;
  update(dt: number, state: unknown): void;
};

type WarpState = {
  commit(position: THREE.Vector3): boolean;
  updateTransit(dt: number, position: THREE.Vector3): boolean;
  isTransiting(): boolean;
};

type RuntimeState = {
  shots: number;
  fireReadyAt: number;
  weapon: WeaponState;
  warp: WarpState;
  shoot(): void;
  playShot(): void;
  toneSweep(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay?: number
  ): void;
  noiseBurst(duration: number, volume: number, frequency: number, type: BiquadFilterType): void;
};

const FIRE_INTERVAL_MS = 320;

/** Makes the rifle/warp loop feel like one physical spatial instrument rather
 * than a gun followed by an unrelated teleport effect.
 */
export function installCombatFeel(game: object): void {
  const state = game as unknown as RuntimeState;
  let extraKick = 0;

  state.playShot = () => {
    // Primary report: low body, electrical crack, then a restrained mechanical close.
    state.toneSweep(138, 44, 0.145, "sine", 0.125);
    state.toneSweep(510, 150, 0.105, "sawtooth", 0.062, 0.004);
    state.toneSweep(1680, 690, 0.055, "triangle", 0.027, 0.007);
    state.noiseBurst(0.105, 0.072, 560, "lowpass");
    state.noiseBurst(0.045, 0.028, 3000, "highpass");
    state.toneSweep(230, 120, 0.055, "triangle", 0.032, 0.105);
    state.toneSweep(820, 410, 0.035, "square", 0.012, 0.132);
    rumble(112, 0.72, 0.34);
  };

  const originalFire = state.weapon.fire.bind(state.weapon);
  state.weapon.fire = () => {
    extraKick = 1;
    originalFire();
  };

  const originalWeaponUpdate = state.weapon.update.bind(state.weapon);
  state.weapon.update = (dt: number, weaponState: unknown) => {
    originalWeaponUpdate(dt, weaponState);
    extraKick *= Math.pow(0.013, dt);
    const kick = extraKick;
    state.weapon.group.position.z += kick * 0.115;
    state.weapon.group.position.y -= kick * 0.032;
    state.weapon.group.position.x += kick * 0.012;
    state.weapon.group.rotation.x += kick * 0.056;
    state.weapon.group.rotation.z -= kick * 0.022;
  };

  const originalShoot = state.shoot.bind(game);
  state.shoot = () => {
    const before = state.shots;
    const now = performance.now();
    originalShoot();
    if (state.shots <= before) return;

    state.fireReadyAt = Math.max(state.fireReadyAt, now + FIRE_INTERVAL_MS);
    document.body.classList.remove("rifle-fired", "rifle-recovering");
    void document.body.offsetWidth;
    document.body.classList.add("rifle-fired", "rifle-recovering");
    window.setTimeout(() => document.body.classList.remove("rifle-fired"), 110);
    window.setTimeout(() => document.body.classList.remove("rifle-recovering"), FIRE_INTERVAL_MS);
  };

  const originalCommit = state.warp.commit.bind(state.warp);
  state.warp.commit = (position: THREE.Vector3) => {
    const committed = originalCommit(position);
    if (!committed) return false;
    rumble(150, 0.48, 0.72);
    document.body.classList.add("warp-committed");
    window.setTimeout(() => document.body.classList.remove("warp-committed"), 180);
    return true;
  };

  const originalTransit = state.warp.updateTransit.bind(state.warp);
  state.warp.updateTransit = (dt: number, position: THREE.Vector3) => {
    const wasTransiting = state.warp.isTransiting();
    const active = originalTransit(dt, position);
    if (wasTransiting && !state.warp.isTransiting()) {
      rumble(82, 0.58, 0.3);
      document.body.classList.add("warp-landed");
      window.setTimeout(() => document.body.classList.remove("warp-landed"), 140);
    }
    return active;
  };
}

function rumble(duration: number, strongMagnitude: number, weakMagnitude: number): void {
  try {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = Array.from(pads).find((candidate) => candidate?.connected) as (Gamepad & {
      vibrationActuator?: {
        playEffect?: (type: string, params: Record<string, number>) => Promise<unknown>;
      };
    }) | undefined;
    void pad?.vibrationActuator?.playEffect?.("dual-rumble", {
      duration,
      strongMagnitude,
      weakMagnitude,
      startDelay: 0
    });
  } catch {
    // Haptics are optional presentation and must never affect input/gameplay.
  }
}
