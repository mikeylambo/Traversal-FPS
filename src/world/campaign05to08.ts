import type { RoomSpec } from "./stages";

export const MAP_05_FIELD: RoomSpec[] = [
  {
    id: "sector-05-reconfiguration",
    title: "RECONFIGURATION",
    lesson: "The route is only temporarily true. Read which geometry is available now, then commit before the construct changes.",
    grammar: ["stop-short", "moving-endpoint", "reorientation", "route-fork", "airborne-chain"],
    spawn: [0, 2.2, 24], goal: [0, 1.1, -154], requiredKills: 6,
    platforms: [
      { center: [0,0,22], size:[16,1,14] }, { center:[-10,2,-8], size:[8,1,8] }, { center:[10,5,-27], size:[7,1,7] },
      { center:[0,1,-48], size:[11,1,9] }, { center:[-13,6,-69], size:[7,1,7] }, { center:[12,2,-89], size:[8,1,8] },
      { center:[0,7,-108], size:[6,1,6] }, { center:[0,0,-131], size:[12,1,10] }, { center:[0,0,-153], size:[16,1,13] },
      { center:[5,5,-18], size:[1,10,18] }, { center:[-5,5,-58], size:[1,10,20] }, { center:[6,5,-99], size:[1,10,18] }
    ],
    enemies: [
      { id:"reconfig-entry", kind:"sentry", position:[-10,4.2,-8] },
      { id:"reconfig-rise", kind:"drifter", position:[10,7.2,-28], drift:{axis:"y", amplitude:2.5, speed:0.66} },
      { id:"reconfig-mid", kind:"orbit", position:[0,6,-49], orbit:{plane:"xy", radiusA:8, radiusB:3, speed:0.62} },
      { id:"reconfig-left", kind:"drifter", position:[-13,8.2,-70], drift:{axis:"x", amplitude:4, speed:0.72} },
      { id:"reconfig-right", kind:"orbit", position:[9,6,-92], orbit:{plane:"yz", radiusA:4, radiusB:6, speed:0.58, phase:1.1} },
      { id:"reconfig-high", kind:"sentry", position:[0,9.2,-108] },
      { id:"reconfig-final", kind:"drifter", position:[0,3.2,-141], drift:{axis:"x", amplitude:6, speed:0.7} }
    ],
    hazards: [
      { id:"reconfig-gate-a", kind:"sightline-gate", center:[0,4,-18], size:[18,8,0.42], cycle:{period:3.0, openFor:1.15, phase:0.0} },
      { id:"reconfig-gate-b", kind:"sightline-gate", center:[0,5,-39], size:[18,10,0.42], cycle:{period:3.0, openFor:1.15, phase:1.5} },
      { id:"reconfig-sweep", kind:"sweep", center:[0,5,-79], size:[0.55,10,26], drift:{axis:"x", amplitude:17, speed:0.28, phase:0.35} },
      { id:"reconfig-gate-c", kind:"sightline-gate", center:[0,5,-119], size:[16,10,0.42], cycle:{period:2.6, openFor:0.95, phase:0.75} }
    ]
  }
];

