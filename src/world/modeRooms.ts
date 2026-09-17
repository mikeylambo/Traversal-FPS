import type { RoomSpec } from "./stages";

type V3 = [number, number, number];
type Platform = RoomSpec["platforms"][number];

type RoomOptions = {
  walls?: Platform[];
  lowCeiling?: boolean;
  movingIndex?: number;
  exactKills?: number;
};

const floor = (p:V3, size:V3 = [8,1,8]):Platform => ({ center:p, size });
const wall = (p:V3, size:V3):Platform => ({ center:p, size });

function routeRoom(id:string, title:string, lesson:string, points:V3[], options:RoomOptions = {}):RoomSpec {
  const spawn = points[0]!;
  const goal = points[points.length - 1]!;
  const route = points.slice(1);
  const requiredKills = options.exactKills ?? route.length;
  const platforms:Platform[] = points.map((p, index) => floor(p, index === 0 || index === points.length - 1 ? [12,1,10] : [7,1,7]));
  if (options.lowCeiling) {
    const mid = points[Math.max(1, Math.floor(points.length / 2))]!;
    platforms.push(floor([mid[0], mid[1] + 2.25, mid[2]], [12,.7,10]));
    platforms.push(wall([mid[0] - 6.4, mid[1] + 1.4, mid[2]], [.8,2.8,10]));
    platforms.push(wall([mid[0] + 6.4, mid[1] + 1.4, mid[2]], [.8,2.8,10]));
  }
  if (options.walls) platforms.push(...options.walls);
  if (options.movingIndex !== undefined && platforms[options.movingIndex]) {
    const moving = platforms[options.movingIndex]!;
    moving.id = `${id}-moving`;
    moving.motion = { axis:"y", amplitude:8, speed:.09, active:true };
  }

  return {
    id, title, lesson,
    grammar:["origin-matters","reorientation","stop-short","airborne-chain"],
    spawn:[spawn[0], spawn[1] + 2.2, spawn[2]],
    goal:[goal[0], goal[1] + 1.1, goal[2]],
    requiredKills,
    platforms,
    enemies:route.map((p,index) => ({
      id:`${id}-sphere-${index + 1}`,
      kind:"sentry" as const,
      position:[p[0], p[1] + 3, p[2]] as V3
    }))
  };
}

