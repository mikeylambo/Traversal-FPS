from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

for rel in ("src/game/SettingsTabsRuntime.ts", "src/game/MobileSettingsRuntime.ts"):
    path = ROOT / rel
    text = path.read_text()
    text = text.replace("SETTINGS_SETTINGS_TABS", "SETTINGS_TABS")
    path.write_text(text)

path = ROOT / "src/game/SettingsTabsRuntime.ts"
text = path.read_text()

anchor = '''type UILike = {
  move(delta: number): void;
};

'''
insert = '''type UILike = {
  move(delta: number): void;
};

type SupplementalSettings = {
  nightAudio: boolean;
  plainFont: boolean;
  firstRunAccessibilitySeen: boolean;
};

const SUPPLEMENTAL_KEY = "traversal-fps:supplemental-accessibility:v1";
const FIRST_RUN_CHOICE = "traversal-first-accessibility";

'''
if "type SupplementalSettings" not in text:
    if anchor not in text:
        raise RuntimeError("Missing UILike anchor")
    text = text.replace(anchor, insert, 1)

bad = '  const tab = id ? resolveSettingsTab(id, choice.textContent ?? "") : undefined;\n  if (id && tab === activeTab) lastChoiceByTab[activeTab] = id;\n}\n\nfunction makeChoiceButton'
good = '  const tab = id ? resolveSettingsTab(id, focused?.textContent ?? "") : undefined;\n  if (id && tab === activeTab) lastChoiceByTab[activeTab] = id;\n}\n\nfunction makeChoiceButton'
if bad not in text:
    raise RuntimeError("Missing rememberFocusedChoice bug anchor")
text = text.replace(bad, good, 1)
path.write_text(text)

# Hard assertions for the two generation mistakes we are fixing.
for rel in ("src/game/SettingsTabsRuntime.ts", "src/game/MobileSettingsRuntime.ts"):
    data = (ROOT / rel).read_text()
    if "SETTINGS_SETTINGS_TABS" in data:
        raise RuntimeError(f"Double SETTINGS identifier remains in {rel}")

settings = (ROOT / "src/game/SettingsTabsRuntime.ts").read_text()
for required in ("type SupplementalSettings", "const SUPPLEMENTAL_KEY", "const FIRST_RUN_CHOICE", "focused?.textContent"):
    if required not in settings:
        raise RuntimeError(f"Missing repaired desktop settings symbol: {required}")

print("Generated settings refactor repaired")
