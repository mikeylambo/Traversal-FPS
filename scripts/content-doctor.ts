import { CAMPAIGN_MAPS, type CampaignMapDefinition } from "../src/world/campaign";
import { registerCampaign02 } from "../src/world/registerCampaign02";
import { registerCampaign03 } from "../src/world/registerCampaign03";
import { registerCampaign04 } from "../src/world/registerCampaign04";
import { CONTROLS_ROOM } from "../src/world/onboarding";
import { SPATIAL_ACTOR_TRAINING } from "../src/world/trainingSpatial";
import { ROOMS, type RoomSpec } from "../src/world/stages";
import { validateRoomCatalog, type ContentValidationIssue } from "../src/world/contentValidation";

registerCampaign02();
registerCampaign03();
registerCampaign04();

type Catalog = { label: string; rooms: RoomSpec[] };
type ExtendedCampaignMap = CampaignMapDefinition & {
  timeTrialRooms?: RoomSpec[];
  challengeRooms?: RoomSpec[];
};

const catalogs: Catalog[] = [
  { label: "training", rooms: [CONTROLS_ROOM, ...ROOMS, ...SPATIAL_ACTOR_TRAINING] }
];

for (const baseMap of CAMPAIGN_MAPS.filter((entry) => entry.implemented)) {
  const map = baseMap as ExtendedCampaignMap;
  catalogs.push({ label: `${map.id}:campaign`, rooms: map.campaignRooms });
  catalogs.push({ label: `${map.id}:course`, rooms: map.courseRooms });
  if (map.timeTrialRooms?.length) catalogs.push({ label: `${map.id}:time-trial`, rooms: map.timeTrialRooms });
  if (map.challengeRooms?.length) catalogs.push({ label: `${map.id}:challenge`, rooms: map.challengeRooms });
}

const allIssues: Array<{ catalog: string; issue: ContentValidationIssue }> = [];
let roomCount = 0;

for (const catalog of catalogs) {
  roomCount += catalog.rooms.length;
  for (const issue of validateRoomCatalog(catalog.label, catalog.rooms)) {
    allIssues.push({ catalog: catalog.label, issue });
  }
}

const errors = allIssues.filter(({ issue }) => issue.severity === "error");
const warnings = allIssues.filter(({ issue }) => issue.severity === "warning");

for (const { catalog, issue } of allIssues) {
  const mark = issue.severity === "error" ? "ERROR" : "WARN ";
  const entity = issue.entityId ? ` :: ${issue.entityId}` : "";
  console.log(`[${mark}] ${catalog} :: ${issue.roomId}${entity} :: ${issue.code} :: ${issue.message}`);
}

console.log("");
console.log(
  `Traversal content doctor: ${roomCount} rooms // ${errors.length} errors // ${warnings.length} warnings`
);

if (errors.length > 0) {
  console.error("Content doctor FAILED. Structural content errors must be fixed before build.");
  process.exit(1);
}

console.log("Content doctor PASS. Geometry warnings remain advisory until play-certified.");