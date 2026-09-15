from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

manifest = ROOT / "src/audio/TraversalAudioManifest.ts"
text = manifest.read_text()
for event in (
    "movement.footstep",
    "movement.crouch-step",
    "movement.land-light",
    "movement.land-heavy",
    "movement.crouch-down",
    "movement.crouch-up",
    "scope.engage",
    "scope.disengage",
):
    anchor = f'  "{event}": {{\n    bus: "sfx", tier: "core"'
    replacement = f'  "{event}": {{\n    bus: "sfx", tier: "deferred"'
    if anchor not in text:
        raise RuntimeError(f"Missing tier anchor for {event}")
    text = text.replace(anchor, replacement, 1)
manifest.write_text(text)

main = ROOT / "src/main.ts"
text = main.read_text()
old_import = "  configureTraversalAudio,\n  preloadCoreTraversalAudio\n"
new_import = "  configureTraversalAudio,\n  preloadCoreTraversalAudio,\n  preloadTraversalAudioEvents\n"
if old_import not in text:
    raise RuntimeError("Could not find TraversalAudio import anchor")
text = text.replace(old_import, new_import, 1)
old_warm = "void preloadCoreTraversalAudio();\n"
new_warm = '''void preloadCoreTraversalAudio();
// Body foley is intentionally outside the certified boot bundle. Warm it while
// the player is still in menus so first use is authored audio without bloating
// the <=700 KB core SFX budget.
void preloadTraversalAudioEvents([
  "movement.footstep",
  "movement.crouch-step",
  "movement.land-light",
  "movement.land-heavy",
  "movement.crouch-down",
  "movement.crouch-up",
  "scope.engage",
  "scope.disengage"
]);
'''
if old_warm not in text:
    raise RuntimeError("Could not find core preload anchor")
text = text.replace(old_warm, new_warm, 1)
main.write_text(text)

print("Deferred movement/scope foley and added background warmup")
