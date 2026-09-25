import { TraversalBindingsStore } from "../src/input/TraversalBindings";
import { TraversalProgression } from "../src/game/Progression";
import { CAMPAIGN_MAPS } from "../src/world/campaign";
import { registerCampaign02 } from "../src/world/registerCampaign02";
import { registerCampaign03 } from "../src/world/registerCampaign03";
import { registerCampaign04 } from "../src/world/registerCampaign04";
import { evaluateActorOrigin } from "../src/world/spatialActors";
import { ROOMS, type RoomSpec } from "../src/world/stages";
import { validateRoom, validateRoomCatalog } from "../src/world/contentValidation";
import { solveRoom } from "../src/world/routeSolver";
import { describeLayout, layoutSimilarity } from "../src/world/layoutAudit";
import * as THREE from "three";
import { movementCollisionForTests as movement } from "../src/game/MovementPatch";
import { floor, solid } from "../src/world/authoring";
import { buildChallengeSuite, buildTimeTrialSuite } from "../src/world/modeSuites";

let checks = 0;

function assert(condition: unknown, message: string): asserts condition {
  checks += 1;
  if (!condition) throw new Error(`Regression failed: ${message}`);
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert(Object.is(actual, expected), `${message} // expected ${String(expected)}, got ${String(actual)}`);
}

function deepEqual(actual: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message} // expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

class AsyncMemoryStorage {
  readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T | undefined) ?? null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, structuredClone(value));
  }
}

async function run(): Promise<void> {
  testBindings();
  await testProgression();
  testSpatialActors();
  testContentValidation();
  testRouteSolverAndSuites();
  testMovementCollision();
  console.info(`Traversal regression suite PASS // ${checks} checks`);
}

function testBindings(): void {
  const memory = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { value: memory, configurable: true });

  const store = new TraversalBindingsStore();
  deepEqual(store.resolve("move").keyboardMouse.moveKeys, {
    forward: "KeyW",
    backward: "KeyS",
    left: "KeyA",
    right: "KeyD"
  }, "default WASD movement resolves");
  deepEqual(store.resolve("fire").keyboardMouse.mouseButtons, [0], "default fire remains LMB");
  equal(store.resolve("fire").gamepad.triggerButton, 7, "default controller fire remains RT");
  deepEqual(store.resolve("rewind").keyboardMouse.keys, ["KeyZ"], "rewind defaults to Z on keyboard");
  deepEqual(store.resolve("rewind").gamepad.buttons, [3], "rewind defaults to Y on standard gamepad");

  assert(store.setKeyboardMouse("fire", { keys: ["KeyF"] }), "fire keyboard override is accepted");
  deepEqual(store.resolve("fire").keyboardMouse.keys, ["KeyF"], "custom fire key resolves");
  equal(store.resolve("fire").keyboardMouse.mouseButtons, undefined, "custom device binding replaces rather than adds to LMB");
  assert(memory.getItem("traversal-fps:bindings:v1") !== null, "binding override persists");

  const reloaded = new TraversalBindingsStore();
  deepEqual(reloaded.resolve("fire").keyboardMouse.keys, ["KeyF"], "binding override reloads from storage");
  reloaded.resetAction("fire", "keyboardMouse");
  deepEqual(reloaded.resolve("fire").keyboardMouse.mouseButtons, [0], "per-device reset restores canonical fire default");

  memory.setItem("traversal-fps:bindings:v1", JSON.stringify({
    version: 1,
    overrides: {
      fire: {
        keyboardMouse: {
          keys: ["", "KeyG"],
          mouseButtons: [99, 0]
        }
      }
    }
  }));
  const sanitized = new TraversalBindingsStore();
  deepEqual(sanitized.resolve("fire").keyboardMouse.keys, ["KeyG"], "stored key data is sanitized");
  deepEqual(sanitized.resolve("fire").keyboardMouse.mouseButtons, [0], "stored mouse buttons are range-sanitized");
  sanitized.resetAll();
  assert(!sanitized.hasOverrides(), "reset all clears the custom profile");
}

