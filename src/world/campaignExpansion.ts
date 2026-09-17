import type { CampaignMapDefinition } from "./campaign";
import type { RoomSpec } from "./stages";

const platform = (x:number,y:number,z:number,sx:number,sy:number,sz:number) => ({ center:[x,y,z] as [number,number,number], size:[sx,sy,sz] as [number,number,number] });
const sentry = (id:string,x:number,y:number,z:number) => ({ id, kind:"sentry" as const, position:[x,y,z] as [number,number,number] });

function map(id:number, title:string, subtitle:string, focus:string[], room:RoomSpec): CampaignMapDefinition {
  return {
    id:`map-${String(id).padStart(2,"0")}`,
    label:`SECTOR ${String(id).padStart(2,"0")} // ${title}`,
    subtitle,
    focus,
    implemented:true,
    campaignRooms:[room],
    courseRooms:[structuredClone(room) as RoomSpec]
  };
}

const LOW_VAULT: RoomSpec = {
  id:"sector-17-low-vault", title:"LOW VAULT",
  lesson:"Standing gives you the wrong line. Lower your profile, cross beneath the structure, then spend the vector.",
  grammar:["low-profile","origin-matters","reorientation","stop-short"],
  spawn:[0,2.2,16], goal:[0,1.1,-86], requiredKills:5,
  platforms:[
    platform(0,0,14,14,1,12),
    platform(0,2.35,-4,16,.75,12), platform(-8.4,1.5,-4,.8,3,12), platform(8.4,1.5,-4,.8,3,12),
    platform(-11,0,-26,8,1,8), platform(10,4,-46,7,1,7),
    platform(0,2.25,-62,15,.7,12), platform(-7.8,1.45,-62,.8,2.9,12), platform(7.8,1.45,-62,.8,2.9,12),
    platform(0,0,-86,13,1,11)
  ],
  enemies:[sentry("vault-low-a",0,1.55,-14),sentry("vault-left",-11,3,-26),sentry("vault-high",10,7,-46),sentry("vault-low-b",0,1.5,-73),sentry("vault-final",0,3,-88)]
};

const HUB_RETURN: RoomSpec = {
  id:"sector-18-hub-return", title:"HUB RETURN",
  lesson:"The Gravity Ring is already here. Leave the hub in every direction, clear the spokes, then return.",
  grammar:["route-fork","origin-matters","reorientation"],
  spawn:[0,2.2,0], goal:[0,1.1,0], requiredKills:6,
  platforms:[platform(0,0,0,18,1,18),platform(-28,2,0,10,1,10),platform(28,5,0,10,1,10),platform(0,-4,-30,10,1,10),platform(0,8,30,10,1,10),platform(-20,10,-22,7,1,7),platform(20,-7,22,7,1,7)],
  enemies:[sentry("hub-west",-28,5,0),sentry("hub-east",28,8,0),sentry("hub-north",0,-1,-30),sentry("hub-south",0,11,30),sentry("hub-high",-20,13,-22),sentry("hub-low",20,-4,22)]
};

const TOWER: RoomSpec = {
  id:"sector-27-tower", title:"TOWER",
  lesson:"The route is above you. Climb by creating firing origins on successive floors.",
  grammar:["airborne-chain","origin-matters","reorientation"],
  spawn:[0,2.2,8], goal:[0,35.1,-10], requiredKills:7,
  platforms:[platform(0,0,8,14,1,12),platform(-8,6,-4,7,1,7),platform(8,12,-10,7,1,7),platform(-7,18,-16,7,1,7),platform(7,24,-10,7,1,7),platform(0,30,-4,8,1,8),platform(0,34,-10,13,1,11),platform(0,17,-1,1.2,34,18)],
  enemies:[sentry("tower-1",-8,9,-4),sentry("tower-2",8,15,-10),sentry("tower-3",-7,21,-16),sentry("tower-4",7,27,-10),sentry("tower-5",0,33,-4),sentry("tower-6",-5,36,-8),sentry("tower-7",0,37,-10)]
};

