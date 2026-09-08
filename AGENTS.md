# Traversal FPS — Agent Instructions

## Player-facing UI copy discipline

Traversal uses a strict copy budget. Do not add player-facing text just because empty space exists or because a visual concept can be named.

Rules:
1. Do not introduce new player-facing terminology, taglines, lore labels, system names, acronyms, subtitles, explanatory microcopy, or decorative words unless the user explicitly asks for them.
2. Every visible string must serve one of three jobs: tell the player what happened, tell the player what they can do, or help them make a choice. If it does none of those, remove it or keep it in development tooling only.
3. Prefer hierarchy, layout, iconography, animation, color, shape, and state changes over explanatory text.
4. Do not convert internal design vocabulary into fictional/player-facing vocabulary. Internal names belong in docs, comments, lookdev, debug, editor, and telemetry surfaces.
5. Preserve existing user-approved copy. Do not "improve" it with extra subtitles or flavor text unless asked.
6. When uncertain whether copy is necessary, leave it blank and report the possible copy as an optional suggestion rather than shipping it.
7. Results screens may show useful metrics and concise actions, but should not narrate or editorialize those metrics unless specifically requested.
8. Development-only UI must be clearly separable from the shipped/player-facing interface.

Temporary development exception: `SPATIAL / ADAPTIVE / PRECISE / ENDLESS` may remain visible during the current visual-development phase. Do not generalize this exception into additional decorative copy.

## Procedural art pipeline

For approved hard-surface reference images, use the installed `img2threejs` skill rather than hand-approximating the asset.

Canonical workflow:
1. Attach or otherwise provide the approved reference image to Codex.
2. Invoke/use the `img2threejs` skill and follow its staged quality gates until the comparison render is accepted.
3. Write the generated Three.js factory directly into `src/art/procedural/models/`.
4. Preserve the generated ObjectSculptSpec/review artifacts in a sensible source-controlled location when useful, but do not commit local `.img2threejs/` scratch state.
5. Register the model in `src/art/procedural/visualManifest.ts` under a stable semantic key.
6. Gameplay code must never import generated model files directly.
7. Generated geometry is presentation-only unless a task explicitly says otherwise. Keep authoritative targeting, collision, puzzle state, and movement geometry in existing gameplay systems.
8. Keep the existing primitive/model implementation as fallback where practical.

### Current priority: approved Warp Rifle

The currently approved Warp Rifle concept must replace the hand-built approximation registered as:

`weapon.warp-rifle.default`

Target output path:

`src/art/procedural/models/createWarpRifleModel.ts`

Requirements:
- use the actual `img2threejs` skill pipeline;
- preserve the approved white/graphite/cyan design, circular warp core, floating ring segments, forked emitter, ergonomic grip, and rear stock silhouette;
- optimize for first-person readability after reconstruction without changing gameplay behavior;
- preserve/author named runtime pivots and sockets for muzzle, recoil, warp core, and floating ring segments;
- preserve the stable registry key so `WarpRifle.ts` and gameplay systems do not need rewrites;
- compare against the approved image and iterate until the result is materially closer than the current procedural placeholder.

After reconstruction, run the repo checks/build and report any remaining visual tuning separately from structural correctness.
