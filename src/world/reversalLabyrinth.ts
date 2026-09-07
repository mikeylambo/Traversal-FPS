import type { RoomSpec } from "./stages";

/**
 * THE REVERSE // postgame labyrinth
 *
 * This is not the Campaign played backwards. Each chamber is authored from
 * scratch around the fiction that the player has crossed to the hidden side of
 * the Construct and is now moving back through machinery that was never built
 * to be approached from this direction.
 *
 * The suite deliberately assumes full Campaign literacy: no new verbs, no
 * tutorial pacing, and no obligation to present the intended route head-on.
 */
export const REVERSAL_LABYRINTH_ROOMS: RoomSpec[] = [
  {
    id: "reverse-01-backside",
    title: "THE BACKSIDE",
    lesson: "The Construct has another face. Read what used to be scenery as route geometry.",
    grammar: ["reorientation", "origin-matters", "stop-short"],
    spawn: [0, 2.2, 16],
    goal: [0, 1.1, -102],
    requiredKills: 5,
    platforms: [
      { center: [0, 0, 14], size: [15, 1, 13] },
      { center: [11, 4, -20], size: [7, 1, 7] },
      { center: [-12, 7, -44], size: [7, 1, 7] },
      { center: [8, 3, -70], size: [7, 1, 7] },
      { center: [0, 0, -102], size: [14, 1, 12] }
    ],
    enemies: [
      { id: "reverse01-a", kind: "sentry", position: [11, 7, -20] },
      { id: "reverse01-b", kind: "shield", position: [-12, 10, -44], originConstraint: { axis: "x", min: 2 } },
      { id: "reverse01-c", kind: "drifter", position: [0, 12, -58], drift: { axis: "x", amplitude: 10, speed: .9 } },
      { id: "reverse01-d", kind: "sentry", position: [8, 6, -70] },
      { id: "reverse01-e", kind: "sentry", position: [0, 3, -104] }
    ],
    hazards: [
      { id: "reverse01-wall", kind: "aperture-wall", center: [0, 6, -32], size: [28, 13, .5], aperture: { axis: "x", center: 8, span: 3.2 } }
    ]
  },
  {
    id: "reverse-02-undercarriage",
    title: "UNDERCARRIAGE",
    lesson: "What carried you before is overhead now. Build the route from underneath it.",
    grammar: ["moving-endpoint", "airborne-chain", "reorientation"],
    spawn: [0, 2.2, 14],
    goal: [-10, 1.1, -112],
    requiredKills: 6,
    platforms: [
      { center: [0, 0, 12], size: [14, 1, 12] },
      { id: "reverse02-lift", center: [10, -6, -28], size: [7, 1, 7], motion: { axis: "y", amplitude: 13, speed: .085, active: false } },
      { center: [-11, 6, -57], size: [7, 1, 7] },
      { center: [12, 10, -82], size: [6, 1, 6] },
      { center: [-10, 0, -112], size: [12, 1, 10] }
    ],
    enemies: [
      { id: "reverse02-diamond", kind: "diamond", position: [-5, 4, -7], effect: { type: "activate-platform", targetIds: ["reverse02-lift"] } },
      { id: "reverse02-a", kind: "orbit", position: [0, 8, -22], orbit: { plane: "xy", radiusA: 10, radiusB: 4, speed: .13 } },
      { id: "reverse02-b", kind: "sentry", position: [10, 8, -28] },
      { id: "reverse02-c", kind: "sentry", position: [-11, 9, -57] },
      { id: "reverse02-d", kind: "drifter", position: [12, 12, -82], drift: { axis: "y", amplitude: 4, speed: .92 } },
      { id: "reverse02-e", kind: "sentry", position: [0, 8, -96] },
      { id: "reverse02-f", kind: "sentry", position: [-10, 3, -114] }
    ],
    hazards: [
      { id: "reverse02-sweep", kind: "sweep", center: [0, 6, -69], size: [.6, 12, 31], drift: { axis: "x", amplitude: 20, speed: .23 } }
    ]
  },
  {
    id: "reverse-03-service-gap",
    title: "SERVICE GAP",
    lesson: "The safe route is not a corridor. It is the maintenance absence between systems.",
    grammar: ["stop-short", "timing-chain", "route-fork", "reorientation"],
    spawn: [0, 2.2, 14],
    goal: [0, 1.1, -118],
    requiredKills: 5,
    platforms: [
      { center: [0, 0, 12], size: [14, 1, 12] },
      { center: [-12, 2, -30], size: [6, 1, 6] },
      { center: [12, 5, -59], size: [6, 1, 6] },
      { center: [-8, 2, -88], size: [6, 1, 6] },
      { center: [0, 0, -118], size: [13, 1, 11] }
    ],
    enemies: [
      { id: "reverse03-a", kind: "sentry", position: [-12, 6, -30] },
      { id: "reverse03-b", kind: "orbit", position: [0, 10, -48], orbit: { plane: "xz", radiusA: 11, radiusB: 6, speed: .12 } },
      { id: "reverse03-c", kind: "sentry", position: [12, 8, -59] },
      { id: "reverse03-d", kind: "shield", position: [-8, 6, -88], originConstraint: { axis: "x", max: -2 } },
      { id: "reverse03-e", kind: "sentry", position: [0, 3, -120] }
    ],
    hazards: [
      { id: "reverse03-field-a", kind: "lethal-field", center: [0, 5, -42], size: [27, 10, 4], cycle: { period: 2.8, openFor: .62 } },
      { id: "reverse03-field-b", kind: "lethal-field", center: [0, 7, -76], size: [27, 14, 4], cycle: { period: 2.55, openFor: .55, phase: .55 } },
      { id: "reverse03-field-c", kind: "lethal-field", center: [0, 5, -101], size: [27, 10, 3], cycle: { period: 2.35, openFor: .5, phase: .2 } }
    ]
  },
  {
    id: "reverse-04-control-side",
    title: "CONTROL SIDE",
    lesson: "You are behind the panel now. Change the machine before crossing the space it used to control.",
    grammar: ["origin-matters", "route-fork", "reorientation", "stop-short"],
    spawn: [-8, 2.2, 15],
    goal: [9, 1.1, -124],
    requiredKills: 6,
    platforms: [
      { center: [-8, 0, 13], size: [13, 1, 12] },
      { center: [11, 3, -28], size: [8, 1, 8] },
      { center: [-11, 5, -68], size: [8, 1, 8] },
      { center: [9, 2, -96], size: [7, 1, 7] },
      { center: [9, 0, -124], size: [13, 1, 11] }
    ],
    enemies: [
      { id: "reverse04-cube-a", kind: "cube", position: [-3, 4, 3], effect: { type: "disable-hazard", targetIds: ["reverse04-gate-a"] } },
      { id: "reverse04-a", kind: "sentry", position: [11, 6, -28] },
      { id: "reverse04-prism", kind: "prism", position: [7, 8, -43], effect: { type: "shift-aperture", targetIds: ["reverse04-wall"], offset: -14 } },
      { id: "reverse04-b", kind: "orbit", position: [0, 10, -57], orbit: { plane: "xy", radiusA: 10, radiusB: 4, speed: .13 } },
      { id: "reverse04-c", kind: "shield", position: [-11, 8, -68], originConstraint: { axis: "x", min: 3 } },
      { id: "reverse04-d", kind: "drifter", position: [9, 7, -96], drift: { axis: "y", amplitude: 3.5, speed: .9 } },
      { id: "reverse04-e", kind: "sentry", position: [0, 8, -110] },
      { id: "reverse04-f", kind: "sentry", position: [9, 3, -126] }
    ],
    hazards: [
      { id: "reverse04-gate-a", kind: "sightline-gate", center: [0, 5, -11], size: [20, 10, .45], cycle: { period: 999, openFor: .05, phase: 1 } },
      { id: "reverse04-wall", kind: "aperture-wall", center: [0, 6, -82], size: [28, 13, .5], aperture: { axis: "x", center: 8, span: 3.2 } }
    ]
  },
  {
    id: "reverse-05-false-exterior",
    title: "FALSE EXTERIOR",
    lesson: "It looks open again. It is not. The exterior is another chamber with fewer walls.",
    grammar: ["moving-endpoint", "timing-chain", "airborne-chain", "stop-short"],
    spawn: [0, 2.2, 16],
    goal: [0, 1.1, -136],
    requiredKills: 7,
    platforms: [
      { center: [0, 0, 14], size: [15, 1, 13] },
      { center: [-14, 5, -31], size: [7, 1, 7] },
      { center: [13, 9, -61], size: [7, 1, 7] },
      { center: [-12, 4, -95], size: [7, 1, 7] },
      { center: [0, 0, -136], size: [14, 1, 11] }
    ],
    enemies: [
      { id: "reverse05-a", kind: "drifter", position: [0, 9, -21], drift: { axis: "x", amplitude: 13, speed: .95 } },
      { id: "reverse05-b", kind: "sentry", position: [-14, 8, -31] },
      { id: "reverse05-c", kind: "orbit", position: [0, 13, -50], orbit: { plane: "xy", radiusA: 12, radiusB: 5, speed: .14 } },
      { id: "reverse05-d", kind: "sentry", position: [13, 12, -61] },
      { id: "reverse05-e", kind: "drifter", position: [-12, 9, -95], drift: { axis: "y", amplitude: 4, speed: .96 } },
      { id: "reverse05-f", kind: "orbit", position: [0, 10, -116], orbit: { plane: "xz", radiusA: 9, radiusB: 5, speed: .13 } },
      { id: "reverse05-g", kind: "sentry", position: [0, 3, -138] }
    ],
    hazards: [
      { id: "reverse05-sweep-a", kind: "sweep", center: [0, 7, -76], size: [.65, 14, 35], drift: { axis: "x", amplitude: 23, speed: .25 } },
      { id: "reverse05-field", kind: "lethal-field", center: [0, 6, -111], size: [31, 12, 3], cycle: { period: 2.5, openFor: .58, phase: .4 } }
    ]
  },
  {
    id: "reverse-06-memory",
    title: "MEMORY",
    lesson: "The shapes are familiar. Their relationships are not. Do not solve the room you remember.",
    grammar: ["route-fork", "origin-matters", "moving-endpoint", "reorientation"],
    spawn: [0, 2.2, 16],
    goal: [-9, 1.1, -144],
    requiredKills: 7,
    platforms: [
      { center: [0, 0, 14], size: [15, 1, 13] },
      { id: "reverse06-lift", center: [12, -5, -30], size: [7, 1, 7], motion: { axis: "y", amplitude: 12, speed: .09, active: false } },
      { center: [-12, 6, -62], size: [7, 1, 7] },
      { center: [11, 3, -98], size: [7, 1, 7] },
      { center: [-9, 0, -144], size: [13, 1, 11] }
    ],
    enemies: [
      { id: "reverse06-cube", kind: "cube", position: [4, 4, 3], effect: { type: "disable-hazard", targetIds: ["reverse06-gate"] } },
      { id: "reverse06-diamond", kind: "diamond", position: [-4, 5, -9], effect: { type: "activate-platform", targetIds: ["reverse06-lift"] } },
      { id: "reverse06-a", kind: "orbit", position: [0, 10, -23], orbit: { plane: "xy", radiusA: 11, radiusB: 4, speed: .14 } },
      { id: "reverse06-b", kind: "sentry", position: [12, 8, -30] },
      { id: "reverse06-c", kind: "shield", position: [-12, 9, -62], originConstraint: { axis: "x", max: -3 } },
      { id: "reverse06-prism", kind: "prism", position: [-7, 10, -77], effect: { type: "shift-aperture", targetIds: ["reverse06-wall"], offset: 15 } },
      { id: "reverse06-d", kind: "drifter", position: [11, 8, -98], drift: { axis: "y", amplitude: 4, speed: .95 } },
      { id: "reverse06-e", kind: "orbit", position: [0, 11, -118], orbit: { plane: "xz", radiusA: 10, radiusB: 6, speed: .13 } },
      { id: "reverse06-f", kind: "sentry", position: [5, 8, -132] },
      { id: "reverse06-g", kind: "sentry", position: [-9, 3, -146] }
    ],
    hazards: [
      { id: "reverse06-gate", kind: "sightline-gate", center: [0, 5, -5], size: [18, 10, .45], cycle: { period: 999, openFor: .05, phase: 1 } },
      { id: "reverse06-wall", kind: "aperture-wall", center: [0, 6, -86], size: [29, 13, .5], aperture: { axis: "x", center: -9, span: 3 } },
      { id: "reverse06-sweep", kind: "sweep", center: [0, 6, -119], size: [.65, 12, 31], drift: { axis: "x", amplitude: 22, speed: .26 } }
    ]
  },
  {
    id: "reverse-07-origin",
    title: "ORIGIN",
    lesson: "You are nearing the surface. The oldest grammar returns with nowhere left to hide behind complexity.",
    grammar: ["direct-anchor", "stop-short", "origin-matters", "airborne-chain"],
    spawn: [10, 2.2, 16],
    goal: [-10, 1.1, -128],
    requiredKills: 6,
    platforms: [
      { center: [10, 0, 14], size: [13, 1, 12] },
      { center: [-10, 5, -26], size: [7, 1, 7] },
      { center: [10, 8, -55], size: [7, 1, 7] },
      { center: [-10, 3, -88], size: [7, 1, 7] },
      { center: [-10, 0, -128], size: [13, 1, 11] }
    ],
    enemies: [
      { id: "reverse07-a", kind: "sentry", position: [-10, 8, -26] },
      { id: "reverse07-b", kind: "shield", position: [10, 11, -55], originConstraint: { axis: "x", min: 3 } },
      { id: "reverse07-c", kind: "drifter", position: [0, 13, -70], drift: { axis: "x", amplitude: 11, speed: .98 } },
      { id: "reverse07-d", kind: "sentry", position: [-10, 6, -88] },
      { id: "reverse07-e", kind: "orbit", position: [0, 9, -108], orbit: { plane: "xy", radiusA: 9, radiusB: 4, speed: .14 } },
      { id: "reverse07-f", kind: "sentry", position: [-10, 3, -130] }
    ],
    hazards: [
      { id: "reverse07-field", kind: "lethal-field", center: [0, 6, -72], size: [29, 12, 3], cycle: { period: 2.45, openFor: .52, phase: .3 } }
    ]
  },
  {
    id: "reverse-08-first-line",
    title: "THE FIRST LINE",
    lesson: "Return to the beginning from the side that was never visible. One last vector. No explanation.",
    grammar: ["direct-anchor", "stop-short", "airborne-chain", "reorientation"],
    spawn: [0, 2.2, 18],
    goal: [0, 1.1, -166],
    requiredKills: 8,
    platforms: [
      { center: [0, 0, 16], size: [16, 1, 14] },
      { id: "reverse08-lift", center: [-13, -5, -30], size: [8, 1, 8], motion: { axis: "y", amplitude: 12, speed: .09, active: false } },
      { center: [13, 5, -60], size: [8, 1, 8] },
      { center: [-12, 4, -96], size: [8, 1, 8] },
      { center: [10, 3, -128], size: [8, 1, 8] },
      { center: [0, 0, -166], size: [16, 1, 13] }
    ],
    enemies: [
      { id: "reverse08-cube", kind: "cube", position: [4, 4, 6], effect: { type: "disable-hazard", targetIds: ["reverse08-gate"] } },
      { id: "reverse08-diamond", kind: "diamond", position: [-4, 5, -7], effect: { type: "activate-platform", targetIds: ["reverse08-lift"] } },
      { id: "reverse08-a", kind: "orbit", position: [0, 10, -22], orbit: { plane: "xy", radiusA: 12, radiusB: 4, speed: .14 } },
      { id: "reverse08-b", kind: "sentry", position: [-13, 8, -30] },
      { id: "reverse08-c", kind: "shield", position: [13, 8, -60], originConstraint: { axis: "x", max: -3 } },
      { id: "reverse08-prism", kind: "prism", position: [7, 9, -72], effect: { type: "shift-aperture", targetIds: ["reverse08-wall"], offset: 15 } },
      { id: "reverse08-d", kind: "drifter", position: [0, 12, -87], drift: { axis: "y", amplitude: 4, speed: 1.0 } },
      { id: "reverse08-e", kind: "sentry", position: [-12, 7, -96] },
      { id: "reverse08-f", kind: "orbit", position: [10, 9, -128], orbit: { plane: "xz", radiusA: 9, radiusB: 5, speed: .14 } },
      { id: "reverse08-g", kind: "sentry", position: [0, 9, -148] },
      { id: "reverse08-h", kind: "sentry", position: [0, 3, -168] }
    ],
    hazards: [
      { id: "reverse08-gate", kind: "sightline-gate", center: [0, 5, -4], size: [18, 10, .45], cycle: { period: 999, openFor: .05, phase: 1 } },
      { id: "reverse08-sweep", kind: "sweep", center: [0, 6, -69], size: [.7, 12, 33], drift: { axis: "x", amplitude: 23, speed: .27 } },
      { id: "reverse08-field", kind: "lethal-field", center: [0, 6, -113], size: [29, 12, 3], cycle: { period: 2.4, openFor: .5, phase: .3 } },
      { id: "reverse08-wall", kind: "aperture-wall", center: [0, 6, -145], size: [29, 13, .5], aperture: { axis: "x", center: -9, span: 3 } }
    ]
  }
];

export function buildReversalLabyrinth(): RoomSpec[] {
  return structuredClone(REVERSAL_LABYRINTH_ROOMS) as RoomSpec[];
}
