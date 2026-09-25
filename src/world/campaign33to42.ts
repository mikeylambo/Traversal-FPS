import type { CampaignMapDefinition } from "./campaign";
import type { RoomSpec } from "./stages";


function map(
  n: number,
  title: string,
  subtitle: string,
  focus: string[],
  campaign: RoomSpec
): CampaignMapDefinition {
  return {
    id: `map-${String(n).padStart(2, "0")}`,
    label: `SECTOR ${String(n).padStart(2, "0")} // ${title}`,
    subtitle,
    focus,
    implemented: true,
    campaignRooms: [campaign],
    courseRooms: [structuredClone(campaign) as RoomSpec]
  };
}

const S33: RoomSpec = {
  id: "sector-33-ascent", title: "ASCENT",
  lesson: "Height is the route. Read upward, not forward.",
  grammar: ["reorientation", "airborne-chain", "origin-matters"],
  // A solid core owns the centre. Perches spiral around it (E, N, W, S, E) far
  // enough out that each upward vector arrives above the next lip; the core hides
  // everything but the next perch, and the summit caps it.
  spawn: [0, 2.2, 8], goal: [0, 31.6, -5], requiredKills: 6,
  platforms: [
    { center: [0,0,7], size:[14,1,12] },
    { center: [0,15.5,-5], size:[4,29,4] },
    { center: [11,4,-5], size:[7,1,7] },
    { center: [0,9,-16], size:[7,1,7] },
    { center: [-11,14,-5], size:[7,1,7] },
    { center: [0,19,6], size:[7,1,7] },
    { center: [11,25,-5], size:[7,1,7] },
    { center: [0,30.5,-5], size:[12,1,12] }
  ],
  enemies: [
    { id:"ascent-01", kind:"sentry", position:[11,6.2,-5] },
    { id:"ascent-02", kind:"drifter", position:[0,11.2,-16], drift:{axis:"x",amplitude:2,speed:.62} },
    { id:"ascent-03", kind:"sentry", position:[-11,16.2,-5] },
    { id:"ascent-04", kind:"orbit", position:[0,21.2,6], orbit:{plane:"xz",radiusA:2,radiusB:1.5,speed:.12} },
    { id:"ascent-05", kind:"sentry", position:[11,27.2,-5] },
    { id:"ascent-06", kind:"sentry", position:[4,32.7,-5] }
  ]
};

const S34: RoomSpec = {
  id:"sector-34-undercurrent", title:"UNDERCURRENT",
  lesson:"The standing line is a trap. Lower your profile and solve beneath it.",
  grammar:["low-profile","origin-matters","reorientation"],
  spawn:[-16,2.2,10], goal:[16,1.1,-42], requiredKills:5,
  platforms:[
    {center:[-16,0,9],size:[13,1,12]}, {center:[0,0,-10],size:[30,1,11]}, {center:[16,0,-42],size:[13,1,11]},
    {center:[0,2.35,-10],size:[28,.7,9]}, {center:[-14,1.5,-10],size:[.8,3,9]}, {center:[14,1.5,-10],size:[.8,3,9]},
    {center:[0,5,-26],size:[24,10,1.2]}, {center:[-18,5,-26],size:[8,10,1.2]}, {center:[18,5,-26],size:[8,10,1.2]}
  ],
  enemies:[
    {id:"under-01",kind:"sentry",position:[-8,1.42,-10],radius:.55},
    {id:"under-02",kind:"sentry",position:[3,1.42,-10],radius:.55},
    {id:"under-03",kind:"shield",position:[16,2.2,-20],originConstraint:{axis:"x",max:2}},
    {id:"under-04",kind:"sentry",position:[-10,2.2,-38]},
    {id:"under-05",kind:"sentry",position:[16,2.2,-44]}
  ]
};

