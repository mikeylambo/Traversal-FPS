# Accessibility

The fairness constitution already says the game should never punish missing
information it did not give equal access to. That governed spatial fairness — ground
cues, exit gates, landing rings. This document extends the same rule to perceptual
access, and records the audits behind it.

Every option lives on the existing Settings screen alongside sensitivity, FOV and
the Rendering Lab. There is no separate accessibility menu.

| Setting | Default | What it does |
| --- | --- | --- |
| Reduce Flash | follows `prefers-reduced-motion` | Caps flash intensity and removes the transit saturation/brightness pump |
| Reduce Motion | follows `prefers-reduced-motion` | Dampens screen shake and the warp FOV punch. Render quality untouched |
| Colour Profile | Standard | Re-hues hazards and actors for deuteranopia / protanopia / tritanopia |
| HUD Contrast | Standard | Opaque plates behind HUD and tutorial text |
| UI Text Scale | 100% | 90%–160% on the HUD panels |
| Colour Vision Preview | Off | Simulates a CVD over the whole frame — an authoring aid, usable while playing |

---

## Priority 1 — Reduce Flash

The warp FX pass was deliberately strengthened: brighter radial flash,
saturation/brightness kick during transit, stronger arrival flash. That made this
toggle necessary rather than optional.

The principle is **cap, never delete**. A capped cue still tells you what happened;
an absent one does not. Reduce Flash:

- caps `#warp-fx` layer opacity through `--flash-scale` (0.34);
- **stops** the 120ms `warp-axis-pulse` strobe outright — an ~8Hz full-width
  luminance oscillation is the one element here that is a genuine seizure risk, and
  a static axis line carries the same information;
- removes `filter: brightness(1.3) saturate(1.42)` on the canvas during transit and
  `saturate(1.9) contrast(1.15)` on a hazard hit;
- scales the warp arrival burst's point-light intensity and core opacity in world
  space (`WarpSystem.addEndpointBurst`);
- halves the hazard-hit vignette;
- caps the `lethal-field` and `sweep` warning pulse **depth** while leaving the
  **rate** untouched, because the rate is what identifies the hazard (see Priority 3);
- reduces the rifle impulse peak from 0.95 to 0.30 opacity, keeping its timing;
- slows and dims the Challenge shot-budget danger pulse instead of stopping it —
  losing it would cost a Challenge player real information.

## Priority 2 — Reduce Motion

Separate from the Low/Medium/High graphics preset, which only touches bloom/AO/TAA.
These are motion triggers with no render cost:

- the warp FOV punch (`+8 +8·pulse` degrees) drops to `+3`, and the transit camera
  roll is zeroed — `TraversalGame.updateCameraPresentation`;
- `.warp-streaks` stop their scale-and-rotate sweep;
- sector transition wipes and copy animations collapse to their end state;
- the reticle's recoil settle is pinned;
- `warp-committed`, `warp-landed`, `hazard-hit` and `exit-activated` — the impulse
  hooks the feel pass attaches screen movement to — are neutralised, so a future
  impulse cannot ship past this toggle by accident.

The toggle is OR'd with the Shell's own `reducedMotion` preference, so either source
turns it on.

## Priority 3 — Colour audit

**Finding.** Utility actors were already right: ring geometry *plus* colour. Hazards
were not. Three of the four hazard kinds sat in the warm hues —
`sweep #ff5f7a`, `lethal-field #ff9a5d`, `aperture-wall #ff7895` — which collapse
toward the same yellow-brown under deuteranopia and protanopia. Behaviour was the
only thing separating them, and behaviour is what the player is trying to learn.

**Fix — non-colour cues, always on, in every profile:**

| Hazard | Shape signature | Pulse rate |
| --- | --- | --- |
| `sweep` | chevrons pointing along its travel, plus the existing bright core | 12 rad/s (~1.9 Hz) |
| `lethal-field` | diagonal hatching | 3.4 rad/s (~0.54 Hz) |
| `sightline-gate` | horizontal bars (already present) | cycle-locked blink |
| `aperture-wall` | void frame + white rim (already present) | 7.5 rad/s |

