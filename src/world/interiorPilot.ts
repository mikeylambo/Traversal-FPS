import { crouchSentry, eye, floor, gated, ring, sentry, slabWithHole, solid } from "./authoring";
import type { RoomSpec } from "./stages";

/**
 * Interior pilot. The first fully enclosed space: a two-storey vault where the
 * ceiling is the puzzle. Warp lines that clip a slab are refused, so the only
 * way up is to stand under the shaft and write a vector that clears the slab's
 * edge. The upper storey hides its last Sphere behind a pillar, and the ground
 * floor keeps one Sphere you can only reach through a crawl tunnel.
 *
 *   Ground A (spawn) --crawl tunnel--> Ground B (under the shaft)
 *   Ground B --vector up through the shaft--> Upper storey --around the pillar--> Gravity Ring
 *
 * A second anchor above the shaft's far lip means a player who goes up early
 * can drop back down and climb again, at the cost of the Sphere they skipped.
 */

const TOP = 5.6;

export const INTERIOR_PILOT: RoomSpec = {
  id: "interior-vault",
  title: "VAULT",
  lesson: "The ceiling decides which vectors exist. Find the one that clears the slab.",
  grammar: ["origin-matters", "route-fork", "low-profile", "stop-short"],
  spawn: eye(0, 0, 4),
  goal: ring(7, TOP, -37),
  requiredKills: 3,
  platforms: [
    // Ground storey: hall A and the shaft chamber B.
    floor(0, 0, 0.5, 20, 13),
    floor(0, 0, -14, 8, 16),
    // Partition between A and B, pierced by a 3m crawl tunnel.
    solid(-10, -1.5, 0, 5, -9, -6),
    solid(1.5, 10, 0, 5, -9, -6),
    solid(-1.5, 1.5, 1.3, 5, -9, -6),
    // Baffle inside B: the tunnel mouth is a dogleg, so the shaft can't see into it.
    solid(-2, 2, 0, 2.2, -10.5, -10),
    // Chamber B walls.
    solid(-5, -4, 0, 5, -22, -9),
    solid(4, 5, 0, 5, -22, -9),
    solid(-5, 5, 0, 5, -23, -22),
    // Upper storey: a slab over everything, with the shaft cut through it.
    floor(0, TOP, 0.5, 20, 13, 0.6),
    ...slabWithHole(-10, 10, -41, -6, TOP, -2, 2, -20, -16, 0.6),
    // The pillar that hides the last Sphere from the shaft landing.
    solid(1, 6, TOP, 14, -32, -30),
    // Shell: outer walls and roof.
    solid(-11, -10, 0, 15, -41, 7),
    solid(10, 11, 0, 15, -41, 7),
    solid(-11, 11, 0, 15, 7, 8),
    solid(-11, 11, 0, 15, -42, -41),
    solid(-11, 11, 14, 15, -41, 7)
  ],
  enemies: [
    crouchSentry("vault-tunnel", 0, 0, -7.5),
    // Climb anchor: only a vector from the shaft's near edge clears the slab.
    // Both anchors accept shots from below only: they are ways up, not targets.
    gated(sentry("vault-climb", [0, 8.5, -21]), { axis: "y", max: 3 }),
    // Return anchor above the far lip; accepts shots from below only.
    gated(sentry("vault-return", [0, 9.5, -14]), { axis: "y", max: 3 }),
    sentry("vault-gallery", eye(4, TOP, -35))
  ]
};

export const INTERIOR_PILOT_ROOMS: RoomSpec[] = [INTERIOR_PILOT];
