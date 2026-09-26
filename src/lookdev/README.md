# Look Engine

Game-agnostic rendering look for Three.js games: a stylised surface language,
a post stack and a live tuning lab, all driven by one parameter schema.

**Boundary rule:** nothing in this folder imports game code. Hosts pass data
in (a `LookSettings` object, a `LookMood`, a DOM container, a store); the
engine never reaches out. That keeps it liftable into `@slu/web-shell`.

| File | Role |
| --- | --- |
| `lookSchema.ts` | Every tunable parameter (group, range, default, format). Defaults, sanitising and the Lab UI are generated from it. |
| `lookRuntime.ts` | Resolves the rendered look per frame: base look + mood offsets (e.g. per act) × `actMood`. `activeLook()` for presentation code. |
| `presets.ts` | Built-in looks, local user presets, JSON export/import (`*.look.json`). |
| `LookLab.ts` | Generated tuning panel: grouped sliders, presets bar, double-click to reset a slider. |
| `LookRenderer.ts` | Surface/node shader materials and the post stack: GTAO → bloom → warp lens → output → finish. |
| `WarpLensPass.ts` | Charge bend, chromatic transit tunnel, arrival shockwave. |
| `FinishPass.ts` | Display-space grade (contrast, saturation, warmth), vignette, grain, lens fringe. |
| `NebulaSky.ts`, `DustMotes.ts` | Procedural sky and parallax dust. |

## Adding a parameter

1. Add one entry to `LOOK_PARAMS` in `lookSchema.ts`.
2. Read it where it applies (a uniform in `LookRenderer.update`, a pass, or `activeLook()`).

The Lab slider, default, persistence, preset files and sanitising follow automatically.

## Host wiring (Traversal)

- `src/render/VisualLab.ts` — binds `LookLab` to the settings store, Settings menu and V key.
- `src/render/enhanceTraversalPresentation.ts` — per frame: `resolveLook(settings, moodForRoom(room))` → `publishLook` → renderer, sky, dust, warp lens.
- `src/render/actMoods.ts` — per-act palette offsets.

## Moving into `@slu/web-shell`

The shell is renderer-neutral today, so this should land as an **optional
subpath** (e.g. `@slu/web-shell/look-three`) with `three` as a peer
dependency, leaving the core shell free of Three.js. The folder already
matches that shape; the move is a copy plus import-path updates in the host.