Sweep and lethal field previously shared one 7.5 rad/s pulse. They are now roughly
3.5× apart, which is a rate difference you can read without seeing either hue. The
patterns are high-luminance additive white, so they survive greyscale, every colour
profile, and the Reduce Flash cap.

**Fix — palette remap.** Deuteranopia and protanopia collapse the red-green axis, so
those profiles move hazards onto the blue-yellow axis plus lightness. Tritanopia
collapses blue-yellow, so it moves them onto red-green. Shield (`#ffad66`) and
drifter (`#ff78c8`) actors get the same treatment; both already carry shape cues (a
plate and rim, an axis line), so colour only has to stay separable, never carry
meaning alone. The Standard profile is unchanged — this is a remap, not a redesign.

Palette changes apply live: hazards and actors already in the room are re-tinted
when the setting changes, not on the next room load.

**Not changed.** The vector line cyan, the landing-readability green and the
gravity-ring green are each the only element of their hue on screen, and are
separated from each other by position and shape rather than by hue comparison.

## Priority 4 — Audio-only information audit

Every cue in `src/audio/TraversalAudioManifest.ts` declares the visual signal that
carries the same information, and `npm run audio:doctor` fails the build if one does
not. See [AUDIO_MAPPING.md](./AUDIO_MAPPING.md) for the full table.

The new positional hazard audio is a *second* channel, never the only one: a sweep's
rhythm is audible **and** visible in its chevrons and pulse rate; a gate cycle is
audible **and** visible in the gate appearing and disappearing. The only cues allowed
to degrade to silence are `exit.enter` and `exit.loop`, which sit on top of the lit
gravity ring and the HUD objective line.

## Priority 5 — Text contrast

Measured with the WCAG 2.1 relative-luminance formula, compositing the panel
background (`rgba(3,12,22,α)`) over three representative backdrops: the dark
starfield `#06121f`, a mid-value platform `#1d3650`, and a bright bloom bloom-out
`#b8e8ff`.

| Element | Dark | Mid | Bright bloom | Verdict |
| --- | --- | --- | --- | --- |
| `#room-objective` / `#run-stats` — **before** | 6.37:1 | 5.88:1 | **2.89:1** | **fails AA** |
| `#room-objective` / `#run-stats` — after | 17.04:1 | 15.50:1 | 7.12:1 | AA |
| `#warp-hint` — before | 10.41:1 | 9.57:1 | **4.35:1** | large text only |
| `#warp-hint` — after | 14.98:1 | 13.40:1 | 5.33:1 | AA |
| `#run-primary` (room timer) | 18.27:1 | 16.61:1 | 7.63:1 | AA |
| `#anchor-status` (utility-actor resolve messages) | 18.17:1 | 16.76:1 | 8.67:1 | AA |
| `#tutorial-text` | 18.72:1 | 18.16:1 | 14.67:1 | AA |
| High Contrast plates | 18.71:1 | 18.54:1 | 17.57:1 | AAA |

Two real failures were found and fixed. `#room-objective` / `#run-stats` — which
carry the kill requirement and the Challenge miss budget — dropped to 2.89:1 over a
bright bloom backdrop; they now hold 7.12:1 at their worst. The warp hint was
AA-large-only at 4.35:1 and now clears AA for small text.

The room timer and the utility-actor resolve messages, called out as the highest
risk because they are small and transient, both already cleared AA and were left
alone rather than restyled.

## Optional — CVD authoring preview

`Colour Vision Preview` applies a Viénot/Brettel dichromat matrix over the whole
frame via an SVG `feColorMatrix`, toggleable while playing. It is the same idea as
the Map Editor's live vector-landing validation: sector authoring can self-check its
palette in place instead of needing an external simulator pass after the fact.
