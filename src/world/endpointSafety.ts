import type { ContentValidationIssue } from "./contentValidation";
import type { EnemySpec, RoomSpec, Vec3Tuple } from "./stages";

const DEFAULT_SPHERE_RADIUS = 0.72;
const SAMPLE_COUNT = 20;

/**
 * Advisory authoring check for sphere paths that enter floor/deck collision.
 * Runtime now recovers these arrivals safely, but authored content should still
 * make the endpoint legible instead of routinely relying on collision recovery.
 */
export function endpointSafetyIssues(room: RoomSpec): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];

  for (const enemy of room.enemies) {
    const samples = sampledPositions(enemy);
    const radius = enemy.radius ?? DEFAULT_SPHERE_RADIUS;

    for (let platformIndex = 0; platformIndex < room.platforms.length; platformIndex += 1) {
      const platform = room.platforms[platformIndex]!;
      const [cx, cy, cz] = platform.center;
      const [sx, sy, sz] = platform.size;

      // Match gameplay's floor/deck distinction; tall/thin slabs are occluders.
      if (sx < 1.5 || sz < 1.5 || sy > 2.5) continue;

      const bottom = cy - sy * 0.5;
      const top = cy + sy * 0.5;
      const overlap = samples.some(([x, y, z]) => {
        const horizontallyOver =
          Math.abs(x - cx) <= sx * 0.5 &&
          Math.abs(z - cz) <= sz * 0.5;
        if (!horizontallyOver) return false;
        return y - radius < top - 0.01 && y + radius > bottom + 0.01;
      });

      if (!overlap) continue;
      issues.push({
        severity: "warning",
        code: "geometry.endpoint-platform-overlap",
        roomId: room.id,
        entityId: enemy.id,
        message: `Sphere path intersects landing platform ${platformIndex + 1}; raise/re-route it unless the overlap is intentional.`
      });
      break;
    }
  }

  return issues;
}

function sampledPositions(enemy: EnemySpec): Vec3Tuple[] {
  const positions: Vec3Tuple[] = [[...enemy.position]];

  if (enemy.drift) {
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const angle = index / SAMPLE_COUNT * Math.PI * 2;
      const position: Vec3Tuple = [...enemy.position];
      position[enemy.drift.axis === "x" ? 0 : 1] += Math.sin(angle) * enemy.drift.amplitude;
      positions.push(position);
    }
  }

  if (enemy.orbit) {
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const angle = index / SAMPLE_COUNT * Math.PI * 2 + (enemy.orbit.phase ?? 0);
      const position: Vec3Tuple = [...enemy.position];
      position[0] += Math.cos(angle) * enemy.orbit.radius;
      if (enemy.orbit.plane === "xy") position[1] += Math.sin(angle) * enemy.orbit.radius;
      else position[2] += Math.sin(angle) * enemy.orbit.radius;
      positions.push(position);
    }
  }

  return positions;
}