const S35: RoomSpec = {
  id:"sector-35-hub", title:"FOUR POINT",
  lesson:"The ring is already here. Earn it by leaving in every direction.",
  grammar:["route-fork","reorientation","origin-matters"],
  spawn:[0,2.2,0], goal:[0,1.1,0], requiredKills:8,
  platforms:[
    {center:[0,0,0],size:[15,1,15]}, {center:[0,1,-28],size:[10,1,10]}, {center:[28,3,0],size:[10,1,10]},
    {center:[0,-2,28],size:[10,1,10]}, {center:[-28,5,0],size:[10,1,10]},
    {center:[0,4,-14],size:[1.2,9,13]}, {center:[14,4,0],size:[13,9,1.2]},
    {center:[0,4,14],size:[1.2,9,13]}, {center:[-14,4,0],size:[13,9,1.2]}
  ],
  enemies:[
    {id:"hub-n1",kind:"sentry",position:[0,3.2,-28]}, {id:"hub-n2",kind:"drifter",position:[8,6,-22],drift:{axis:"x",amplitude:5,speed:.72}},
    {id:"hub-e1",kind:"sentry",position:[28,5.2,0]}, {id:"hub-e2",kind:"shield",position:[22,3,8],originConstraint:{axis:"x",max:8}},
    {id:"hub-s1",kind:"sentry",position:[0,.2,28]}, {id:"hub-s2",kind:"orbit",position:[-7,5,23],orbit:{plane:"xz",radiusA:5,radiusB:4,speed:.12}},
    {id:"hub-w1",kind:"sentry",position:[-28,7.2,0]}, {id:"hub-w2",kind:"drifter",position:[-22,8,-8],drift:{axis:"y",amplitude:2.5,speed:.76}}
  ]
};

const S36: RoomSpec = {
  id:"sector-36-shaft", title:"SHAFT",
  lesson:"The world gets narrow. The route gets deep.",
  grammar:["airborne-chain","reorientation","stop-short"],
  spawn:[0,24.2,4], goal:[0,-30.9,-6], requiredKills:7,
  platforms:[
    {center:[0,22,4],size:[11,1,10]}, {center:[5,14,-3],size:[6,1,6]}, {center:[-5,6,-7],size:[6,1,6]},
    {center:[4,-3,-2],size:[6,1,6]}, {center:[-4,-12,-8],size:[6,1,6]}, {center:[3,-21,-3],size:[6,1,6]},
    {center:[0,-32,-6],size:[11,1,10]}, {center:[-8,-4,-5],size:[1,58,18]}, {center:[8,-4,-5],size:[1,58,18]}
  ],
  enemies:[
    {id:"shaft-01",kind:"sentry",position:[5,16,-3]}, {id:"shaft-02",kind:"sentry",position:[-5,8,-7]},
    {id:"shaft-03",kind:"drifter",position:[4,0,-2],drift:{axis:"y",amplitude:2.5,speed:.8}},
    {id:"shaft-04",kind:"sentry",position:[-4,-10,-8]}, {id:"shaft-05",kind:"orbit",position:[0,-17,-5],orbit:{plane:"xy",radiusA:4,radiusB:3,speed:.14}},
    {id:"shaft-06",kind:"sentry",position:[3,-19,-3]}, {id:"shaft-07",kind:"sentry",position:[0,-30,-6]}
  ]
};

const S37: RoomSpec = {
  id:"sector-37-cross", title:"CROSS ORDER",
  lesson:"Four branches. The shortest order depends on where each kill leaves you.",
  grammar:["route-fork","reorientation","origin-matters"],
  spawn:[0,2.2,0], goal:[0,1.1,-38], requiredKills:6,
  platforms:[
    {center:[0,0,0],size:[14,1,14]}, {center:[0,2,-24],size:[8,1,8]}, {center:[24,5,0],size:[8,1,8]},
    {center:[0,-3,24],size:[8,1,8]}, {center:[-24,8,0],size:[8,1,8]}, {center:[0,0,-38],size:[12,1,10]}
  ],
  enemies:[
    {id:"cross-n",kind:"sentry",position:[0,4,-24]}, {id:"cross-e",kind:"sentry",position:[24,7,0]},
    {id:"cross-s",kind:"sentry",position:[0,-1,24]}, {id:"cross-w",kind:"sentry",position:[-24,10,0]},
    {id:"cross-mid",kind:"orbit",position:[0,8,0],orbit:{plane:"xz",radiusA:9,radiusB:9,speed:.1}},
    {id:"cross-out",kind:"sentry",position:[0,2.2,-40]}
  ]
};

