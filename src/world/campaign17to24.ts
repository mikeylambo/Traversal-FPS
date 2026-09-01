import type { RoomSpec } from "./stages";

function course(field: RoomSpec, index: number): RoomSpec {
  const room = structuredClone(field) as RoomSpec;
  room.id = `map-${index}-pressure-course`;
  room.title = `${field.title} // PRESSURE COURSE`;
  room.lesson = "Campaign asks for the solution. Time Trial asks for flow. Challenge asks for exactness under pressure.";
  return room;
}

const S17: RoomSpec = {
  id: "sector-17-pulse", title: "PULSE",
  lesson: "The field is part of the timing equation. A correct vector fired at the wrong phase is still wrong.",
  grammar: ["moving-endpoint","stop-short","timing-chain"],
  spawn: [0,2.2,14], goal: [0,1.1,-96], requiredKills: 5,
  platforms: [
    { center:[0,0,12], size:[14,1,12] },
    { center:[-10,1,-21], size:[8,1,8] },
    { center:[10,2,-48], size:[8,1,8] },
    { center:[-8,2,-74], size:[8,1,8] },
    { center:[0,0,-96], size:[13,1,11] }
  ],
  enemies: [
    { id:"pulse-01", kind:"drifter", position:[0,6,-20], drift:{axis:"x",amplitude:11,speed:.82} },
    { id:"pulse-02", kind:"sentry", position:[-10,4,-21] },
    { id:"pulse-03", kind:"orbit", position:[0,8,-56], orbit:{plane:"xy",radiusA:9,radiusB:4,speed:.11} },
    { id:"pulse-04", kind:"sentry", position:[-8,5,-74] },
    { id:"pulse-05", kind:"sentry", position:[0,3,-98] }
  ],
  hazards: [
    { id:"pulse-field-a", kind:"lethal-field", center:[0,4,-36], size:[24,9,2], cycle:{period:3.1,openFor:1.05} },
    { id:"pulse-field-b", kind:"lethal-field", center:[0,4,-84], size:[24,9,2], cycle:{period:2.7,openFor:.8,phase:.65} }
  ]
};

const S18: RoomSpec = {
  id:"sector-18-sweep", title:"SWEEP",
  lesson:"Use Warp to leave the hazard plane. Reacquire before gravity puts you back into it.",
  grammar:["airborne-chain","reorientation","timing-chain"],
  spawn:[-7,2.2,14], goal:[0,1.1,-102], requiredKills:6,
  platforms:[
    {center:[-7,0,12],size:[13,1,12]},
    {center:[10,2,-22],size:[7,1,7]},
    {center:[-10,3,-50],size:[7,1,7]},
    {center:[9,1,-77],size:[7,1,7]},
    {center:[0,0,-102],size:[13,1,11]}
  ],
  enemies:[
    {id:"sweep-01",kind:"sentry",position:[8,9,-13]},
    {id:"sweep-02",kind:"sentry",position:[10,6,-22]},
    {id:"sweep-03",kind:"drifter",position:[0,10,-40],drift:{axis:"x",amplitude:10,speed:.9}},
    {id:"sweep-04",kind:"sentry",position:[-10,7,-50]},
    {id:"sweep-05",kind:"orbit",position:[9,8,-77],orbit:{plane:"yz",radiusA:5,radiusB:4,speed:.12}},
    {id:"sweep-06",kind:"sentry",position:[0,3,-104]}
  ],
  hazards:[
    {id:"sweep-a",kind:"sweep",center:[0,4,-34],size:[.6,9,28],drift:{axis:"x",amplitude:19,speed:.24}},
    {id:"sweep-b",kind:"sweep",center:[0,6,-67],size:[27,.6,2],drift:{axis:"y",amplitude:5,speed:.21,phase:.5}}
  ]
};

const S19: RoomSpec = {
  id:"sector-19-collapse", title:"COMMITMENT",
  lesson:"Cube removes the safe old state. Once you commit, solve from the geometry you created.",
  grammar:["origin-matters","reorientation","route-fork","stop-short"],
  spawn:[0,2.2,14],goal:[0,1.1,-98],requiredKills:5,
  platforms:[
    {center:[0,0,12],size:[14,1,12]},
    {center:[-10,1,-23],size:[8,1,8]},
    {center:[10,3,-48],size:[8,1,8]},
    {center:[-8,2,-73],size:[8,1,8]},
    {center:[0,0,-98],size:[13,1,11]}
  ],
  enemies:[
    {id:"commit-cube",kind:"cube",position:[4,3,2],effect:{type:"disable-hazard",targetIds:["commit-gate"]}},
    {id:"commit-01",kind:"sentry",position:[-10,4,-23]},
    {id:"commit-02",kind:"shield",position:[10,6,-48],originConstraint:{axis:"x",max:-3}},
    {id:"commit-03",kind:"orbit",position:[0,8,-64],orbit:{plane:"xz",radiusA:9,radiusB:5,speed:.1}},
    {id:"commit-04",kind:"sentry",position:[-8,5,-73]},
    {id:"commit-05",kind:"sentry",position:[0,3,-100]}
  ],
  hazards:[
    {id:"commit-gate",kind:"sightline-gate",center:[0,4,-5],size:[16,8,.45],cycle:{period:999,openFor:.05,phase:1}},
    {id:"commit-sweep",kind:"sweep",center:[0,5,-79],size:[.6,10,25],drift:{axis:"x",amplitude:18,speed:.2}}
  ]
};