async function testProgression(): Promise<void> {
  const storage = new AsyncMemoryStorage();
  storage.values.set("traversal-progression:v1", {
    achievements: ["first-vector"],
    completedMaps: ["map-01"],
    bestTimes: { "map-01:standard": 42.5 },
    runsCompleted: 3
  });

  const progression = new TraversalProgression(storage);
  await progression.load();
  const migrated = progression.snapshot();
  equal(migrated.schemaVersion, 2, "legacy progression migrates to schema v2");
  assert(migrated.achievements.includes("first-vector"), "legacy achievements survive migration");
  assert(migrated.campaign.discoveredSectors.includes("map-01"), "completed legacy sector becomes discovered");
  equal(migrated.sectors["map-01"]?.completed, true, "legacy completed map becomes completed sector progress");
  assert(storage.values.has("traversal-progression:v2"), "migration persists the v2 payload");

  await progression.startCampaign("map-01");
  assert(progression.hasCampaignContinue(), "new campaign creates Continue state");
  equal(progression.campaignCheckpoint()?.sectorId, "map-01", "new campaign checkpoint targets sector 01");

  await progression.completeCampaignSector("map-01", "map-02");
  equal(progression.campaignCheckpoint()?.sectorId, "map-02", "sector handoff advances persisted checkpoint");
  assert(progression.discoveredSectors().includes("map-02"), "sector handoff discovers the next sector");

  await progression.completeCampaignContentBoundary("map-02");
  assert(!progression.hasCampaignContinue(), "current-build boundary clears stale Continue state");
  equal(progression.snapshot().campaign.completed, false, "current-build boundary does not claim full campaign completion");
  equal(progression.snapshot().sectors["map-02"]?.completed, true, "boundary still records the sector clear");

  await progression.startCampaign("map-02");
  await progression.completeCampaignSector("map-02");
  assert(!progression.hasCampaignContinue(), "true final sector completion clears Continue state");
  equal(progression.snapshot().campaign.completed, true, "true campaign completion persists");
}

function testSpatialActors(): void {
  registerCampaign04();
  const rejected = evaluateActorOrigin("shield", undefined, [0, 2.2, 0]);
  const accepted = evaluateActorOrigin("shield", undefined, [3, 2.2, 0]);
  equal(rejected.allowed, false, "shield default origin gate preserves current left-side rejection");
  equal(accepted.allowed, true, "shield default origin gate preserves current valid right-side shot");

  const authored = evaluateActorOrigin("sentry", { axis: "z", max: -5 }, [0, 2.2, -8]);
  const authoredRejected = evaluateActorOrigin("sentry", { axis: "z", max: -5 }, [0, 2.2, 0]);
  equal(authored.allowed, true, "origin constraints can be authored on non-shield actors");
  equal(authoredRejected.allowed, false, "authored generic origin constraint rejects invalid origin");

  const orbitMap = CAMPAIGN_MAPS.find((map) => map.id === "map-04");
  assert(orbitMap?.implemented, "Crosscurrent is registered as playable content");
  assert(
    orbitMap.campaignRooms.some((room) => room.enemies.some((enemy) => enemy.kind === "orbit")),
    "Crosscurrent campaign field uses the Orbit actor"
  );
}

function testContentValidation(): void {
  registerCampaign02();
  registerCampaign03();
  registerCampaign04();

  const issues = [
    ...validateRoomCatalog("training", ROOMS),
    ...CAMPAIGN_MAPS.flatMap((map) => [
      ...validateRoomCatalog(`${map.id}:campaign`, map.campaignRooms),
      ...validateRoomCatalog(`${map.id}:course`, map.courseRooms)
    ])
  ];
  equal(issues.filter((issue) => issue.severity === "error").length, 0, "current authored catalog has zero structural validation errors");

  const invalidActorRoom: RoomSpec = {
    id: "regression-invalid-origin",
    title: "INVALID",
    lesson: "Test fixture",
    grammar: [],
    spawn: [0, 2.2, 0],
    goal: [0, 1.1, -5],
    requiredKills: 1,
    platforms: [{ center: [0, 0, 0], size: [10, 1, 10] }],
    enemies: [{
      id: "bad-origin",
      kind: "sentry",
      position: [0, 2.2, -5],
      originConstraint: { axis: "x", min: 4, max: 2 }
    }]
  };
  const report = validateRoom(invalidActorRoom);
  assert(report.issues.some((issue) => issue.code === "enemy.origin.order"), "Content Doctor rejects inverted actor origin ranges");
}

