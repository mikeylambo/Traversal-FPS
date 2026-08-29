import * as THREE from "three";

type WeaponState = {
  group: THREE.Group;
  fire(): void;
  update(dt: number, state: unknown): void;
};

type RuntimeState = {
  shots: number;
  fireReadyAt: number;
  weapon: WeaponState;
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

const FIRE_INTERVAL_MS = 285;

/** Makes every trigger pull feel intentional. The Warp Rifle is a spatial instrument,
 * not a bullet hose, so cadence, recoil, bass and haptics all reinforce commitment.
 */
export function installCombatFeel(game: object): void {
  const state = game as unknown as RuntimeState;
  let extraKick = 0;

  state.playShot = () => {
    state.toneSweep(150, 48, 0.13, "sine", 0.115);
    state.toneSweep(520, 165, 0.095, "sawtooth", 0.058, 0.004);
    state.toneSweep(1540, 640, 0.052, "triangle", 0.024, 0.008);
    state.noiseBurst(0.095, 0.065, 620, "lowpass");
    state.noiseBurst(0.042, 0.026, 2800, "highpass");
    rumbleGamepad();
  };

  const originalFire = state.weapon.fire.bind(state.weapon);
  state.weapon.fire = () => {
    extraKick = 1;
    originalFire();
  };

  const originalWeaponUpdate = state.weapon.update.bind(state.weapon);
  state.weapon.update = (dt: number, weaponState: unknown) => {
    originalWeaponUpdate(dt, weaponState);
    extraKick *= Math.pow(0.018, dt);
    const kick = extraKick;
    state.weapon.group.position.z += kick * 0.085;
    state.weapon.group.position.y -= kick * 0.022;
    state.weapon.group.rotation.x += kick * 0.04;
    state.weapon.group.rotation.z -= kick * 0.016;
  };

  const originalShoot = state.shoot.bind(game);
  state.shoot = () => {
    const before = state.shots;
    const now = performance.now();
    originalShoot();
    if (state.shots <= before) return;

    state.fireReadyAt = Math.max(state.fireReadyAt, now + FIRE_INTERVAL_MS);
    document.body.classList.remove("rifle-fired");
    void document.body.offsetWidth;
    document.body.classList.add("rifle-fired");
    window.setTimeout(() => document.body.classList.remove("rifle-fired"), 95);
  };
}

function rumbleGamepad(): void {
  try {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = [...pads].find((candidate) => candidate?.connected) as (Gamepad & {
      vibrationActuator?: {
        playEffect?: (type: string, params: Record<string, number>) => Promise<unknown>;
      };
    }) | undefined;
    void pad?.vibrationActuator?.playEffect?.("dual-rumble", {
      duration: 85,
      strongMagnitude: 0.62,
      weakMagnitude: 0.28,
      startDelay: 0
    });
  } catch {
    // Haptics are optional presentation and must never affect input/gameplay.
  }
}
