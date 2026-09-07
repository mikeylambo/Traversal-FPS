import bpy
import math
from pathlib import Path

# Reproducible Blender-side starter kit for Traversal spatial actors.
# Run from Blender's Scripting workspace. Exports FBX files into UnityTraversal/Assets/Traversal/Art/Generated.

ROOT = Path(bpy.path.abspath("//"))
OUT = ROOT / ".." / ".." / "Assets" / "Traversal" / "Art" / "Generated"
OUT.mkdir(parents=True, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def apply_transform(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)


def bevel(obj, width=0.08, segments=3):
    mod = obj.modifiers.new("TraversalBevel", 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def export_selected(name):
    path = OUT / f"{name}.fbx"
    bpy.ops.export_scene.fbx(
        filepath=str(path),
        use_selection=True,
        apply_scale_options='FBX_SCALE_ALL',
        axis_forward='-Z',
        axis_up='Y',
        bake_space_transform=False,
        add_leaf_bones=False,
    )
    print(f"Exported {path}")


def make_sphere():
    clear_scene()
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0)
    obj = bpy.context.object
    obj.name = "SpatialSphere"
    export_selected("spatial_sphere")


def make_diamond():
    clear_scene()
    bpy.ops.mesh.primitive_octahedron_add(radius=1.0)
    obj = bpy.context.object
    obj.name = "SpatialDiamond"
    obj.scale = (0.95, 1.35, 0.95)
    apply_transform(obj)
    bevel(obj, 0.05, 2)
    export_selected("spatial_diamond")


def make_prism():
    clear_scene()
    bpy.ops.mesh.primitive_cylinder_add(vertices=3, radius=1.0, depth=2.0)
    obj = bpy.context.object
    obj.name = "SpatialPrism"
    obj.rotation_euler[0] = math.radians(90)
    apply_transform(obj)
    bevel(obj, 0.06, 2)
    export_selected("spatial_prism")


def make_gravity_ring():
    clear_scene()
    bpy.ops.mesh.primitive_torus_add(major_radius=1.45, minor_radius=0.12, major_segments=48, minor_segments=10)
    outer = bpy.context.object
    outer.name = "GravityRing"
    outer.rotation_euler[0] = math.radians(90)
    apply_transform(outer)

    bpy.ops.mesh.primitive_torus_add(major_radius=1.08, minor_radius=0.035, major_segments=48, minor_segments=6)
    inner = bpy.context.object
    inner.name = "GravityRingInner"
    inner.rotation_euler[0] = math.radians(90)
    apply_transform(inner)

    outer.select_set(True)
    inner.select_set(True)
    bpy.context.view_layer.objects.active = outer
    export_selected("gravity_ring")


make_sphere()
make_diamond()
make_prism()
make_gravity_ring()
clear_scene()
print("Traversal actor kit complete.")
