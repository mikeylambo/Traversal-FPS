# Shell Certification Notes — Traversal FPS v0.1

Target: `@slu/web-shell` 1.0.2 at commit `4a7b80a4a50d5bddb0d3ab5aff47657e9703e989`.

## What this integration certifies

- Three.js consumer boot through `createGameApp()`.
- Combined `fps` + `arcade` Frame composition.
- Title / main menu / mode / setup / gameplay / pause / results flow.
- Pointer-lock first-person input under Shell pause/resume ownership.
- Mouse fire that remains valid when pointer lock is unavailable or not yet acquired.
- Game DNA mounted behind the Shell gameplay placeholder.
- Internal five-room challenge progression and quick room reset.

## Certification findings

### 1. Shell release has no `v1.0.2` Git tag

`package.json` reports 1.0.2 but the repository has no `v1.0.2` ref. This game therefore pins the exact certified commit instead of `main`.

### 2. Private Shell distribution is not yet deployment-clean

The game depends on the private Shell GitHub repository by commit SHA. Local installs require GitHub access. Public/Vercel deployment needs an authenticated private-Git dependency path or a published/package-registry distribution strategy.

### 3. Stage selection is currently presentation-only

`GameFlowController` advances through `stage-select`, but `launch()` calls `shell.loadLevel(selectedMode)` and does not preserve/pass the selected stage ID. The v0.1 slice therefore runs its five rooms as one internal level sequence.

### 4. Gameplay placeholder remains a real Shell screen

The default UI renders `gameplay-placeholder` as a full-screen panel. Traversal hides that specific screen with game CSS while leaving Shell ownership of all other screens intact. A production Shell hook for mounting/hiding Game DNA would be cleaner.

## Input invariant

A left mouse press queues a shot before attempting pointer lock. Pointer lock is an enhancement to mouse-look, not a prerequisite for firing. This is a deliberate regression guard against the failure in the original standalone prototype.
