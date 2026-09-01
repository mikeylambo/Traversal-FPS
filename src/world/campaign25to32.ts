import type { RoomSpec } from "./stages";

function course(field: RoomSpec, index: number): RoomSpec {
  const room = structuredClone(field) as RoomSpec;
  room.id = `map-${index}-mastery-course`;
  room.title = `${field.title} // MASTERY COURSE`;
  room.lesson = "No new verb. Read faster, execute cleaner, and find the route the room does not explain for you.";
  return room;
}

const S25: RoomSpec = {
  id:"sector-25-minimal",title:"MINIMAL",
  lesson:"The room stops teaching. Multiple routes work; mastery is visible in what you leave untouched.",
  grammar:["route-fork","stop-short","reorientation","origin-matters"],
  spawn:[0,2.2,14],goal:[0,1.1,-98],requiredKills:3,
  platforms:[
    {center:[0,0,12],size:[14,1,12]},
    {center:[-12,1,-25],size:[7,1,7]},
    {center:[12,3,-34],size:[7,1,7]},
    {center:[0,1,-63],size:[9,1,8]},
    {center:[0,0,-98],size:[13,1,11]}
  ],
  enemies:[
    {id:"minimal-left",kind:"sentry",position:[-12,4,-25]},
    {id:"minimal-right",kind:"shield",position:[12,6,-34],originConstraint:{axis:"x",max:-3}},
    {id:"minimal-orbit",kind:"orbit",position:[0,8,-50],orbit:{plane:"xz",radiusA:10,radiusB:6,speed:.1}},
    {id:"minimal-mid",kind:"sentry",position:[0,4,-63]},
    {id:"minimal-high",kind:"sentry",position:[12,10,-72]},
    {id:"minimal-final",kind:"sentry",position:[0,3,-100]}
  ]
};

const S26: RoomSpec = {
  id:"sector-26-orbit",title:"ORBIT",
  lesson:"Motion is the frame of reference. Diamond changes the platform cycle; orbiting Spheres decide when it matters.",
  grammar:["moving-endpoint","airborne-chain","origin-matters","reorientation"],
  spawn:[0,2.2,14],goal:[0,1.1,-112],requiredKills:6,
  platforms:[
    {center:[0,0,12],size:[14,1,12]},
    {id:"orbit-lift",center:[-12,-4,-27],size:[8,1,8],motion:{axis:"y",amplitude:9,speed:.08,active:false}},
    {center:[12,4,-54],size:[8,1,8]},
    {center:[-10,3,-84],size:[8,1,8]},
    {center:[0,0,-112],size:[13,1,11]}
  ],
  enemies:[
    {id:"orbit-diamond",kind:"diamond",position:[-4,4,-8],effect:{type:"activate-platform",targetIds:["orbit-lift"]}},
    {id:"orbit-01",kind:"orbit",position:[0,8,-23],orbit:{plane:"xy",radiusA:10,radiusB:4,speed:.13}},
    {id:"orbit-02",kind:"sentry",position:[-12,7,-27]},
    {id:"orbit-03",kind:"orbit",position:[12,8,-54],orbit:{plane:"yz",radiusA:5,radiusB:4,speed:.12,phase:.5}},
    {id:"orbit-04",kind:"shield",position:[-10,6,-84],originConstraint:{axis:"x",min:2}},
    {id:"orbit-05",kind:"drifter",position:[0,8,-97],drift:{axis:"x",amplitude:8,speed:.82}},
    {id:"orbit-06",kind:"sentry",position:[0,3,-114]}
  ]
};