export const MAP_05_COURSE: RoomSpec[] = [
  { id:"map-05-01", title:"PHASE WINDOW", lesson:"The route appears on a cycle. Prepare the shot before it opens.", grammar:["moving-endpoint","stop-short"], spawn:[0,2.2,7], goal:[0,1.1,-24], requiredKills:1, platforms:[{center:[0,0,6],size:[11,1,10]},{center:[0,0,-24],size:[9,1,8]}], enemies:[{id:"m5-1",kind:"sentry",position:[0,2.2,-30]}], hazards:[{id:"m5-gate",kind:"sightline-gate",center:[0,4,-11],size:[12,8,0.4],cycle:{period:2.5,openFor:0.9}}] },
  { id:"map-05-02", title:"ALTERNATE", lesson:"When one line closes, the other becomes valuable.", grammar:["route-fork","reorientation"], spawn:[0,2.2,7], goal:[0,1.1,-34], requiredKills:2, platforms:[{center:[0,0,6],size:[11,1,10]},{center:[-8,2,-13],size:[7,1,7]},{center:[8,2,-13],size:[7,1,7]},{center:[0,0,-34],size:[10,1,9]}], enemies:[{id:"m5-2-l",kind:"sentry",position:[-8,4.2,-13]},{id:"m5-2-r",kind:"sentry",position:[8,4.2,-13]},{id:"m5-2-e",kind:"sentry",position:[0,2.8,-39]}], hazards:[{id:"m5-2-a",kind:"sightline-gate",center:[-4,4,-23],size:[8,8,0.4],cycle:{period:3,openFor:1.2}},{id:"m5-2-b",kind:"sightline-gate",center:[4,4,-23],size:[8,8,0.4],cycle:{period:3,openFor:1.2,phase:1.5}}] },
  { id:"map-05-03", title:"SHIFT CHAIN", lesson:"Start the chain while the geometry agrees with you; finish before it changes.", grammar:["airborne-chain","reorientation","moving-endpoint"], spawn:[-7,2.2,7], goal:[7,1.1,-38], requiredKills:2, platforms:[{center:[-7,0,6],size:[10,1,10]},{center:[0,3,-15],size:[6,1,6]},{center:[7,0,-38],size:[10,1,10]}], enemies:[{id:"m5-3-a",kind:"drifter",position:[0,7,-15],drift:{axis:"y",amplitude:2.5,speed:0.7}},{id:"m5-3-b",kind:"orbit",position:[7,6,-34],orbit:{plane:"xy",radiusA:5,radiusB:2.5,speed:0.62}}], hazards:[{id:"m5-3-g",kind:"sightline-gate",center:[4,5,-27],size:[8,10,0.4],cycle:{period:2.8,openFor:1}}] }
];

export const MAP_06_FIELD: RoomSpec[] = [
  {
    id:"sector-06-clean-geometry", title:"CLEAN GEOMETRY", lesson:"Several routes work. The sector rewards seeing the smallest solution before moving.",
    grammar:["route-fork","stop-short","origin-matters","reorientation","moving-endpoint"], spawn:[0,2.2,24], goal:[0,1.1,-150], requiredKills:5,
    platforms:[
      {center:[0,0,22],size:[16,1,14]}, {center:[-14,1,-9],size:[8,1,8]}, {center:[0,5,-20],size:[6,1,6]}, {center:[14,2,-31],size:[8,1,8]},
      {center:[-8,4,-57],size:[7,1,7]}, {center:[9,1,-72],size:[7,1,7]}, {center:[0,6,-92],size:[6,1,6]}, {center:[-12,2,-111],size:[7,1,7]},
      {center:[12,4,-126],size:[7,1,7]}, {center:[0,0,-149],size:[16,1,13]}, {center:[0,5,-44],size:[1,10,18]}, {center:[3,5,-101],size:[1,10,20]}
    ],
    enemies:[
      {id:"clean-left",kind:"sentry",position:[-14,3.2,-9]}, {id:"clean-center",kind:"sentry",position:[0,7.2,-20]}, {id:"clean-right",kind:"sentry",position:[14,4.2,-31]},
      {id:"clean-mid-a",kind:"drifter",position:[-8,6.2,-57],drift:{axis:"y",amplitude:2,speed:0.65}}, {id:"clean-mid-b",kind:"sentry",position:[9,3.2,-72]},
      {id:"clean-high",kind:"orbit",position:[0,8,-94],orbit:{plane:"xy",radiusA:7,radiusB:2.5,speed:0.56}}, {id:"clean-low",kind:"sentry",position:[-12,4.2,-111]},
      {id:"clean-late",kind:"drifter",position:[12,6.2,-126],drift:{axis:"x",amplitude:4,speed:0.68}}, {id:"clean-exit",kind:"sentry",position:[0,2.8,-158]}
    ],
    hazards:[{id:"clean-sweep",kind:"sweep",center:[0,4.5,-82],size:[0.5,9,22],drift:{axis:"x",amplitude:16,speed:0.25,phase:0.4}}]
  }
];