const WALLWORK: RoomSpec = {
  id:"sector-28-wallwork", title:"WALLWORK",
  lesson:"Walls are absolute. Mark the destination, relocate the origin, and build a legal line around solid geometry.",
  grammar:["origin-matters","reorientation","route-fork","stop-short"],
  spawn:[-18,2.2,16], goal:[18,1.1,-70], requiredKills:5,
  platforms:[platform(-18,0,14,12,1,12),platform(18,0,14,12,1,12),platform(-18,3,-18,10,1,10),platform(18,6,-18,10,1,10),platform(-18,1,-48,10,1,10),platform(18,0,-70,13,1,11),platform(0,6,0,2,12,44),platform(0,6,-44,2,12,32)],
  enemies:[sentry("wall-a",18,3,14),sentry("wall-b",-18,6,-18),sentry("wall-c",18,9,-18),sentry("wall-d",-18,4,-48),sentry("wall-final",18,3,-72)]
};

const WIDE_ANGLE: RoomSpec = {
  id:"sector-29-wide-angle", title:"WIDE ANGLE",
  lesson:"Forward is not the route. Cross the field, manufacture angle, and choose how much width to spend.",
  grammar:["route-fork","origin-matters","moving-endpoint","reorientation"],
  spawn:[0,2.2,10], goal:[0,1.1,-88], requiredKills:6,
  platforms:[platform(0,0,8,14,1,12),platform(-34,2,-8,10,1,10),platform(34,5,-12,10,1,10),platform(-30,8,-42,9,1,9),platform(30,-3,-48,9,1,9),platform(0,4,-68,10,1,10),platform(0,0,-88,13,1,11)],
  enemies:[sentry("wide-left",-34,5,-8),sentry("wide-right",34,8,-12),sentry("wide-high",-30,11,-42),sentry("wide-low",30,0,-48),sentry("wide-mid",0,7,-68),sentry("wide-final",0,3,-90)]
};

const SHAFT: RoomSpec = {
  id:"sector-30-shaft", title:"SHAFT",
  lesson:"The footprint is tiny. Height is the maze.",
  grammar:["airborne-chain","stop-short","reorientation","origin-matters"],
  spawn:[0,26.2,4], goal:[0,-23.9,-8], requiredKills:8,
  platforms:[platform(0,24,4,12,1,10),platform(6,18,-5,6,1,6),platform(-6,11,-10,6,1,6),platform(5,4,-3,6,1,6),platform(-5,-4,-11,6,1,6),platform(6,-11,-4,6,1,6),platform(-6,-18,-10,6,1,6),platform(0,-25,-8,12,1,10),platform(0,0,-7,20,52,1.2)],
  enemies:[sentry("shaft-1",6,21,-5),sentry("shaft-2",-6,14,-10),sentry("shaft-3",5,7,-3),sentry("shaft-4",-5,-1,-11),sentry("shaft-5",6,-8,-4),sentry("shaft-6",-6,-15,-10),sentry("shaft-7",4,-22,-8),sentry("shaft-8",0,-22,-8)]
};

const LOOP_CIRCUIT: RoomSpec = {
  id:"sector-39-loop-circuit", title:"LOOP CIRCUIT",
  lesson:"The room is a circuit, not a corridor. Complete the loop and re-enter the ring from the opposite side.",
  grammar:["route-fork","reorientation","origin-matters"],
  spawn:[0,2.2,24], goal:[0,1.1,24], requiredKills:8,
  platforms:[platform(0,0,24,14,1,12),platform(24,2,18,8,1,8),platform(34,5,0,8,1,8),platform(24,8,-20,8,1,8),platform(0,3,-30,8,1,8),platform(-24,-2,-20,8,1,8),platform(-34,4,0,8,1,8),platform(-24,7,18,8,1,8)],
  enemies:[sentry("loop-1",24,5,18),sentry("loop-2",34,8,0),sentry("loop-3",24,11,-20),sentry("loop-4",0,6,-30),sentry("loop-5",-24,1,-20),sentry("loop-6",-34,7,0),sentry("loop-7",-24,10,18),sentry("loop-8",0,3,24)]
};

const OVER_UNDER: RoomSpec = {
  id:"sector-40-over-under", title:"OVER / UNDER",
  lesson:"Two routes occupy the same footprint. Change floors to change what can be seen.",
  grammar:["low-profile","origin-matters","route-fork","reorientation"],
  spawn:[-10,2.2,16], goal:[10,13.1,-72], requiredKills:7,
  platforms:[platform(-10,0,14,12,1,12),platform(-10,10,-2,10,1,10),platform(10,0,-20,10,1,10),platform(10,10,-38,10,1,10),platform(-10,0,-56,10,1,10),platform(10,12,-72,13,1,11),platform(0,5,-12,26,1,8),platform(0,6,-47,26,1,8)],
  enemies:[sentry("ou-high-a",-10,13,-2),sentry("ou-low-a",10,3,-20),sentry("ou-high-b",10,13,-38),sentry("ou-low-b",-10,3,-56),sentry("ou-crouch",0,4.1,-12),sentry("ou-rise",6,10,-62),sentry("ou-final",10,15,-72)]
};