function testRouteSolverAndSuites(): void {
  const base: RoomSpec = {
    id: "regression-solver",
    title: "SOLVER",
    lesson: "Test fixture",
    grammar: [],
    spawn: [0, 2.2, 0],
    goal: [0, 1.1, -24],
    requiredKills: 1,
    platforms: [{ center: [0, 0, 0], size: [8, 1, 8] }, { center: [0, 0, -24], size: [8, 1, 8] }],
    enemies: [{ id: "anchor", kind: "sentry", position: [0, 2.2, -22] }]
  };
  equal(solveRoom(base).solved, true, "solver clears a one-vector room");

  const walled: RoomSpec = { ...base, platforms: [...base.platforms, { center: [0, 5, -12], size: [20, 10, 1.5] }] };
  equal(solveRoom(walled).solved, false, "solver respects solid walls for sight and warp");

  // A spawn buried in geometry (the original Sector 33 defect) is a hard error.
  const buried: RoomSpec = { ...base, platforms: [...base.platforms, { center: [0, 18, 0], size: [1.2, 34, 13] }] };
  assert(validateRoom(buried).issues.some((issue) => issue.code === "geometry.spawn-clearance"), "Content Doctor rejects a spawn inside geometry");

  // Dropping is one-way: a Sphere only visible from below cannot be spent from above.
  const ledge: RoomSpec = {
    ...base,
    spawn: [0, 8.2, 0],
    goal: [0, 7.1, 0],
    platforms: [{ center: [0, 6, 0], size: [6, 1, 6] }, { center: [0, 0, 0], size: [30, 1, 30] }],
    enemies: [{ id: "low", kind: "sentry", position: [0, 2.2, -12], originConstraint: { axis: "y", max: 4 } }]
  };
  equal(solveRoom(ledge).solved, false, "solver treats drops as one-way");

  const suites = [...buildTimeTrialSuite(), ...buildChallengeSuite()];
  equal(suites.length, 40, "Time Trial and Challenge ship 16 + 24 rooms");
  const campaignRooms = CAMPAIGN_MAPS.flatMap((map) => map.campaignRooms);
  const campaignHashes = new Set(campaignRooms.map((room) => describeLayout(room).geometryHash));
  assert(suites.every((room) => !campaignHashes.has(describeLayout(room).geometryHash)), "no Time Trial or Challenge room clones a Campaign room");
  const suiteDescriptors = suites.map(describeLayout);
  const worst = suiteDescriptors.flatMap((a, i) => suiteDescriptors.slice(i + 1).map((b) => layoutSimilarity(a, b)))
    .reduce((max, score) => Math.max(max, score), 0);
  assert(worst < 0.88, `no two mode rooms are near-duplicates (worst ${worst.toFixed(2)})`);
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  throw error;
});

function testMovementCollision(): void {
  const platforms = [floor(0, 0, 0, 20, 20), floor(0, 0.3, -5, 4, 4), solid(3, 4, 0, 4, -2, 2)];
  const walker = new THREE.Vector3(0, 1.7, 0);
  let climbed = false;
  for (let i = 0; i < 40; i += 1) {
    movement.moveWithBodyCollision(walker, 0, -0.12, 1.7, 1.86, platforms, true);
    const previous = walker.y;
    walker.y -= 0.01;
    movement.resolveFloor(walker, previous, 1.7, -1, platforms);
    climbed ||= Math.abs(walker.y - 2) < 0.01;
  }
  assert(climbed, "auto-step climbs a 0.3m lip");

  const embedded = new THREE.Vector3(2.8, 1.7, -1);
  for (let i = 0; i < 10; i += 1) movement.moveWithBodyCollision(embedded, 0, 0.1, 1.7, 1.86, platforms, true);
  assert(embedded.x < 2.68 && embedded.z > -0.05, "a body embedded in a wall is pushed out and can slide along it");

  const runner = new THREE.Vector3(1, 1.7, 0);
  for (let i = 0; i < 30; i += 1) movement.moveWithBodyCollision(runner, 0.13, 0, 1.7, 1.86, platforms, true);
  assert(runner.x > 2.66 && runner.x <= 2.68, "walking into a wall closes to contact without a gap");
}
