# Traversal FPS — Agent Instructions

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
