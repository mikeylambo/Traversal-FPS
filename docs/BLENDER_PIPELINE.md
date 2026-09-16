# Traversal FPS — Blender Pipeline v1

This pipeline adds authored Blender assets alongside the existing procedural art system. It does **not** replace procedural geometry globally; assets can migrate one-by-one.

## Folder contract

- `art/blender/source/` — editable `.blend` source files.
- `tools/blender/` — Blender-side automation.
- `public/assets/models/` — runtime `.glb` files loaded by Three.js.
- `src/art/procedural/` — existing procedural art remains valid and can coexist with GLBs.

## Scene standard

Use these standards for every game asset:

- Units: Metric, 1 Blender unit = 1 meter.
- Author in Blender's native Z-up space; the glTF exporter converts for Three.js.
- Apply scale before export. The exporter also applies scale as a safety net.
- Asset origin: intentional gameplay pivot, normally bottom-center for architecture/props.
- Forward-facing gameplay assets: use a consistent local forward direction and validate once in-game before cloning variants.
- Mesh names: `TFP_<Category>_<Name>_<Variant>`.
- Material names: `M_TFP_<Name>`.
- Collision/helper meshes: prefix `COL_`.
- Socket/attachment empties: prefix `SOCKET_`.
- LOD meshes: suffix `_LOD0`, `_LOD1`, `_LOD2`.
- Avoid unapplied negative scale.
- Keep cameras/lights out of runtime exports; lighting remains game-controlled.

## Export

From the repository root:

```bash
npm run blender:export -- art/blender/source/gravity-platform.blend
```

This produces:

```text
public/assets/models/gravity-platform.glb
```

To choose an output path:

```bash
npm run blender:export -- art/blender/source/gravity-platform.blend public/assets/models/environment/gravity-platform.glb
```

### Blender executable

The wrapper checks common locations automatically.

If Blender lives somewhere else, set `BLENDER_BIN`:

Windows PowerShell:

```powershell
$env:BLENDER_BIN='C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
```

macOS:

```bash
export BLENDER_BIN='/Applications/Blender.app/Contents/MacOS/Blender'
```

## Runtime strategy

For Traversal FPS, migrate visuals in this order:

1. Moving/gated traversal platforms.
2. Gravity rings.
3. Sphere gates.
4. Diamond/prism assistance actors.
5. Environmental architectural modules.
6. Weapon/world props.

Gameplay collision should stay code-owned unless a specific authored collision shape materially improves the mechanic. Visual meshes should not silently redefine gameplay dimensions.

## Performance targets

Browser/mobile remain first-class:

- Prefer instancing for repeated environment modules.
- Keep materials shared whenever possible.
- Use texture atlases or trim sheets for modular architecture.
- Avoid unique 4K textures for ordinary props.
- Design LODs for large/repeated assets.
- Keep transparent materials rare.
- Treat emissive geometry and shader effects as accents rather than a substitute for silhouette.

## Source control

`.blend` files are binary. Keep authoritative sources under `art/blender/source/`, but do not generate backups/autosaves into Git. Runtime `.glb` files under `public/assets/models/` are the web build artifacts and should be committed when the game depends on them.

## First production asset

The recommended first authored asset is the current signature moving platform. It is visually important, repeated often, and lets us validate scale, pivots, materials, emissive treatment, instancing, collision alignment, and mobile cost before converting the rest of the world.