export const MAP_06_COURSE: RoomSpec[] = [
  { id:"map-06-01", title:"TWO OF FOUR", lesson:"Four anchors are available. Find the two-vector clear.", grammar:["route-fork","reorientation"], spawn:[0,2.2,7], goal:[0,1.1,-38], requiredKills:2, platforms:[{center:[0,0,6],size:[12,1,10]},{center:[-9,2,-13],size:[7,1,7]},{center:[9,2,-13],size:[7,1,7]},{center:[-6,3,-25],size:[6,1,6]},{center:[6,3,-25],size:[6,1,6]},{center:[0,0,-38],size:[11,1,9]}], enemies:[{id:"m6-a",kind:"sentry",position:[-9,4.2,-13]},{id:"m6-b",kind:"sentry",position:[9,4.2,-13]},{id:"m6-c",kind:"sentry",position:[-6,5.2,-25]},{id:"m6-d",kind:"sentry",position:[6,5.2,-25]},{id:"m6-e",kind:"sentry",position:[0,2.8,-43]}] },
  { id:"map-06-02", title:"CUT THE CORNER", lesson:"The target is farther than the useful landing. Spend only the distance you need.", grammar:["stop-short","route-fork"], spawn:[-6,2.2,7], goal:[8,1.1,-30], requiredKills:2, platforms:[{center:[-6,0,6],size:[10,1,10]},{center:[8,0,-30],size:[10,1,10]},{center:[0,2,-12],size:[5,1,5]}], enemies:[{id:"m6-2-a",kind:"sentry",position:[0,4.2,-21]},{id:"m6-2-b",kind:"sentry",position:[8,3,-36]}] },
  { id:"map-06-03", title:"NO WASTE", lesson:"Every extra kill is a confession that you did not read the room first.", grammar:["route-fork","moving-endpoint","origin-matters"], spawn:[0,2.2,7], goal:[0,1.1,-43], requiredKills:2, platforms:[{center:[0,0,6],size:[12,1,10]},{center:[-9,2,-14],size:[7,1,7]},{center:[9,2,-24],size:[7,1,7]},{center:[0,0,-43],size:[12,1,10]}], enemies:[{id:"m6-3-a",kind:"drifter",position:[-9,5,-14],drift:{axis:"y",amplitude:2,speed:0.62}},{id:"m6-3-b",kind:"sentry",position:[9,4.2,-24]},{id:"m6-3-c",kind:"drifter",position:[0,4,-34],drift:{axis:"x",amplitude:6,speed:0.7}},{id:"m6-3-d",kind:"sentry",position:[0,2.8,-49]}] }
];