const S38: RoomSpec = {
  id:"sector-38-over-under", title:"OVER / UNDER",
  lesson:"The upper route reveals the lower route. The lower route changes the shot back above.",
  grammar:["low-profile","reorientation","origin-matters","route-fork"],
  spawn:[-12,2.2,10], goal:[12,11.1,-45], requiredKills:6,
  platforms:[
    {center:[-12,0,9],size:[12,1,11]}, {center:[-8,10,-10],size:[10,1,9]}, {center:[8,0,-14],size:[16,1,10]},
    {center:[0,2.3,-14],size:[12,.7,8]}, {center:[8,10,-30],size:[9,1,9]}, {center:[12,10,-45],size:[12,1,10]},
    {center:[0,5,-22],size:[1.2,11,20]}
  ],
  enemies:[
    {id:"ou-01",kind:"sentry",position:[-8,12.2,-10]}, {id:"ou-02",kind:"sentry",position:[-2,1.42,-14],radius:.52},
    {id:"ou-03",kind:"sentry",position:[8,2.2,-14]}, {id:"ou-04",kind:"shield",position:[8,12.2,-30],originConstraint:{axis:"x",max:0}},
    {id:"ou-05",kind:"drifter",position:[0,8,-38],drift:{axis:"y",amplitude:3,speed:.72}},
    {id:"ou-06",kind:"sentry",position:[12,12.2,-45]}
  ]
};

const S39: RoomSpec = {
  id:"sector-39-longspan", title:"LONGSPAN",
  lesson:"The room is wider than your habits. Commit to distance.",
  grammar:["stop-short","moving-endpoint","route-fork"],
  spawn:[-34,2.2,8], goal:[34,1.1,-44], requiredKills:7,
  platforms:[
    {center:[-34,0,7],size:[14,1,12]}, {center:[-18,3,-8],size:[7,1,7]}, {center:[0,-2,-20],size:[9,1,8]},
    {center:[18,5,-31],size:[7,1,7]}, {center:[34,0,-44],size:[14,1,12]}
  ],
  enemies:[
    {id:"span39-a",kind:"drifter",position:[-18,7,-8],drift:{axis:"x",amplitude:8,speed:.72}},
    {id:"span39-b",kind:"sentry",position:[-4,4,-16]}, {id:"span39-c",kind:"orbit",position:[0,4,-20],orbit:{plane:"xy",radiusA:8,radiusB:4,speed:.12}},
    {id:"span39-d",kind:"sentry",position:[18,7,-31]}, {id:"span39-e",kind:"drifter",position:[27,6,-37],drift:{axis:"y",amplitude:3,speed:.75}},
    {id:"span39-f",kind:"sentry",position:[34,2.2,-44]}, {id:"span39-g",kind:"sentry",position:[8,9,-27]}
  ]
};

const S40: RoomSpec = {
  id:"sector-40-parallax", title:"PARALLAX",
  lesson:"Lock the destination. Change yourself. Spend the line from where you stand now.",
  grammar:["origin-matters","reorientation","stop-short"],
  spawn:[-12,2.2,8], goal:[12,1.1,-46], requiredKills:5,
  platforms:[
    {center:[-12,0,7],size:[13,1,11]}, {center:[-12,0,-12],size:[10,1,9]}, {center:[12,3,-12],size:[10,1,9]},
    {center:[12,0,-46],size:[13,1,11]}, {center:[0,5,-23],size:[1.4,10,26]}, {center:[-8,3,-29],size:[11,1,8]}
  ],
  enemies:[
    {id:"parallax-lock",kind:"sentry",position:[12,5.2,-12]},
    {id:"parallax-02",kind:"shield",position:[-8,5.2,-29],originConstraint:{axis:"x",min:1}},
    {id:"parallax-03",kind:"sentry",position:[12,5,-31]},
    {id:"parallax-04",kind:"drifter",position:[0,8,-39],drift:{axis:"x",amplitude:8,speed:.7}},
    {id:"parallax-05",kind:"sentry",position:[12,2.2,-48]}
  ]
};

const S41: RoomSpec = {
  id:"sector-41-loop", title:"LOOP",
  lesson:"Forward stops meaning forward when the route closes around itself.",
  grammar:["route-fork","reorientation","moving-endpoint"],
  spawn:[0,2.2,0], goal:[0,1.1,0], requiredKills:6,
  platforms:[
    {center:[0,0,0],size:[12,1,12]}, {center:[-20,2,-12],size:[8,1,8]}, {center:[-20,5,-34],size:[8,1,8]},
    {center:[0,8,-46],size:[8,1,8]}, {center:[20,4,-34],size:[8,1,8]}, {center:[20,1,-12],size:[8,1,8]},
    {center:[0,5,-23],size:[15,10,1.5]}
  ],
  enemies:[
    {id:"loop-a",kind:"sentry",position:[-20,4.2,-12]}, {id:"loop-b",kind:"drifter",position:[-20,8,-34],drift:{axis:"y",amplitude:2,speed:.7}},
    {id:"loop-c",kind:"orbit",position:[0,11,-46],orbit:{plane:"xy",radiusA:5,radiusB:3,speed:.12}},
    {id:"loop-d",kind:"sentry",position:[20,6.2,-34]}, {id:"loop-e",kind:"drifter",position:[20,4,-12],drift:{axis:"x",amplitude:4,speed:.8}},
    {id:"loop-f",kind:"sentry",position:[0,2.2,0]}
  ]
};

