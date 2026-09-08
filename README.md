# Traversal FPS

A precision first-person traversal puzzle built around one rule:

> Kill an enemy to write a movement vector from your firing position to its death position. Spend that vector once, stopping anywhere along it.

This repository is the native SLU Web Shell build.

- Renderer: Three.js
- Shell Frames: `fps`, `arcade`
- Shell target: `@slu/web-shell` 1.0.2 studio infrastructure
- Shell commit: `a895920cdf151f23a5aaeb525ac72024b29101b5`
- Current game milestone: full-content playtest build

The old standalone HTML prototype is reference material only. Game systems in this repository are native Shell consumers.

## Current playable scope

- Campaign: 32 authored sectors across four acts
- Time Trial: 16-course canonical suite
- Challenge: 24 authored mastery chambers
- Postgame: 8-room THE REVERSE labyrinth
- Training: controls, traversal grammar, and spatial actor curriculum
- Difficulty: Assist / Standard / Hard / Expert
- Input: keyboard + mouse, USB controller, touch/mobile
- Progression: campaign persistence, achievements, Sector 32 postgame unlock

Spatial actor grammar:

- Spheres gate movement
- Cubes change state
- Diamonds activate motion
- Prisms reconfigure spatial openings/energy paths
- Gravity Rings advance progression

## Development

```bash
npm install
npm run dev
```

`@slu/web-shell` is pinned to the current certified Studio Infrastructure commit. Because the Shell repository is private, installs require GitHub access to that repository until the package has a publish/distribution path.

The normal production build is deliberately strict:

```bash
npm run build
```

It runs, in order:

1. content doctor
2. audio doctor
3. regression tests
4. TypeScript check
5. Vite production build

Additional Shell certification profiles:

```bash
npm run certify:web
npm run certify:controller
npm run certify:mobile
npm run certify:release
```

For the next whole-game testing pass, see `docs/PLAYTEST-PASS.md`.

Add `?dev=1` to a development URL to expose the SLU developer console. The Traversal integration adds content-state commands and a downloadable local playtest/debug bundle.

## Audio

Authored SFX live in `public/audio/`, mapped to semantic triggers by
`src/audio/TraversalAudioManifest.ts`. Gameplay code emits meaning
(`emitTraversalAudio("sphere.resolve")`), never a filename.

```bash
npm run audio:build -- "<path containing the 'Traversal FPS SFX' drop>"
npm run audio:doctor
npm run audio:doctor -- --emit-map
```

The authored WAV drop is not in the repository; only the encoded output is. See
`docs/AUDIO_MAPPING.md`.

## Accessibility

Reduce Flash, Reduce Motion, colour profiles with non-colour hazard cues, HUD
contrast, UI text scale, aim/information assists, audio-accessibility options and
colour-vision preview live on the Settings screen. See `docs/ACCESSIBILITY.md`.

## Core rule

One kill creates one active anchor. Any committed warp consumes it completely, including a stop-short warp. A newer kill replaces the previous unused anchor.
