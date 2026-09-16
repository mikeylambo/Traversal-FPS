# Traversal — Unity/C# Port

This directory is a parallel native implementation. The existing Three.js game remains untouched.

## Open and test

1. In Unity Hub, **Open** the `UnityTraversal` folder.
2. Use Unity **6000.4.11f1**.
3. Let Package Manager restore Input System 1.19.0 and URP 17.4.0.
4. Open or create any empty scene and press **Play**. `TraversalBootstrap` creates the current runtime automatically; no authored scene is required for this first port pass.

Controls: **WASD / left stick** move, mouse / right stick look, **LMB** fire, **RMB hold + wheel** choose stop-short, **RMB release** spend vector, **Ctrl/C** crouch, **R** restart room, **Esc** unlock cursor.

## Port status

Implemented in C#: Act I room geometry/data (01–08), CharacterController movement, no-jump traversal, crouch, auto-step, gravity/fall reset, Warp Rifle raycast kills, written vectors, 12–100% stop-short selection, cubic warp transit, sentry/drifter targets, shield-origin behavior, required-kill exit gating, room progression/restart, mouse/keyboard and USB gamepad movement/look.

Still intentionally pending runtime validation/polish: exact controller aim settings/deadzones, airborne phase-hang/warp landing cushions, hazards, moving/helper spatial actors (Diamonds/Prisms), proper Gravity Ring mesh/trigger feedback, Standard/Time Trial/Challenge shell UI, persistence/achievements, audio/VFX parity, authored materials/URP lookdev, and the later sector/challenge content beyond the original 8-room source dataset.

## Architecture direction

Reusable systems belong under the `SLU` layer as this matures (input, player/controller, session/modes, objectives, save/settings, audio, VFX). Traversal-specific systems remain under `SLU.Traversal` until extracted. Do not line-for-line port web abstractions when Unity provides a cleaner native equivalent.

### Fidelity constants already carried over

- Run speed: 7.5
- Crouch speed: 4.9
- Player radius: 0.32
- Auto-step: 0.38
- Gravity: 18
- Standing eye: 1.7
- Crouch eye: 1.06
- Minimum stop-short: 12%
- Warp speed: 82 units/sec
- Minimum warp duration: 0.075 sec
- Stop-short wheel step: 4%

The web build remains the reference implementation for feel until this port has been playtested.