const S42: RoomSpec = {
  id:"sector-42-convergence", title:"CONVERGENCE",
  lesson:"Everything you learned is spatial now. Read the whole construct, then choose your sentence.",
  grammar:["low-profile","route-fork","origin-matters","airborne-chain","moving-endpoint","reorientation","stop-short"],
  spawn:[0,2.2,0], goal:[0,25.1,0], requiredKills:10,
  platforms:[
    {center:[0,0,0],size:[16,1,16]},
    {center:[-24,2,-14],size:[8,1,8]}, {center:[24,5,-14],size:[8,1,8]}, {center:[0,-4,-32],size:[10,1,9]},
    {center:[-18,10,-43],size:[8,1,8]}, {center:[18,15,-38],size:[8,1,8]}, {center:[0,20,-22],size:[9,1,9]},
    {center:[0,24,0],size:[13,1,11]},
    {center:[0,2.3,-10],size:[12,.7,8]}, {center:[-6.4,1.5,-10],size:[.8,3,8]}, {center:[6.4,1.5,-10],size:[.8,3,8]},
    {center:[0,8,-28],size:[1.4,18,28]}
  ],
  enemies:[
    {id:"conv-low",kind:"sentry",position:[0,1.42,-12],radius:.52},
    {id:"conv-left",kind:"sentry",position:[-24,4.2,-14]}, {id:"conv-right",kind:"shield",position:[24,7.2,-14],originConstraint:{axis:"x",max:0}},
    {id:"conv-drop",kind:"sentry",position:[0,-1.8,-32]}, {id:"conv-rise-a",kind:"drifter",position:[-18,13,-43],drift:{axis:"y",amplitude:3,speed:.8}},
    {id:"conv-rise-b",kind:"orbit",position:[18,18,-38],orbit:{plane:"yz",radiusA:4,radiusB:4,speed:.12}},
    {id:"conv-high",kind:"sentry",position:[0,22.2,-22]}, {id:"conv-alt",kind:"sentry",position:[-10,17,-29]},
    {id:"conv-return",kind:"drifter",position:[8,23,-10],drift:{axis:"x",amplitude:6,speed:.75}},
    {id:"conv-final",kind:"sentry",position:[0,26.2,0]}
  ]
};

export const MAPS_33_TO_42: CampaignMapDefinition[] = [
  map(33, "ASCENT", "A true vertical climb where height is the route.", ["Tower", "Verticality", "Airborne Chain"], S33),
  map(34, "UNDERCURRENT", "A low-profile route where crouch changes which shots exist.", ["Crouch", "Underpass", "Origin"], S34),
  map(35, "FOUR POINT", "The Gravity Ring begins at the center of a hub that must be cleared outward.", ["Hub", "Goal At Spawn", "Route Order"], S35),
  map(36, "SHAFT", "A narrow footprint with a deep vertical descent.", ["Shaft", "Descent", "Verticality"], S36),
  map(37, "CROSS ORDER", "A broad cardinal layout where branch order defines efficiency.", ["Cross", "Width", "Route Choice"], S37),
  map(38, "OVER / UNDER", "Stacked routes force repeated changes in elevation and profile.", ["Split Level", "Crouch", "Verticality"], S38),
  map(39, "LONGSPAN", "Sparse anchors stretch the Construct laterally instead of forward.", ["Width", "Long Distance", "Stop Short"], S39),
  map(40, "PARALLAX", "The locked target stays fixed while the player's live warp origin moves.", ["Mobile Origin", "Solid Walls", "Reposition"], S40),
  map(41, "LOOP", "A closed route returns to the beginning from the opposite side.", ["Loop", "Return", "Route Choice"], S41),
  map(42, "CONVERGENCE", "Act IV finale: the expanded spatial grammar recomposed into one construct.", ["Finale", "Synthesis", "Verticality", "Crouch", "Mobile Origin"], S42)
];