const S27: RoomSpec = {
  id:"sector-27-negative-space",title:"NEGATIVE SPACE",
  lesson:"The route is the safe absence between lethal volumes. Full Warp is usually the wrong answer.",
  grammar:["stop-short","reorientation","timing-chain","route-fork"],
  spawn:[0,2.2,14],goal:[0,1.1,-108],requiredKills:4,
  platforms:[
    {center:[0,0,12],size:[14,1,12]},
    {center:[-10,1,-25],size:[6,1,6]},
    {center:[9,2,-52],size:[6,1,6]},
    {center:[-7,1,-80],size:[6,1,6]},
    {center:[0,0,-108],size:[13,1,11]}
  ],
  enemies:[
    {id:"negative-01",kind:"sentry",position:[-10,5,-32]},
    {id:"negative-02",kind:"orbit",position:[0,8,-54],orbit:{plane:"xy",radiusA:10,radiusB:4,speed:.11}},
    {id:"negative-03",kind:"sentry",position:[-7,5,-80]},
    {id:"negative-04",kind:"sentry",position:[0,3,-110]},
    {id:"negative-secret",kind:"sentry",position:[13,10,-86]}
  ],
  hazards:[
    {id:"negative-a",kind:"lethal-field",center:[0,4,-40],size:[25,8,5],cycle:{period:3.1,openFor:.65}},
    {id:"negative-b",kind:"lethal-field",center:[0,4,-68],size:[25,8,5],cycle:{period:2.8,openFor:.7,phase:.75}},
    {id:"negative-c",kind:"lethal-field",center:[0,4,-93],size:[25,8,4],cycle:{period:2.6,openFor:.56,phase:.25}}
  ]
};

const S28: RoomSpec = {
  id:"sector-28-state",title:"STATE",
  lesson:"Cube changes which version of the room exists. Remember the state you created, not just the Sphere you can see.",
  grammar:["origin-matters","reorientation","route-fork","stop-short"],
  spawn:[-8,2.2,14],goal:[8,1.1,-112],requiredKills:5,
  platforms:[
    {center:[-8,0,12],size:[13,1,12]},
    {center:[11,2,-28],size:[8,1,8]},
    {center:[-11,3,-67],size:[8,1,8]},
    {center:[8,0,-112],size:[13,1,11]}
  ],
  enemies:[
    {id:"state-cube-a",kind:"cube",position:[-4,3,2],effect:{type:"disable-hazard",targetIds:["state-gate-a"]}},
    {id:"state-01",kind:"sentry",position:[11,5,-28]},
    {id:"state-cube-b",kind:"cube",position:[7,6,-39],effect:{type:"disable-hazard",targetIds:["state-gate-b"]}},
    {id:"state-02",kind:"shield",position:[-11,6,-67],originConstraint:{axis:"x",min:3}},
    {id:"state-03",kind:"orbit",position:[0,9,-83],orbit:{plane:"xy",radiusA:9,radiusB:4,speed:.11}},
    {id:"state-04",kind:"sentry",position:[8,6,-98]},
    {id:"state-05",kind:"sentry",position:[8,3,-114]}
  ],
  hazards:[
    {id:"state-gate-a",kind:"sightline-gate",center:[0,5,-11],size:[20,10,.45],cycle:{period:999,openFor:.05,phase:1}},
    {id:"state-gate-b",kind:"sightline-gate",center:[0,5,-52],size:[22,10,.45],cycle:{period:999,openFor:.05,phase:1}}
  ]
};

const S29: RoomSpec = {
  id:"sector-29-circuit",title:"CIRCUIT",
  lesson:"Prisms define which energy corridors exist. Route choice decides which corridor is worth creating.",
  grammar:["route-fork","reorientation","moving-endpoint","timing-chain"],
  spawn:[0,2.2,14],goal:[0,1.1,-118],requiredKills:5,
  platforms:[
    {center:[0,0,12],size:[14,1,12]},
    {center:[-10,1,-25],size:[8,1,8]},
    {center:[10,3,-52],size:[8,1,8]},
    {center:[-9,2,-84],size:[8,1,8]},
    {center:[0,0,-118],size:[13,1,11]}
  ],
  enemies:[
    {id:"circuit-01",kind:"sentry",position:[-10,4,-25]},
    {id:"circuit-prism-a",kind:"prism",position:[-6,6,-36],effect:{type:"shift-aperture",targetIds:["circuit-wall-a"],offset:13}},
    {id:"circuit-02",kind:"orbit",position:[0,8,-46],orbit:{plane:"xz",radiusA:10,radiusB:6,speed:.11}},
    {id:"circuit-03",kind:"sentry",position:[10,6,-52]},
    {id:"circuit-prism-b",kind:"prism",position:[5,7,-67],effect:{type:"shift-aperture",targetIds:["circuit-wall-b"],offset:-13}},
    {id:"circuit-04",kind:"shield",position:[-9,5,-84],originConstraint:{axis:"x",min:2}},
    {id:"circuit-05",kind:"sentry",position:[0,3,-120]}
  ],
  hazards:[
    {id:"circuit-wall-a",kind:"aperture-wall",center:[0,5,-41],size:[25,11,.5],aperture:{axis:"x",center:-8,span:3}},
    {id:"circuit-wall-b",kind:"aperture-wall",center:[0,5,-74],size:[25,11,.5],aperture:{axis:"x",center:8,span:3}},
    {id:"circuit-sweep",kind:"sweep",center:[0,5,-96],size:[.6,10,27],drift:{axis:"x",amplitude:19,speed:.22}}
  ]
};

