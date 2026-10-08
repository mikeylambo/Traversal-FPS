# Meshy → Traversal pipeline

Meshy (or Blender, or any tool that exports glTF) produces the art. The game already has a
slot waiting for each piece. Drop the file into `public/models/`, flip `enabled: true` in
`src/art/models/modelSlots.ts`, and the art replaces the procedural version as soon as it loads.
If a file is missing or broken, the procedural version stays. Gameplay never sees the model:
collision, targeting and puzzle state stay in the gameplay systems.

## 1. Export settings (every asset)

| Setting | Value |
|---|---|
| Format | **GLB** (binary glTF), PBR on |
| Hero (rifle) | ≤ 30k tris, 2048² textures |
| Actors (cube / diamond / prism shells) | ≤ 8k tris, 1024² |
| Environment pieces | ≤ 6k tris, 1024² (they're seen from 30–100 m away) |
| Pivot / scale | Doesn't matter: each slot re-centres the model and scales it to size |
| Facing | Set `forward` on the slot if the model doesn't point down −Z |

Run Meshy's **Remesh** (quad, target count above), then **Texture** with PBR. Keep the
style prompt identical across assets so the set matches.

**Shared style line** (append to every prompt):
> clean hard-surface sci-fi, matte white ceramic panels, graphite metal, thin cyan emissive seams, minimal greebles, crisp bevels, game-ready, no text, no logos

## 2. Warp Rifle: `public/models/warp-rifle.glb`

Prompt (use the approved concept image as an image-to-3D reference if you have it):
> first-person sci-fi rifle, white and graphite, circular warp core ring mounted mid-body
> glowing cyan, three floating ring segments around the barrel, forked twin-prong emitter
> muzzle, ergonomic angled grip, short rear stock, side profile silhouette strong + style line

Then in Blender (5-minute pass, it makes the rifle *live*):
1. **Separate the floating ring segments** into their own objects and name them with
   `spin` (e.g. `ring_spin_a`). Put each one's origin on the barrel axis with local Z along the barrel.
   They spin with the weapon's charge: idle drift → fast while warp is held → blur on transit.
2. **Glow material**: name the cyan emissive material with `energy` (e.g. `core_energy`).
   It pulses with the weapon state and flashes on fire.
3. Barrel points down −Z (or set `forward` on the slot). Export GLB.

Then in `modelSlots.ts` set `enabled: true` on `weapon.warp-rifle.default`. Tune
`position` / `length` until it sits right in view (defaults match the procedural rifle).

## 3. Shapes (optional): cube / diamond / prism shells

These replace the shell meshes only; the halo, role ornaments, conduits and reactions stay
procedural, so the shapes still read the same. Prompts:
- **cube**: `floating armoured cube core, chamfered white panels, cyan seams` + style line
- **diamond**: `elongated octahedron crystal housing, white ceramic, cyan inner glow` + style line
- **prism**: `triangular prism emitter, graphite frame, white plates, cyan light slits` + style line

Name glowing materials with `energy` for consistency.

## 4. Environment (campaign acts)

Each piece is scaled to fit per instance, so authored size doesn't matter. Hooks live in
`src/render/ActEnvironment.ts` (`dress(...)`); animation (spin, heave) is applied for you.

| Slot key | File | What | Prompt (+ style line) |
|---|---|---|---|
| `environment.act-i.pylon` | `act1-pylon.glb` | Act I distant pylons (tall, upright) | `monolithic sci-fi pylon tower, tall and slender, panel lines, beacon at top` |
| `environment.act-ii.drum` | `act2-drum.glb` | Act II wall drums (author **upright**, axis = Y; the slot lays it down) | `massive industrial rotor drum, radial ribs, toothed rim, machine hall` |
| `environment.act-iii.piston` | `act3-piston.glb` | Act III heaving wall pistons (upright) | `giant hydraulic piston column, warning bands, heavy industrial, dark graphite` |
| `environment.act-iv.ring` | `act4-ring.glb` | Act IV colossal rings in the void (flat in XY) | `colossal segmented halo ring structure, open space megastructure` |
| `environment.finale.frame` | `finale-frame.glb` | Frame behind the finale gate (flat in XY, open centre) | `monumental circular gate frame, open centre, buttressed segments` |

The finale gate's lit segments stay procedural (they show progress), and the frame sits behind them.

## 5. Check it

`npx vite --config tools/harness/vite.config.ts`, then open:
- rifle: `/tools/harness/index.html?map=map-01`
- act halls: `?map=map-12` (II), `?map=map-24` (III), `?map=map-36` (IV)
- finale gate: `?map=map-18&kills=3`
- menu construct: `/tools/harness/menu.html?cleared=13` (`&campaign=1&reverse=1` for the end state)

The console logs `Traversal model slot // <key> <- <file>` when a slot loads.
