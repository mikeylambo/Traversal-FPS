# Traversal Platform System art pass

This directory preserves the reference-led reconstruction work for the moving-platform redesign.

## Current state

- Reference suitability and admission: passed after isolating the standard-deck view.
- Pre-spec assessment and 12-item detail inventory: complete.
- Reference-derived PBR evidence: complete for cool-white shell, graphite structure, cyan emitter, and dark machined detail. Runtime maps live in `public/textures/platform/`.
- Strict-quality object spec validation: passed.
- Blockout, structural, and form-refinement reviews: accepted. The four-view form turntable is reliably segmented, non-degenerate, and free of unintended silhouette holes.
- Procedural factory: generated through the `material-pass` at `src/art/procedural/models/createTraversalPlatformModel.ts`, including independent reference-derived albedo, roughness, normal, height, and AO maps.
- Runtime registration: intentionally pending. The generated model remains presentation-only until material response is accepted; the existing gameplay collision mesh stays authoritative.

## Required next review

Start the existing Vite app in a WebGL-capable browser and open `/platform-preview.html`. Capture the reference, neutral, and grazing material views, then run the material comparator, material gate, Tier 1, turntable, comparison-sheet, and AI review gates documented by the installed pipeline.

The preview includes an SVG fallback for silhouette and proportion review when WebGL is unavailable. Material, normal, lighting, and emissive acceptance still require a real WebGL capture; the connected cloud browser currently reports WebGL as disabled. No material-fidelity score is claimed without that evidence.