const S30: RoomSpec = {
  id:"sector-30-kinetic",title:"KINETIC",
  lesson:"Diamonds make platforms into alignment events. Use their motion instead of waiting for it to finish.",
  grammar:["moving-endpoint","airborne-chain","stop-short","reorientation"],
  spawn:[0,2.2,14],goal:[0,1.1,-126],requiredKills:7,
  platforms:[
    {center:[0,0,12],size:[14,1,12]},
    {id:"kinetic-a",center:[-12,-4,-27],size:[7,1,7],motion:{axis:"y",amplitude:9,speed:.09,active:false}},
    {id:"kinetic-b",center:[12,-3,-58],size:[7,1,7],motion:{axis:"y",amplitude:10,speed:.08,phase:.4,active:false}},
    {center:[-10,2,-90],size:[7,1,7]},
    {center:[0,0,-126],size:[13,1,11]}
  ],
  enemies:[
    {id:"kinetic-diamond-a",kind:"diamond",position:[-4,4,-8],effect:{type:"activate-platform",targetIds:["kinetic-a"]}},
    {id:"kinetic-01",kind:"drifter",position:[0,8,-22],drift:{axis:"x",amplitude:11,speed:.9}},
    {id:"kinetic-02",kind:"sentry",position:[-12,7,-27]},
    {id:"kinetic-diamond-b",kind:"diamond",position:[-7,8,-39],effect:{type:"activate-platform",targetIds:["kinetic-b"]}},
    {id:"kinetic-03",kind:"orbit",position:[0,10,-51],orbit:{plane:"xy",radiusA:10,radiusB:4,speed:.12}},
    {id:"kinetic-04",kind:"sentry",position:[12,7,-58]},
    {id:"kinetic-05",kind:"drifter",position:[-10,8,-90],drift:{axis:"y",amplitude:4,speed:.88}},
    {id:"kinetic-06",kind:"sentry",position:[5,6,-108]},
    {id:"kinetic-07",kind:"sentry",position:[0,3,-128]}
  ]
};

const S31: RoomSpec = {
  id:"sector-31-synthesis",title:"SYNTHESIS",
  lesson:"No dominant actor. Read the relationship among Cube, Diamond, Prism, hazards and Spheres before choosing a route.",
  grammar:["route-fork","origin-matters","moving-endpoint","reorientation"],
  spawn:[0,2.2,16],goal:[0,1.1,-138],requiredKills:7,
  platforms:[
    {center:[0,0,14],size:[15,1,13]},
    {id:"synthesis-lift",center:[-11,-4,-27],size:[8,1,8],motion:{axis:"y",amplitude:9,speed:.08,active:false}},
    {center:[11,4,-54],size:[8,1,8]},
    {center:[-10,2,-87],size:[8,1,8]},
    {center:[10,3,-112],size:[8,1,8]},
    {center:[0,0,-138],size:[14,1,11]}
  ],
  enemies:[
    {id:"synthesis-cube",kind:"cube",position:[4,3,4],effect:{type:"disable-hazard",targetIds:["synthesis-gate"]}},
    {id:"synthesis-diamond",kind:"diamond",position:[-4,4,-8],effect:{type:"activate-platform",targetIds:["synthesis-lift"]}},
    {id:"synthesis-01",kind:"drifter",position:[0,8,-22],drift:{axis:"x",amplitude:11,speed:.84}},
    {id:"synthesis-02",kind:"sentry",position:[-11,7,-27]},
    {id:"synthesis-03",kind:"shield",position:[11,7,-54],originConstraint:{axis:"x",max:-3}},
    {id:"synthesis-prism",kind:"prism",position:[7,8,-63],effect:{type:"shift-aperture",targetIds:["synthesis-wall"],offset:14}},
    {id:"synthesis-04",kind:"orbit",position:[0,10,-77],orbit:{plane:"xy",radiusA:9,radiusB:4,speed:.13}},
    {id:"synthesis-05",kind:"sentry",position:[-10,5,-87]},
    {id:"synthesis-06",kind:"drifter",position:[10,7,-112],drift:{axis:"y",amplitude:3,speed:.9}},
    {id:"synthesis-07",kind:"sentry",position:[0,3,-140]},
    {id:"synthesis-alt",kind:"sentry",position:[13,9,-101]}
  ],
  hazards:[
    {id:"synthesis-gate",kind:"sightline-gate",center:[0,4,-4],size:[16,8,.45],cycle:{period:999,openFor:.05,phase:1}},
    {id:"synthesis-sweep",kind:"sweep",center:[0,5,-66],size:[.6,10,29],drift:{axis:"x",amplitude:20,speed:.24}},
    {id:"synthesis-wall",kind:"aperture-wall",center:[0,5,-99],size:[25,11,.5],aperture:{axis:"x",center:-8,span:3.5}}
  ]
};