export const TIME_TRIAL_ROOMS:RoomSpec[] = [
  routeRoom("tt-01","01 // SPRINT","Find one uninterrupted line and keep it.",[[0,0,8],[0,1,-15],[0,0,-38]]),
  routeRoom("tt-02","02 // SWITCHBACK","Speed comes from committing to width instead of correcting late.",[[-8,0,8],[14,2,-10],[-15,4,-28],[16,1,-46],[0,0,-64]]),
  routeRoom("tt-03","03 // DROP","The fastest route is mostly downward.",[[0,18,8],[8,10,-10],[-8,2,-23],[7,-7,-36],[0,-16,-50]]),
  routeRoom("tt-04","04 // CLIMB","Build upward momentum without giving height back.",[[0,0,8],[-7,6,-7],[8,13,-18],[-6,20,-28],[0,27,-40]]),
  routeRoom("tt-05","05 // SLALOM","Thread alternating walls without wasting a correction.",[[0,0,8],[-10,1,-12],[10,2,-28],[-10,3,-44],[10,1,-60],[0,0,-77]],{walls:[wall([0,5,-20],[2,10,18]),wall([0,5,-52],[2,10,18])]}),
  routeRoom("tt-06","06 // LOOP","Complete the circuit and return to the ring.",[[0,0,16],[22,2,8],[25,5,-12],[0,7,-25],[-25,3,-12],[-22,1,8],[0,0,16]]),
  routeRoom("tt-07","07 // SPLIT","The safe lane and the fast lane are not the same lane.",[[0,0,8],[-18,1,-12],[18,7,-18],[-20,2,-40],[20,8,-48],[0,0,-70]]),
  routeRoom("tt-08","08 // RETURN","Drop away from the visible finish, then climb home.",[[0,0,16],[8,-5,0],[-8,-11,-16],[8,-18,-31],[0,-24,-44],[-8,-14,-20],[8,-6,0],[0,0,16]]),
  routeRoom("tt-09","09 // SHAFT","A narrow footprint hides a fifty-meter race.",[[0,24,4],[6,16,-5],[-6,8,-9],[5,0,-4],[-5,-9,-10],[5,-18,-5],[0,-26,-8]]),
  routeRoom("tt-10","10 // CROSS","Choose branch order without crossing your own dead space.",[[0,0,0],[-24,2,0],[0,6,-24],[24,1,0],[0,-4,24],[0,0,0]]),
  routeRoom("tt-11","11 // INTERCEPT","Meet moving geometry instead of waiting for it.",[[0,0,8],[-10,-4,-12],[10,5,-30],[-8,-3,-48],[8,6,-64],[0,0,-82]],{movingIndex:1}),
  routeRoom("tt-12","12 // UNDERPASS","The crouched line is the racing line.",[[0,0,8],[0,0,-18],[12,2,-35],[-12,3,-52],[0,0,-70]],{lowCeiling:true}),
  routeRoom("tt-13","13 // CURRENT","Wide alternation rewards early reads and full commitment.",[[0,0,8],[-28,2,-10],[30,6,-25],[-30,1,-43],[28,7,-58],[0,0,-78]]),
  routeRoom("tt-14","14 // FREEFALL","Spend targets while altitude disappears beneath you.",[[0,30,8],[10,20,-6],[-10,9,-18],[10,-3,-30],[-10,-16,-42],[0,-28,-55]]),
  routeRoom("tt-15","15 // KINETIC","Moving platforms are shortcuts, not elevators.",[[0,0,8],[-12,-5,-14],[12,-4,-33],[-10,5,-52],[10,-6,-70],[0,0,-88]],{movingIndex:1}),
  routeRoom("tt-16","16 // ORBITAL","Race the perimeter instead of the center line.",[[0,0,20],[24,3,12],[32,6,-8],[20,2,-30],[0,8,-40],[-20,1,-30],[-32,5,-8],[-24,2,12],[0,0,20]]),
  routeRoom("tt-17","17 // OVERDRIVE","Two stacked routes keep swapping which one is shorter.",[[0,0,8],[-10,10,-8],[10,0,-22],[-10,12,-36],[10,1,-50],[0,14,-66]]),
  routeRoom("tt-18","18 // TRAVERSAL","Championship course: width, height, return logic and one low line.",[[0,0,18],[-26,2,2],[20,12,-18],[-18,-8,-38],[0,-18,-56],[24,-4,-38],[-20,10,-18],[0,20,0],[0,0,18]],{lowCeiling:true})
];

