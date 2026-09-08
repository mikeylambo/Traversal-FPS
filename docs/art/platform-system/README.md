# Traversal Platform System art pass

This directory preserves the reference-led reconstruction work for the moving-platform redesign.

## Current state

- Reference suitability and admission: passed after isolating the standard-deck view.
- Pre-spec assessment and 12-item detail inventory: complete.
- Reference-derived PBR evidence: complete for cool-white shell, graphite structure, cyan emitter, and dark machined detail. Runtime maps live in `public/textures/platform/`.
- Strict-quality object spec validation: passed.
- Procedural factory: generated through the `blockout` pass at `src/art/procedural/models/createTraversalPlatformModel.ts`.
- Runtime registration: intentionally pending. The generated model is presentation-only and must not replace the gameplay collision mesh until the visual pass is accepted.

## Required next review

Start the existing Vite app and open `/platform-preview.html`. Capture the fixed view plus at least two meaningful orbit views, then run the img2threejs Tier 1, multi-angle, comparison-sheet, and AI review gates documented by the installed pipeline. The blockout may advance only when the review records a supported `continue` action.

The preview includes an SVG fallback for silhouette and proportion review when WebGL is unavailable. Material, normal, lighting, and emissive acceptance still require a real WebGL capture; the connected cloud browser currently reports WebGL as disabled. No material-fidelity score is claimed without that evidence.