const VOID_BRIDGE: RoomSpec = {
  id:"sector-41-void-bridge", title:"VOID BRIDGE",
  lesson:"Distance is the hazard. Sparse anchors make every landing fraction matter.",
  grammar:["stop-short","moving-endpoint","route-fork"],
  spawn:[0,2.2,22], goal:[0,1.1,-180], requiredKills:6,
  platforms:[platform(0,0,20,16,1,14),platform(-18,4,-18,6,1,6),platform(22,-3,-56,6,1,6),platform(-20,9,-96,6,1,6),platform(18,1,-132,6,1,6),platform(0,0,-180,16,1,13)],
  enemies:[sentry("void-1",-18,7,-18),sentry("void-2",22,0,-56),sentry("void-3",-20,12,-96),sentry("void-4",18,4,-132),sentry("void-5",0,8,-158),sentry("void-final",0,3,-182)]
};

const ASCENSION: RoomSpec = {
  id:"sector-42-ascension", title:"ASCENSION",
  lesson:"Final exam. Width, height, low profile, solid walls, return logic and exact sphere count all belong to one sentence.",
  grammar:["low-profile","airborne-chain","origin-matters","route-fork","stop-short","reorientation"],
  spawn:[0,2.2,20], goal:[0,31.1,20], requiredKills:10,
  platforms:[platform(0,0,20,16,1,14),platform(-22,0,0,8,1,8),platform(22,5,-12,8,1,8),platform(-18,10,-30,8,1,8),platform(18,15,-12,8,1,8),platform(-12,20,6,8,1,8),platform(12,25,18,8,1,8),platform(0,30,20,16,1,14),platform(0,5,-20,2,10,36),platform(0,18,3,28,1,7)],
  enemies:[sentry("asc-1",-22,3,0),sentry("asc-2",22,8,-12),sentry("asc-3",-18,13,-30),sentry("asc-4",18,18,-12),sentry("asc-5",-12,23,6),sentry("asc-6",12,28,18),sentry("asc-7",-6,8,-10),sentry("asc-8",6,17,0),sentry("asc-9",0,27,10),sentry("asc-10",0,33,20)]
};

export const CAMPAIGN_EXPANSION_MAPS: CampaignMapDefinition[] = [
  map(17,"LOW VAULT","Crouch becomes mandatory positioning, not an optional comfort verb.",["Low Profile","Crouch","Origin"],LOW_VAULT),
  map(18,"HUB RETURN","A central ring turns progression into excursions and return paths.",["Hub","Return","Route Order"],HUB_RETURN),
  map(27,"TOWER","A true vertical ascent where height is the route.",["Verticality","Ascension","Airborne Chain"],TOWER),
  map(28,"WALLWORK","Solid walls make legal vector geometry part of the puzzle.",["Solid Walls","Mobile Origin","Occlusion"],WALLWORK),
  map(29,"WIDE ANGLE","A broad lateral field rewards angle creation instead of forward marching.",["Width","Route Fork","Long Vectors"],WIDE_ANGLE),
  map(30,"SHAFT","A compact footprint hides a deep vertical navigation problem.",["Verticality","Descent","Height Reading"],SHAFT),
  map(39,"LOOP CIRCUIT","The route closes a full spatial loop around the starting ring.",["Loop","Return","Route Memory"],LOOP_CIRCUIT),
  map(40,"OVER / UNDER","Stacked routes use crouch and floor changes to alter sightlines.",["Split Level","Low Profile","Verticality"],OVER_UNDER),
  map(41,"VOID BRIDGE","Sparse anchors turn distance and stop-short placement into the threat.",["Long Range","Stop Short","Sparse Geometry"],VOID_BRIDGE),
  map(42,"ASCENSION","The final campaign room recomposes the full spatial grammar.",["Finale","Verticality","Low Profile","Solid Walls","Synthesis"],ASCENSION)
];
