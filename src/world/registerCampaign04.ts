import { CAMPAIGN_MAPS } from "./campaign";
import { MAP_04_COURSE, MAP_04_FIELD } from "./campaign04";
import { registerCampaign05to08 } from "./registerCampaign05to08";
import { registerCampaign09 } from "./registerCampaign09";

export function registerCampaign04(): void {
  const map = CAMPAIGN_MAPS.find((entry) => entry.id === "map-04");
  if (map) {
    map.implemented = true;
    map.campaignRooms = MAP_04_FIELD;
    map.courseRooms = MAP_04_COURSE;
  }

  registerCampaign05to08();
  registerCampaign09();

  for (const entry of CAMPAIGN_MAPS) {
    const sector = Number(entry.id.replace("map-", ""));
    const act = sector <= 8 ? "ACT I" : "ACT II";
    if (!entry.label.startsWith(`${act} //`)) entry.label = `${act} // ${entry.label}`;
  }
}