const S20: RoomSpec = {
  id:"sector-20-current",title:"CURRENT",
  lesson:"Prism creates the energy corridor. Stop Short chooses the survivable point inside it.",
  grammar:["stop-short","moving-endpoint","timing-chain","reorientation"],
  spawn:[0,2.2,14],goal:[0,1.1,-106],requiredKills:5,
  platforms:[
    {center:[0,0,12],size:[14,1,12]},
    {center:[-9,1,-21],size:[8,1,8]},
    {center:[10,2,-49],size:[8,1,8]},
    {center:[-8,2,-79],size:[8,1,8]},
    {center:[0,0,-106],size:[13,1,11]}
  ],
  enemies:[
    {id:"current-01",kind:"sentry",position:[-9,4,-21]},
    {id:"current-02",kind:"drifter",position:[0,8,-43],drift:{axis:"x",amplitude:11,speed:.76}},
    {id:"current-prism",kind:"prism",position:[7,7,-53],effect:{type:"shift-aperture",targetIds:["current-aperture"],offset:13}},
    {id:"current-03",kind:"sentry",position:[10,5,-49]},
    {id:"current-04",kind:"orbit",position:[-8,7,-79],orbit:{plane:"xy",radiusA:7,radiusB:3.5,speed:.12}},
    {id:"current-05",kind:"sentry",position:[0,3,-108]}
  ],
  hazards:[
    {id:"current-aperture",kind:"aperture-wall",center:[0,5,-62],size:[25,11,.5],aperture:{axis:"x",center:-8,span:3}},
    {id:"current-field",kind:"lethal-field",center:[0,4,-90],size:[24,8,2],cycle:{period:2.8,openFor:.82,phase:.4}}
  ]
};

const S21: RoomSpec = {
  id:"sector-21-counterweight",title:"COUNTERWEIGHT",
  lesson:"Diamond turns a static route into moving geometry. The safest activation is not always the cleanest route.",
  grammar:["route-fork","origin-matters","moving-endpoint","reorientation"],
  spawn:[0,2.2,14],goal:[0,1.1,-106],requiredKills:5,
  platforms:[
    {center:[0,0,12],size:[14,1,12]},
    {id:"counter-lift",center:[-11,-4,-25],size:[9,1,9],motion:{axis:"y",amplitude:9,speed:.075,active:false}},
    {center:[11,3,-52],size:[8,1,8]},
    {center:[-10,2,-80],size:[8,1,8]},
    {center:[0,0,-106],size:[13,1,11]}
  ],
  enemies:[
    {id:"counter-diamond",kind:"diamond",position:[-4,4,-8],effect:{type:"activate-platform",targetIds:["counter-lift"]}},
    {id:"counter-01",kind:"sentry",position:[-11,6,-25]},
    {id:"counter-02",kind:"drifter",position:[0,8,-42],drift:{axis:"x",amplitude:10,speed:.7}},
    {id:"counter-03",kind:"shield",position:[11,6,-52],originConstraint:{axis:"x",max:-3}},
    {id:"counter-04",kind:"sentry",position:[-10,5,-80]},
    {id:"counter-05",kind:"sentry",position:[0,3,-108]},
    {id:"counter-recovery",kind:"sentry",position:[12,5,-76]}
  ]
};

const S22: RoomSpec = {
  id:"sector-22-blindside",title:"BLINDSIDE",
  lesson:"The next target exists only when sightline, motion and hazard phase agree.",
  grammar:["airborne-chain","moving-endpoint","reorientation","timing-chain"],
  spawn:[-8,2.2,14],goal:[8,1.1,-108],requiredKills:6,
  platforms:[
    {center:[-8,0,12],size:[13,1,12]},
    {center:[10,2,-25],size:[7,1,7]},
    {center:[-10,3,-56],size:[7,1,7]},
    {center:[9,2,-84],size:[7,1,7]},
    {center:[8,0,-108],size:[13,1,11]}
  ],
  enemies:[
    {id:"blind-cube",kind:"cube",position:[-4,3,2],effect:{type:"disable-hazard",targetIds:["blind-gate"]}},
    {id:"blind-01",kind:"sentry",position:[10,8,-18]},
    {id:"blind-02",kind:"drifter",position:[0,10,-40],drift:{axis:"x",amplitude:10,speed:.95}},
    {id:"blind-03",kind:"sentry",position:[-10,7,-56]},
    {id:"blind-04",kind:"orbit",position:[0,9,-72],orbit:{plane:"xy",radiusA:9,radiusB:4,speed:.13}},
    {id:"blind-05",kind:"sentry",position:[9,5,-84]},
    {id:"blind-06",kind:"sentry",position:[8,3,-110]}
  ],
  hazards:[
    {id:"blind-gate",kind:"sightline-gate",center:[0,5,-9],size:[18,10,.45],cycle:{period:999,openFor:.05,phase:1}},
    {id:"blind-sweep",kind:"sweep",center:[0,5,-66],size:[.6,10,28],drift:{axis:"x",amplitude:19,speed:.24}}
  ]
};