export const MAP_07_FIELD: RoomSpec[] = [
  {
    id:"sector-07-vector-foundry", title:"VECTOR FOUNDRY", lesson:"Do not merely hit the moving endpoint. Manufacture the coordinate you want, then kill it there.",
    grammar:["moving-endpoint","stop-short","origin-matters","route-fork","airborne-chain","reorientation"], spawn:[0,2.2,24], goal:[0,1.1,-158], requiredKills:6,
    platforms:[
      {center:[0,0,22],size:[16,1,14]}, {center:[10,1,-11],size:[6,1,12]}, {center:[-11,4,-32],size:[7,1,7]}, {center:[12,6,-55],size:[6,1,6]},
      {center:[0,1,-78],size:[11,1,9]}, {center:[-13,5,-99],size:[7,1,7]}, {center:[13,2,-120],size:[7,1,7]}, {center:[0,7,-137],size:[6,1,6]},
      {center:[0,0,-157],size:[16,1,13]}, {center:[-4,5,-45],size:[1,10,20]}, {center:[5,5,-110],size:[1,10,20]}
    ],
    enemies:[
      {id:"foundry-slide",kind:"drifter",position:[0,3.2,-11],drift:{axis:"x",amplitude:12,speed:0.55}},
      {id:"foundry-lift",kind:"drifter",position:[-11,6.2,-33],drift:{axis:"y",amplitude:3.2,speed:0.6}},
      {id:"foundry-orbit",kind:"orbit",position:[5,8,-56],orbit:{plane:"xy",radiusA:8,radiusB:3.5,speed:0.54}},
      {id:"foundry-mid",kind:"drifter",position:[0,5,-79],drift:{axis:"x",amplitude:9,speed:0.62}},
      {id:"foundry-left",kind:"orbit",position:[-8,8,-100],orbit:{plane:"yz",radiusA:4,radiusB:6,speed:0.56,phase:0.8}},
      {id:"foundry-right",kind:"drifter",position:[13,5,-121],drift:{axis:"y",amplitude:2.5,speed:0.65}},
      {id:"foundry-high",kind:"orbit",position:[0,9,-138],orbit:{plane:"xy",radiusA:9,radiusB:2.5,speed:0.5,phase:1.2}},
      {id:"foundry-exit",kind:"sentry",position:[0,2.8,-166]}
    ],
    hazards:[
      {id:"foundry-sweep-a",kind:"sweep",center:[0,4,-22],size:[0.5,8,24],drift:{axis:"x",amplitude:15,speed:0.28}},
      {id:"foundry-gate",kind:"sightline-gate",center:[0,5,-89],size:[18,10,0.4],cycle:{period:2.8,openFor:1.05,phase:0.5}},
      {id:"foundry-sweep-b",kind:"sweep",center:[0,5,-130],size:[26,0.5,20],drift:{axis:"y",amplitude:5,speed:0.25,phase:1.1}}
    ]
  }
];

export const MAP_07_COURSE: RoomSpec[] = [
  { id:"map-07-01", title:"PLACE X", lesson:"Kill the drifter only when its endpoint sits above the narrow landing.", grammar:["moving-endpoint"], spawn:[0,2.2,7], goal:[8,1.1,-22], requiredKills:1, platforms:[{center:[0,0,6],size:[10,1,10]},{center:[8,0,-22],size:[4,1,8]}], enemies:[{id:"m7-1",kind:"drifter",position:[0,2.2,-22],drift:{axis:"x",amplitude:12,speed:0.58}}] },
  { id:"map-07-02", title:"PLACE Y", lesson:"Altitude is part of the endpoint. Manufacture a high vector, then cut it to the perch.", grammar:["moving-endpoint","stop-short"], spawn:[0,2.2,7], goal:[0,4.1,-23], requiredKills:1, platforms:[{center:[0,0,6],size:[10,1,10]},{center:[0,3,-23],size:[5,1,5]}], enemies:[{id:"m7-2",kind:"drifter",position:[0,5,-30],drift:{axis:"y",amplitude:5,speed:0.55}}] },
  { id:"map-07-03", title:"FORGE CHAIN", lesson:"Place the first death coordinate so it creates the firing origin for the second.", grammar:["moving-endpoint","airborne-chain","reorientation"], spawn:[-7,2.2,7], goal:[8,1.1,-39], requiredKills:2, platforms:[{center:[-7,0,6],size:[10,1,10]},{center:[8,0,-39],size:[11,1,10]}], enemies:[{id:"m7-3-a",kind:"drifter",position:[0,6,-16],drift:{axis:"x",amplitude:8,speed:0.58}},{id:"m7-3-b",kind:"orbit",position:[5,7,-34],orbit:{plane:"xy",radiusA:5,radiusB:3,speed:0.56,phase:0.9}}] }
];

