"""Traversal FPS Blender -> GLB exporter.

Run through Blender in background mode. The Node wrapper in scripts/blender-export.ts
supplies the .blend input path and runtime GLB output path.
"""

from __future__ import annotations

import argparse
import os
import sys

import bpy


def parse_args() -> argparse.Namespace:
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    input_path = os.path.abspath(args.input)
    output_path = os.path.abspath(args.output)

    if not os.path.exists(input_path):
        raise FileNotFoundError(input_path)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=input_path)

    # Keep authoring in Blender's native Z-up world; glTF export performs the
    # coordinate conversion expected by Three.js. Apply object transforms first.
    selectable = [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "EMPTY", "ARMATURE"}]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in selectable:
        obj.select_set(True)

    if selectable:
        bpy.context.view_layer.objects.active = selectable[0]
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_animations=True,
        export_skins=True,
        export_morph=True,
    )

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"[Traversal Blender] Exported {output_path} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