export const CHALLENGE_ROOMS:RoomSpec[] = [
  routeRoom("challenge-01","01 // ONE LINE","One Sphere. One shot. One vector.",[[0,0,8],[0,0,-24]],{exactKills:1}),
  routeRoom("challenge-02","02 // LOW SHOT","The only readable firing line is crouched.",[[0,0,8],[0,0,-28]],{lowCeiling:true,exactKills:1}),
  routeRoom("challenge-03","03 // SIDE ORIGIN","Change sides before you spend the destination.",[[-10,0,8],[10,0,-22],[0,0,-42]],{walls:[wall([0,5,-8],[2,10,24])]}),
  routeRoom("challenge-04","04 // THREE SHOTS","Three required Spheres. No waste.",[[0,0,8],[-10,2,-12],[10,4,-28],[0,0,-45]],{exactKills:3}),
  routeRoom("challenge-05","05 // RETURN TOKEN","The ring begins under your feet; earn the right to use it.",[[0,0,12],[16,3,0],[0,-5,-18],[-16,6,0],[0,0,12]],{exactKills:4}),
  routeRoom("challenge-06","06 // HIGH / LOW","Alternate above and below the starting plane.",[[0,0,8],[-8,9,-8],[8,-7,-20],[-8,12,-32],[8,-10,-44],[0,0,-58]]),
  routeRoom("challenge-07","07 // WALL SENTENCE","Every direct-looking line is illegal.",[[-16,0,8],[16,2,-10],[-16,5,-28],[16,1,-46],[0,0,-64]],{walls:[wall([0,6,-1],[2,12,24]),wall([0,6,-37],[2,12,24])]}),
  routeRoom("challenge-08","08 // HUB ORDER","All spokes are valid; the clean order is the puzzle.",[[0,0,0],[-20,1,0],[0,6,-20],[20,2,0],[0,-5,20],[0,0,0]],{exactKills:5}),
  routeRoom("challenge-09","09 // CROUCH RETURN","Leave standing. Return crouched.",[[0,0,12],[12,3,-8],[-12,6,-25],[0,0,-42]],{lowCeiling:true}),
  routeRoom("challenge-10","10 // SHORT FALL","The useful landing is above the target's full endpoint.",[[0,12,8],[8,4,-12],[-8,-5,-27],[0,-12,-42]]),
  routeRoom("challenge-11","11 // WIDE READ","The room tests angle, not distance.",[[0,0,8],[-30,2,-10],[30,5,-20],[-28,8,-36],[28,-2,-48],[0,0,-65]]),
  routeRoom("challenge-12","12 // MOVING ORIGIN","Commit from geometry that will not remain where you found it.",[[0,0,8],[-10,-4,-14],[10,5,-32],[0,0,-52]],{movingIndex:1}),
  routeRoom("challenge-13","13 // SPLIT LEVEL","Upper and lower origins solve different halves.",[[-10,0,8],[10,10,-8],[-10,0,-24],[10,12,-40],[0,0,-58]]),
  routeRoom("challenge-14","14 // SHAFT MEMORY","Your next Sphere is rarely in front of you.",[[0,22,4],[6,14,-5],[-6,5,-10],[5,-4,-3],[-5,-13,-10],[0,-22,-8]]),
  routeRoom("challenge-15","15 // LOCKED VIEW","Move first; shooting first is the mistake.",[[-12,0,8],[12,2,-22],[-12,4,-42],[0,0,-60]],{walls:[wall([0,5,-8],[2,10,26])]}),
  routeRoom("challenge-16","16 // CLEAN LOOP","Close the loop without an extra Sphere.",[[0,0,16],[20,2,8],[24,5,-10],[0,7,-24],[-24,3,-10],[-20,1,8],[0,0,16]],{exactKills:6}),
  routeRoom("challenge-17","17 // LOW MAZE","Three low firing windows, no standing solution.",[[0,0,8],[0,0,-16],[-10,1,-32],[10,2,-48],[0,0,-64]],{lowCeiling:true}),
  routeRoom("challenge-18","18 // VOID STEPS","Sparse platforms punish automatic full warps.",[[0,0,12],[-18,5,-20],[20,-4,-54],[-16,10,-88],[0,0,-124]]),
  routeRoom("challenge-19","19 // CROSS ORDER","Four branches; only route economy separates a clean solve.",[[0,0,0],[-24,3,0],[0,-6,24],[24,8,0],[0,12,-24],[0,0,0]],{exactKills:5}),
  routeRoom("challenge-20","20 // DOUBLE BACK","The next useful origin is behind the one you just earned.",[[0,0,10],[16,4,-10],[-18,8,-26],[14,0,-42],[-12,-6,-24],[0,0,-58]]),
  routeRoom("challenge-21","21 // OVER / UNDER","Change floors twice and crouch once.",[[-10,0,8],[10,10,-10],[-10,0,-28],[10,12,-46],[0,0,-64]],{lowCeiling:true}),
  routeRoom("challenge-22","22 // STATE ROUTE","A late-game logic room should demand a route commitment, not a straight clear.",[[0,0,8],[-18,2,-12],[18,6,-30],[-16,-4,-48],[16,9,-66],[0,0,-84]],{walls:[wall([0,5,-22],[2,10,28])]}),
  routeRoom("challenge-23","23 // KINETIC LINE","Use a moving platform as a temporary firing origin.",[[0,0,8],[-12,-5,-16],[12,7,-34],[-10,-4,-52],[0,0,-70]],{movingIndex:1}),
  routeRoom("challenge-24","24 // FULL SENTENCE","Crouch, climb, cross width, respect walls, return to the visible ring.",[[0,0,16],[-24,0,0],[18,10,-20],[-16,-8,-40],[0,-18,-56],[20,-2,-38],[-18,14,-18],[0,22,0],[0,0,16]],{lowCeiling:true,walls:[wall([0,6,-8],[2,12,28])],exactKills:8})
];