export const MAP_08_FIELD: RoomSpec[] = [
  {
    id:"sector-08-terminal-vector", title:"TERMINAL VECTOR", lesson:"Nothing new remains. Read, place, chain, cut short, reorient, and survive the whole sentence.",
    grammar:["direct-anchor","stop-short","airborne-chain","origin-matters","route-fork","low-profile","moving-endpoint","reorientation"], spawn:[0,2.2,27], goal:[0,1.1,-202], requiredKills:8,
    platforms:[
      {center:[0,0,25],size:[18,1,16]}, {center:[-12,1,-8],size:[8,1,8]}, {center:[11,5,-29],size:[7,1,7]}, {center:[-9,7,-51],size:[6,1,6]},
      {center:[9,2,-72],size:[8,1,8]}, {center:[0,0,-94],size:[11,1,9]}, {center:[-14,5,-117],size:[7,1,7]}, {center:[14,7,-139],size:[7,1,7]},
      {center:[0,2,-162],size:[10,1,9]}, {center:[0,7,-181],size:[6,1,6]}, {center:[0,0,-201],size:[18,1,14]},
      {center:[5,5,-19],size:[1,10,18]}, {center:[-5,5,-62],size:[1,10,20]}, {center:[6,5,-108],size:[1,10,18]}, {center:[-6,5,-151],size:[1,10,18]}
    ],
    enemies:[
      {id:"terminal-a",kind:"drifter",position:[-12,3.2,-8],drift:{axis:"x",amplitude:4,speed:0.62}},
      {id:"terminal-b",kind:"orbit",position:[5,8,-30],orbit:{plane:"xy",radiusA:8,radiusB:3,speed:0.6}},
      {id:"terminal-c",kind:"drifter",position:[-9,9.2,-52],drift:{axis:"y",amplitude:2.5,speed:0.68}},
      {id:"terminal-d",kind:"sentry",position:[9,4.2,-72]},
      {id:"terminal-e",kind:"orbit",position:[0,6,-95],orbit:{plane:"yz",radiusA:4.5,radiusB:7,speed:0.56,phase:0.8}},
      {id:"terminal-f",kind:"drifter",position:[-14,7.2,-118],drift:{axis:"x",amplitude:4,speed:0.66}},
      {id:"terminal-g",kind:"orbit",position:[8,9,-140],orbit:{plane:"xy",radiusA:8,radiusB:3,speed:0.52,phase:1.3}},
      {id:"terminal-h",kind:"drifter",position:[0,5,-163],drift:{axis:"x",amplitude:7,speed:0.64}},
      {id:"terminal-i",kind:"orbit",position:[0,9,-182],orbit:{plane:"xy",radiusA:9,radiusB:2.5,speed:0.5}},
      {id:"terminal-exit",kind:"sentry",position:[0,2.8,-211]}
    ],
    hazards:[
      {id:"terminal-entry-sweep",kind:"sweep",center:[0,4,-18],size:[0.5,8,24],drift:{axis:"x",amplitude:16,speed:0.3,phase:0.2}},
      {id:"terminal-gate-a",kind:"sightline-gate",center:[0,5,-42],size:[18,10,0.4],cycle:{period:2.7,openFor:1.0}},
      {id:"terminal-cross-x",kind:"sweep",center:[0,5,-106],size:[0.5,10,30],drift:{axis:"x",amplitude:19,speed:0.28,phase:0.4}},
      {id:"terminal-cross-y",kind:"sweep",center:[0,5,-106],size:[30,0.5,22],drift:{axis:"y",amplitude:6,speed:0.25,phase:1.1}},
      {id:"terminal-gate-b",kind:"sightline-gate",center:[0,5,-151],size:[18,10,0.4],cycle:{period:3.0,openFor:1.1,phase:0.7}},
      {id:"terminal-final-sweep",kind:"sweep",center:[0,5,-188],size:[0.5,10,24],drift:{axis:"x",amplitude:17,speed:0.26,phase:0.9}}
    ]
  }
];

