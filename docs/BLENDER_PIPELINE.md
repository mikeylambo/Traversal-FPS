# Traversal FPS — Blender Pipeline v1

This pipeline adds authored Blender assets alongside the existing procedural art system. It does **not** replace procedural geometry globally; assets can migrate one-by-one.

Important: approved hard-surface reference-image reconstruction still follows the repository's `img2threejs` workflow and semantic visual registry. Blender is for native modeling, cleanup, UV/material work, authored modular environment pieces, LODs, pivots/sockets, and assets that are intentionally being shipped as GLB.

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
npm run blender:export -- art/blender/source/gravity-ring.blend
```

This produces:

```text
public/assets/models/gravity-ring.glb
```

To choose an output path:

```bash
npm run blender:export -- art/blender/source/gravity-ring.blend public/assets/models/environment/gravity-ring.glb
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

Use Blender first where authored geometry adds value without undermining the semantic registry or gameplay ownership:

1. Gravity rings and non-reference-driven environment landmarks.
2. Modular architecture and trim-sheet-ready environment kits.
3. Secondary props, sockets, authored pivots, and LOD variants.
4. Cleanup/optimization of approved assets that are explicitly intended to ship as GLB.

For approved hard-surface reference images such as the Warp Rifle or other reference-led hero assets, use `img2threejs` first as required by `AGENTS.md`; do not bypass that pipeline with a hand-modeled approximation.

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

The recommended first Blender-authored production asset is the Gravity Ring. It is visually important, isolated from weapon/reference reconstruction, and gives us a clean validation target for scale, pivots, emissive treatment, material sharing, animation hooks, instancing, collision alignment, and mobile cost.