const S23: RoomSpec = {
  id:"sector-23-pursuit",title:"PURSUIT",
  lesson:"Routes expire. Choose the moving Sphere that leaves the next useful vector available.",
  grammar:["moving-endpoint","route-fork","timing-chain","stop-short"],
  spawn:[0,2.2,14],goal:[0,1.1,-112],requiredKills:5,
  platforms:[
    {center:[0,0,12],size:[14,1,12]},
    {center:[-12,1,-28],size:[7,1,7]},
    {center:[12,2,-56],size:[7,1,7]},
    {center:[0,1,-84],size:[9,1,8]},
    {center:[0,0,-112],size:[13,1,11]}
  ],
  enemies:[
    {id:"pursuit-a",kind:"drifter",position:[-4,7,-24],drift:{axis:"x",amplitude:10,speed:.98}},
    {id:"pursuit-b",kind:"orbit",position:[4,9,-47],orbit:{plane:"xz",radiusA:10,radiusB:7,speed:.12}},
    {id:"pursuit-c",kind:"drifter",position:[0,8,-72],drift:{axis:"y",amplitude:4,speed:.9}},
    {id:"pursuit-safe",kind:"sentry",position:[-12,4,-56]},
    {id:"pursuit-greedy",kind:"sentry",position:[12,5,-80]},
    {id:"pursuit-final",kind:"sentry",position:[0,3,-114]}
  ],
  hazards:[{id:"pursuit-sweep",kind:"sweep",center:[0,5,-67],size:[.6,10,30],drift:{axis:"x",amplitude:20,speed:.22}}]
};

const S24: RoomSpec = {
  id:"sector-24-pressure",title:"PRESSURE",
  lesson:"Act III exam. State, motion, aperture and hazards all compete for your attention. Keep the route sentence intact.",
  grammar:["airborne-chain","moving-endpoint","reorientation","timing-chain"],
  spawn:[0,2.2,16],goal:[0,1.1,-136],requiredKills:7,
  platforms:[
    {center:[0,0,14],size:[15,1,13]},
    {id:"pressure-lift",center:[-12,-4,-25],size:[8,1,8],motion:{axis:"y",amplitude:9,speed:.08,active:false}},
    {center:[12,4,-52],size:[8,1,8]},
    {center:[-10,2,-83],size:[8,1,8]},
    {center:[10,3,-108],size:[8,1,8]},
    {center:[0,0,-136],size:[14,1,11]}
  ],
  enemies:[
    {id:"pressure-cube",kind:"cube",position:[4,3,4],effect:{type:"disable-hazard",targetIds:["pressure-gate"]}},
    {id:"pressure-diamond",kind:"diamond",position:[-4,4,-8],effect:{type:"activate-platform",targetIds:["pressure-lift"]}},
    {id:"pressure-01",kind:"drifter",position:[0,8,-21],drift:{axis:"x",amplitude:11,speed:.84}},
    {id:"pressure-02",kind:"sentry",position:[-12,7,-25]},
    {id:"pressure-03",kind:"shield",position:[12,7,-52],originConstraint:{axis:"x",max:-3}},
    {id:"pressure-prism",kind:"prism",position:[7,8,-61],effect:{type:"shift-aperture",targetIds:["pressure-aperture"],offset:14}},
    {id:"pressure-04",kind:"orbit",position:[0,10,-74],orbit:{plane:"xy",radiusA:9,radiusB:4,speed:.13}},
    {id:"pressure-05",kind:"sentry",position:[-10,5,-83]},
    {id:"pressure-06",kind:"drifter",position:[10,7,-108],drift:{axis:"y",amplitude:3,speed:.86}},
    {id:"pressure-07",kind:"sentry",position:[0,3,-138]}
  ],
  hazards:[
    {id:"pressure-gate",kind:"sightline-gate",center:[0,4,-4],size:[16,8,.45],cycle:{period:999,openFor:.05,phase:1}},
    {id:"pressure-sweep",kind:"sweep",center:[0,5,-64],size:[.6,10,29],drift:{axis:"x",amplitude:20,speed:.25}},
    {id:"pressure-aperture",kind:"aperture-wall",center:[0,5,-96],size:[25,11,.5],aperture:{axis:"x",center:-8,span:3.5}},
    {id:"pressure-field",kind:"lethal-field",center:[0,4,-119],size:[24,8,2],cycle:{period:2.7,openFor:.75,phase:.5}}
  ]
};

export const MAPS_17_TO_24 = [S17,S18,S19,S20,S21,S22,S23,S24].map((field,i)=>{
  const n=i+17;
  return {
    id:`map-${n}`,
    label:`SECTOR ${String(n).padStart(2,"0")} // ${field.title}`,
    subtitle:field.lesson,
    focus:field.grammar,
    implemented:true,
    campaignRooms:[field],
    courseRooms:[course(field,n)]
  };
});