# Traversal FPS Procedural Asset Pipeline

Traversal keeps gameplay geometry authoritative and treats generated art as presentation-only.

## Production path

1. Generate a clean reference image with one Traversal object on a simple background.
2. Reconstruct the reference with img2threejs as a code-only Three.js model.
3. Keep the generated model as a factory returning `THREE.Group`.
4. Place generated source under `src/art/procedural/generated/`.
5. Mount it to an existing gameplay actor/platform with `attachProceduralVisual()`.
6. Never move collision, hit logic, puzzle effects, or required gameplay state into generated geometry.
7. Test silhouette at distance, monochrome readability, performance, and animation pivots before promotion.

## Required generated model shape

```ts
import * as THREE from "three";

export function createWarpRifleModel(): THREE.Group {
  const root = new THREE.Group();
  // procedural model generated/rebuilt here
  return root;
}
```

The factory may expose additional named children/sockets through `Object3D.name` and `userData`, but Traversal remains responsible for gameplay semantics.

## Traversal visual grammar

Generated references should look like precision spatial instrumentation rather than generic sci-fi machinery:

- large clean masses and negative space
- suspended or apparently disconnected components
- thin luminous seams instead of dense greebling
- one dominant silhouette per gameplay class
- restrained material palette
- readable state changes without requiring color perception

Canonical families:

- Sphere: movement endpoint
- Cube: state/control machinery
- Diamond: spatial/platform aid
- Prism: field/geometry manipulation
- Gravity Ring: sector progression
- Warp Rifle: player-facing spatial instrument

## Image reference rules

For reliable reconstruction, prefer:

- one object per frame
- three-quarter view
- full silhouette visible
- neutral/simple background
- clearly separated components
- limited overlapping parts
- explicit hard-surface construction
- no text, logos, or tiny decorative noise

If the object requires animation, the reference should visibly imply separable moving components.

## Quality gates

A generated asset is not production-ready until it passes:

1. Silhouette: recognizable at gameplay distance.
2. Semantics: cannot be confused with another spatial actor class.
3. Gameplay isolation: presentation geometry does not alter raycasts/collision.
4. Motion: intended animated pieces have clean pivots or named child groups.
5. Performance: no unjustified geometry/material explosion.
6. Cohesion: looks like the same world language as the rest of Traversal.

## Blender escalation rule

Use Blender only when procedural Three.js reconstruction becomes less economical than conventional modeling, especially for organic forms, skeletal rigs, complex deformations, baking, or hero assets whose geometry is difficult to express cleanly in code.
