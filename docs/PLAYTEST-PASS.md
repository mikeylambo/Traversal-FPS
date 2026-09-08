# Traversal FPS — Full-Content Playtest Pass

This is the first proper whole-game pass after the 32-sector campaign, canonical Time Trial suite, Challenge suite, Reversal content, mobile controls, accessibility systems, authored SFX, and SLU Studio infrastructure are all present together.

The goal is not to redesign the game during the pass. The goal is to prove that the authored product is traversable, readable, fair, performant, and internally coherent from first boot through postgame.

## Build gate before playing

Run:

```bash
npm install
npm run verify
npm run certify:web
npm run certify:controller
npm run certify:mobile
```

The normal build already runs content validation, audio validation, regression tests, TypeScript, and Vite production build.

Use `?dev=1` during development/playtest sessions to expose the SLU developer console. Useful commands include:

- `help`
- `traversal.content`
- `traversal.maps`
- `telemetry.count`
- `playtest.report`
- `playtest.download`
- `diagnostics.json`
- `perf.summary`
- `assets.audit`
- `copy.audit`

`playtest.download` exports the complete local SLU debug bundle for the current session.

## Pass A — Campaign 01–32

Play every sector in order on Standard difficulty before making balance changes.

For each sector record only actionable observations:

- hard blocker / impossible state
- collision or fall-through defect
- incorrect actor effect or target ID
- unreadable opening, hazard, route, or gravity ring
- unintended bypass that trivializes the room
- emergent shortcut that is difficult but legitimate
- unclear required Sphere count
- excessive waiting or dead traversal time
- camera / aim / warp placement issue
- audio cue missing, misleading, or fatiguing
- frame-rate or thermal problem

Do not remove an emergent route merely because it differs from the intended route. Classify it first as exploit, alternative solution, or mastery tech.

## Pass B — Canonical Time Trial 01–16

Do not lock medal times before completing at least three successful runs per course.

Check:

- course boots from the intended source content
- no impossible spawn/goal state
- timer starts and ends consistently
- penalties apply correctly
- shortcuts remain skill-based rather than geometry leaks
- Gold/Silver/Bronze targets are plausible after real runs
- restart flow is fast enough for repeated attempts

Treat current medal values as provisional until measured.

## Pass C — Challenge 01–24

Check each chamber for:

- exact Sphere count correctness
- utility actors not incorrectly counted as Sphere kills
- one-miss allowance behavior
- extra-kill failure behavior
- restart behavior after failure
- readable distinction between required and utility actors
- no route that bypasses the actual challenge condition

A difficult alternate solution is acceptable if it still satisfies the chamber's rule.

## Pass D — THE REVERSE 01–08

This is postgame mastery content. Do not add tutorial text merely because a room is initially confusing.

Check:

- unlock after Sector 32
- progression into/out of the Labyrinth
- all eight chambers traversable
- no reliance on a mechanic not established earlier
- final return/payoff works
- postgame difficulty is demanding without depending on hidden collision or unreadable state

## Pass E — Input/device sweep

Repeat representative early, middle, and late content with:

- keyboard + mouse
- USB controller
- touch/mobile landscape

Required checks:

- menus fully operable without mouse
- pause/resume survives input-device changes
- controller disconnect/reconnect does not corrupt state
- tab/background pauses safely and audio behaves correctly
- touch Warp hold/placement/release remains reliable
- safe areas and controls remain usable on short landscape screens

## Pass F — Accessibility sweep

Test representative content with:

- Reduce Motion
- Reduce Flash
- each color profile
- increased UI text scale
- HUD contrast options
- aim/information assists
- mono/single-channel listening where available

No puzzle-critical state should depend on color alone.

## Pass G — Performance sweep

Use the SLU dev console performance summary plus browser tools on representative worst cases:

- dense late-campaign sector
- multiple moving actors
- several procedural platforms on screen
- hazard-heavy sector
- mobile landscape session of at least 15 minutes

Capture frame pacing, obvious thermal degradation, WebGL context loss, audio glitches, and memory growth.

## Exit criteria for this playtest milestone

The build is ready for the next polish/release pass when:

1. Campaign 01–32 can be completed in sequence without a blocker.
2. All 16 Time Trials boot and can be completed.
3. All 24 Challenges boot and can be completed under their stated rules.
4. All 8 Reversal chambers can be completed after a legitimate unlock.
5. No known fall-through, impossible-state, progression, save, audio, or input blocker remains.
6. KBM, controller, and touch each complete representative endgame content.
7. Major visual/readability inconsistencies have a concrete fix list.
8. Playtest telemetry/debug bundles have been exported for any reproducible systemic issue.

After this gate, revisions should be driven by observed play rather than speculative expansion.