const S32: RoomSpec = {
  id:"sector-32-vector",title:"VECTOR",
  lesson:"Final examination. The construct is the boss. Transform it, cross it, then write one final clean line.",
  grammar:["stop-short","airborne-chain","moving-endpoint","reorientation"],
  spawn:[0,2.2,18],goal:[0,1.1,-166],requiredKills:8,
  platforms:[
    {center:[0,0,16],size:[16,1,14]},
    {id:"vector-lift",center:[-12,-4,-29],size:[8,1,8],motion:{axis:"y",amplitude:10,speed:.085,active:false}},
    {center:[12,4,-58],size:[8,1,8]},
    {center:[-11,3,-94],size:[8,1,8]},
    {center:[10,2,-126],size:[8,1,8]},
    {center:[0,0,-166],size:[15,1,12]}
  ],
  enemies:[
    {id:"vector-cube",kind:"cube",position:[4,3,6],effect:{type:"disable-hazard",targetIds:["vector-gate"]}},
    {id:"vector-diamond",kind:"diamond",position:[-4,4,-7],effect:{type:"activate-platform",targetIds:["vector-lift"]}},
    {id:"vector-01",kind:"orbit",position:[0,8,-22],orbit:{plane:"xy",radiusA:11,radiusB:4,speed:.13}},
    {id:"vector-02",kind:"sentry",position:[-12,7,-29]},
    {id:"vector-03",kind:"shield",position:[12,7,-58],originConstraint:{axis:"x",max:-3}},
    {id:"vector-prism",kind:"prism",position:[7,8,-68],effect:{type:"shift-aperture",targetIds:["vector-wall"],offset:15}},
    {id:"vector-04",kind:"drifter",position:[0,11,-83],drift:{axis:"y",amplitude:4,speed:.92}},
    {id:"vector-05",kind:"sentry",position:[-11,6,-94]},
    {id:"vector-06",kind:"orbit",position:[10,8,-126],orbit:{plane:"xz",radiusA:8,radiusB:5,speed:.12}},
    {id:"vector-07",kind:"sentry",position:[0,8,-146]},
    {id:"vector-08",kind:"sentry",position:[0,3,-168]}
  ],
  hazards:[
    {id:"vector-gate",kind:"sightline-gate",center:[0,4,-4],size:[17,8,.45],cycle:{period:999,openFor:.05,phase:1}},
    {id:"vector-sweep",kind:"sweep",center:[0,5,-68],size:[.65,11,31],drift:{axis:"x",amplitude:21,speed:.25}},
    {id:"vector-field",kind:"lethal-field",center:[0,5,-111],size:[26,10,3],cycle:{period:2.65,openFor:.72,phase:.35}},
    {id:"vector-wall",kind:"aperture-wall",center:[0,5,-143],size:[27,11,.5],aperture:{axis:"x",center:-9,span:3.5}}
  ]
};

export const MAPS_25_TO_32 = [S25,S26,S27,S28,S29,S30,S31,S32].map((field,i)=>{
  const n=i+25;
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