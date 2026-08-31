import * as THREE from "three";
import { resolveWarpArrival } from "../src/game/MovementPatch";
import { endpointSafetyIssues } from "../src/world/endpointSafety";
import type { RoomSpec } from "../src/world/stages";

let checks = 0;

function assert(condition: unknown, message: string): asserts condition {
  checks += 1;
  if (!condition) throw new Error(`Endpoint regression failed: ${message}`);
}

const floor = { center: [0, 0, 0] as [number, number, number], size: [10, 1, 10] as [number, number, number] };

const embedded = new THREE.Vector3(0, 0.42, 0);
assert(resolveWarpArrival(embedded, 1.7, [floor]), "endpoint embedded in floor resolves as landing");
assert(Math.abs(embedded.y - 2.2) < 0.0001, "embedded endpoint is raised to standing eye height");

const trulyBelow = new THREE.Vector3(0, -3, 0);
assert(!resolveWarpArrival(trulyBelow, 1.7, [floor]), "endpoint genuinely below a floor remains airborne");

const wall = { center: [0, 2.5, 0] as [number, number, number], size: [1, 5, 10] as [number, number, number] };
const wallEndpoint = new THREE.Vector3(0, 2.5, 0);
assert(!resolveWarpArrival(wallEndpoint, 1.7, [wall]), "wall collision is never promoted into a floor landing");

const fixture: RoomSpec = {
  id: "endpoint-overlap-fixture",
  title: "FIXTURE",
  lesson: "Regression fixture",
  grammar: [],
  spawn: [0, 2.2, 4],
  goal: [0, 1.1, -4],
  requiredKills: 1,
  platforms: [floor],
  enemies: [{ id: "sunk", kind: "sentry", position: [0, 0.6, 0] }]
};
assert(
  endpointSafetyIssues(fixture).some((issue) => issue.code === "geometry.endpoint-platform-overlap"),
  "Content Doctor helper flags a sphere intersecting landing geometry"
);

console.info(`Traversal endpoint safety PASS // ${checks} checks`);
