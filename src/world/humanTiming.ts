import { withHoods } from "./authoring";
import type { EnemySpec, RoomSpec, Vec3Tuple } from "./stages";

/**
 * Human timing. The route solver proves a moving Sphere CAN line up; this asks
 * whether a person can catch it: how long one cycle takes (drifters move in
 * radians per second, orbits in laps per second) and how long, per cycle, a
 * warp to it would land on something rather than drop into the void.
 */
export interface MotionTiming {
  actor: string;
  period: number;
  /** Longest continuous stretch per cycle where a warp to it lands safely (0: never). */
  window: number;
  verdict: "OK" | "SLOW" | "TIGHT";
}

const SAMPLES = 720;
export const SLOW_PERIOD = 16;
export const TIGHT_WINDOW = 0.7;

function positionAt(enemy: EnemySpec, angle: number): Vec3Tuple {
  const p = [...enemy.position] as Vec3Tuple;
  if (enemy.drift) p[enemy.drift.axis === "x" ? 0 : 1] += Math.sin(angle) * enemy.drift.amplitude;
  if (enemy.orbit) {
    const o = enemy.orbit;
    const a = Math.cos(angle + (o.phase ?? 0)) * o.radiusA;
    const b = Math.sin(angle + (o.phase ?? 0)) * o.radiusB;
    if (o.plane === "xy") { p[0] += a; p[1] += b; }
    if (o.plane === "xz") { p[0] += a; p[2] += b; }
    if (o.plane === "yz") { p[1] += a; p[2] += b; }
  }
  return p;
}

/** A warp ending here arrives on, or drops onto, a floor within a survivable fall. */
function landable(room: RoomSpec, p: Vec3Tuple): boolean {
  return room.platforms.some((f) => {
    const top = f.center[1] + f.size[1] / 2;
    const dx = Math.abs(p[0] - f.center[0]) - f.size[0] / 2;
    const dz = Math.abs(p[2] - f.center[2]) - f.size[2] / 2;
    const reach = f.motion ? f.motion.amplitude : 0;
    const vertical = f.motion?.axis === "y" ? reach : 0;
    const lateral = f.motion && f.motion.axis !== "y" ? reach : 0;
    return dx <= 0.26 + lateral && dz <= 0.26 + lateral && top + 1.06 <= p[1] + 0.72 + vertical && top + vertical >= p[1] - 14;
  });
}

export function motionTimings(authored: RoomSpec): MotionTiming[] {
  const room = withHoods(authored);
  const out: MotionTiming[] = [];
  for (const enemy of room.enemies) {
    const period = enemy.drift ? (Math.PI * 2) / enemy.drift.speed : enemy.orbit ? 1 / enemy.orbit.speed : 0;
    if (!period) continue;
    const safe = Array.from({ length: SAMPLES }, (_, k) => landable(room, positionAt(enemy, (k / SAMPLES) * Math.PI * 2)));
    let best = 0;
    if (safe.every(Boolean)) best = SAMPLES;
    else {
      const start = safe.indexOf(false);
      let run = 0;
      for (let i = 1; i <= SAMPLES; i++) {
        if (safe[(start + i) % SAMPLES]) best = Math.max(best, ++run);
        else run = 0;
      }
    }
    const window = (best / SAMPLES) * period;
    const verdict = period > SLOW_PERIOD ? "SLOW" : window > 0 && window < TIGHT_WINDOW ? "TIGHT" : "OK";
    out.push({ actor: enemy.id, period: Math.round(period * 10) / 10, window: Math.round(window * 100) / 100, verdict });
  }
  return out;
}
