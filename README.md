# Traversal FPS

A precision first-person traversal puzzle built around one rule:

> Kill an enemy to write a movement vector from your firing position to its death position. Spend that vector once, stopping anywhere along it.

This repository is the native SLU Web Shell integration/certification build.

- Renderer: Three.js
- Shell Frames: `fps`, `arcade`
- Shell target: `@slu/web-shell` 1.0.2
- Certified Shell commit: `4a7b80a4a50d5bddb0d3ab5aff47657e9703e989`

The old standalone HTML prototype is reference material only. Game systems in this repository are rebuilt as native Shell consumers.

## Vertical slice

1. Write the Line — kill, then full-warp.
2. Stop Short — choose a point along the vector.
3. Chain — create the next vector while airborne.
4. Origin Matters — firing position changes the route.
5. Find the Faster Route — open mastery/time-trial room.

## Development

```bash
npm install
npm run dev
```

`@slu/web-shell` is pinned to the exact 1.0.2 certification commit. Because the Shell repository is private, installs require GitHub access to that repository until the package has a publish/distribution path.

## Audio

Authored SFX live in `public/audio/`, mapped to semantic triggers by
`src/audio/TraversalAudioManifest.ts`. Gameplay code emits meaning
(`emitTraversalAudio("sphere.resolve")`), never a filename.

```bash
npm run audio:build -- "<path containing the 'Traversal FPS SFX' drop>"
npm run audio:doctor            # runs in `npm run build`
npm run audio:doctor -- --emit-map   # regenerates docs/AUDIO_MAPPING.md
```

The authored WAV drop is not in the repository; only the encoded output is. See
[docs/AUDIO_MAPPING.md](docs/AUDIO_MAPPING.md).

## Accessibility

Reduce Flash, Reduce Motion, colour profiles with non-colour hazard cues, HUD
contrast, UI text scale and a colour-vision preview all live on the existing
Settings screen. See [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) for the
contrast and colour audits.

## Core rule

One kill creates one active anchor. Any committed warp consumes it completely, including a stop-short warp. A newer kill replaces the previous unused anchor.