export const MAP_08_COURSE: RoomSpec[] = [
  { id:"map-08-01", title:"SENTENCE", lesson:"Chain three different endpoint behaviors without touching ground between ideas.", grammar:["airborne-chain","moving-endpoint","reorientation"], spawn:[-8,2.2,7], goal:[8,1.1,-50], requiredKills:3, platforms:[{center:[-8,0,6],size:[10,1,10]},{center:[8,0,-50],size:[11,1,10]}], enemies:[{id:"m8-1-a",kind:"drifter",position:[-2,6,-16],drift:{axis:"y",amplitude:2.5,speed:0.62}},{id:"m8-1-b",kind:"orbit",position:[4,7,-31],orbit:{plane:"xy",radiusA:6,radiusB:3,speed:0.56}},{id:"m8-1-c",kind:"drifter",position:[8,5,-45],drift:{axis:"x",amplitude:4,speed:0.66}}] },
  { id:"map-08-02", title:"UNDER PRESSURE", lesson:"The solution is familiar. The timing is not forgiving.", grammar:["moving-endpoint","stop-short","route-fork"], spawn:[0,2.2,7], goal:[0,1.1,-43], requiredKills:2, platforms:[{center:[0,0,6],size:[12,1,10]},{center:[-9,2,-14],size:[7,1,7]},{center:[9,3,-27],size:[7,1,7]},{center:[0,0,-43],size:[12,1,10]}], enemies:[{id:"m8-2-a",kind:"drifter",position:[-9,5,-14],drift:{axis:"y",amplitude:2,speed:0.7}},{id:"m8-2-b",kind:"orbit",position:[4,7,-28],orbit:{plane:"xy",radiusA:7,radiusB:3,speed:0.6}},{id:"m8-2-c",kind:"sentry",position:[0,2.8,-49]}], hazards:[{id:"m8-2-s",kind:"sweep",center:[0,4,-22],size:[0.5,8,22],drift:{axis:"x",amplitude:14,speed:0.34}},{id:"m8-2-g",kind:"sightline-gate",center:[0,4,-35],size:[14,8,0.4],cycle:{period:2.7,openFor:0.95}}] },
  { id:"map-08-03", title:"TERMINAL", lesson:"Find one continuous eight-kill solution. No new lesson; only command of the language.", grammar:["direct-anchor","stop-short","airborne-chain","origin-matters","route-fork","moving-endpoint","reorientation"], spawn:[0,2.2,8], goal:[0,1.1,-78], requiredKills:4, platforms:[{center:[0,0,7],size:[13,1,11]},{center:[-9,2,-14],size:[7,1,7]},{center:[8,5,-31],size:[7,1,7]},{center:[-7,3,-49],size:[7,1,7]},{center:[0,0,-77],size:[13,1,10]}], enemies:[{id:"m8-3-a",kind:"drifter",position:[-9,5,-14],drift:{axis:"y",amplitude:2,speed:0.66}},{id:"m8-3-b",kind:"orbit",position:[2,8,-31],orbit:{plane:"xy",radiusA:7,radiusB:3,speed:0.58}},{id:"m8-3-c",kind:"drifter",position:[-7,5,-50],drift:{axis:"x",amplitude:4,speed:0.7}},{id:"m8-3-d",kind:"orbit",position:[0,7,-66],orbit:{plane:"yz",radiusA:4,radiusB:5,speed:0.56,phase:1.0}},{id:"m8-3-e",kind:"sentry",position:[0,2.8,-84]}], hazards:[{id:"m8-3-s",kind:"sweep",center:[0,5,-41],size:[0.5,10,26],drift:{axis:"x",amplitude:15,speed:0.3,phase:0.4}}] }
];
