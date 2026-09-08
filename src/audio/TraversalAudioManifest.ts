/**
 * Canonical audio mapping table.
 *
 * This file is the single source of truth shared by three consumers:
 *   1. `scripts/build-audio.ts` — trims/encodes the authored WAV drop into `public/audio`.
 *   2. `scripts/audio-doctor.ts` — proves every semantic event resolves to a real asset
 *      or a deliberate procedural fallback, and that no gameplay-relevant cue is
 *      audio-only (fairness constitution, perceptual access clause).
 *   3. `src/audio/TraversalAudioEngine.ts` — runtime playback.
 *
 * Editing a mapping here changes the build, the audit, and the game together.
 */

/** Mix buses. Each maps onto the Shell's Master / Music / SFX volume sliders. */
export type AudioBus = "sfx" | "ui" | "world" | "music";

/** `core` ships in the boot bundle. `deferred` loads alongside `loadRoom()`. */
export type AudioTier = "core" | "deferred";

export interface AudioAssetSpec {
  /** Stable semantic id used by cues. */
  readonly id: string;
  /** Output filename under `public/audio/`. */
  readonly file: string;
  /** Path inside the authored `Traversal FPS SFX` drop. */
  readonly source: string;
  /** 1 = mono, required for PannerNode spatialisation. 2 = stereo, head-locked. */
  readonly channels: 1 | 2;
  /** Hard cap after silence-trim, in seconds. Tails beyond this are faded out. */
  readonly maxSeconds: number;
  /** Downsample before encoding. Worth it only for the low-frequency looping bed. */
  readonly sampleRate?: number;
  /**
   * Extra trim from the front, applied after silence-trim. Used to line a layered
   * take's transient up with the layer underneath it, so the pair reads as one hit
   * rather than two.
   */
  readonly headTrimSeconds?: number;
  /**
   * Seamless-loop asset. Encoded as WAV rather than AAC: encoder priming would
   * insert an audible gap at every loop point.
   */
  readonly loopCrossfadeSeconds?: number;
  /** Authored but intentionally unused. Kept so the drop stays fully accounted for. */
  readonly unused?: string;
}

export interface AudioCueSlot {
  /**
   * One entry = a fixed layer that always plays.
   * Several entries = alternates; one is chosen per trigger via `pick`.
   */
  readonly assets: readonly string[];
  readonly gain?: number;
  readonly delaySeconds?: number;
  /** `cycle` round-robins (no immediate repeats); `random` picks freely. */
  readonly pick?: "cycle" | "random";
}

export interface AudioCueSpec {
  readonly bus: AudioBus;
  /** Slots play together. This is how "layer these takes" is expressed. */
  readonly slots: readonly AudioCueSlot[];
  readonly gain?: number;
  /** Fractional playback-rate spread, e.g. 0.02 = ±2%. */
  readonly pitchJitter?: number;
  /** Retrigger guard for cues that can fire in bursts. */
  readonly cooldownMs?: number;
  /** Concurrent voice cap for this cue. */
  readonly maxVoices?: number;
  readonly tier: AudioTier;
  /** Routed through a PannerNode at a supplied world position. */
  readonly positional?: boolean;
  readonly loop?: boolean;
  /**
   * Part 2 / Priority 4 — audio-only information audit.
   * Every gameplay-relevant cue names the visual signal that carries the same
   * information. `"presentation-only"` means losing the sound loses nothing.
   */
  readonly visualPair: string;
  /**
   * Superseded name kept mapped so an older call site cannot fall silent. Exempt
   * from the "something must emit this" audit; still required to resolve to audio.
   */
  readonly deprecated?: string;
  readonly note?: string;
}

/**
 * The complete semantic vocabulary. Gameplay code emits meaning from this list;
 * it never names a file.
 */
export type TraversalAudioEvent =
  | "rifle.fire"
  | "vector.write"
  | "warp.commit"
  | "warp.arrive"
  | "rewind.begin"
  | "rewind.arrive"
  | "landing.adjust"
  | "sphere.resolve"
  | "shield.reject"
  | "actor.cube"
  | "actor.diamond"
  | "actor.prism"
  | "hazard.hit"
  | "hazard.sweep"
  | "hazard.gate-open"
  | "hazard.gate-close"
  | "hazard.field-on"
  | "hazard.field-off"
  | "hazard.aperture-shift"
  | "hazard.cycle"
  | "platform.activate"
  | "exit.online"
  | "exit.enter"
  | "exit.loop"
  | "sector.clear"
  | "sector.enter"
  | "achievement.unlock"
  | "ui.confirm"
  | "ui.back"
  | "ui.select"
  | "route.fail";

const S = "Traversal FPS SFX";

export const AUDIO_ASSETS: readonly AudioAssetSpec[] = [
  // ---- Rifle / vector grammar -------------------------------------------------
  {
    id: "rifle-fire-body",
    file: "rifle-fire-body.m4a",
    source: `${S}/rifle_fire_01/“Futuristic_spatial__#1-1788295355962.wav`,
    channels: 2,
    maxSeconds: 1.0
  },
  {
    id: "rifle-fire-air",
    file: "rifle-fire-air.m4a",
    source: `${S}/rifle_fire_01/“Futuristic_spatial__#1-1788295355960.wav`,
    channels: 2,
    maxSeconds: 1.0,
    // This take peaks 112.9ms in; the body take peaks at 10.7ms. Trimming the
    // difference puts both transients on the same instant, so the pair lands as one
    // report rather than a crack followed by a sizzle. The 102ms discarded here is
    // this take's slow swell into its peak, which is exactly what we do not want
    // under a weapon that fires every 320ms.
    headTrimSeconds: 0.1022
  },
  {
    id: "rifle-fire-swell",
    file: "rifle-fire-swell.m4a",
    source: `${S}/rifle_fire_01/“Futuristic_spatial__#4-1788295355961.wav`,
    channels: 2,
    maxSeconds: 1.0,
    unused: "231ms attack — a swell, not a report. At the rifle's 320ms cadence it smears into the following shot, and next to the other two takes it reads as a different weapon."
  },
  { id: "vector-write-body", file: "vector-write-body.m4a", source: `${S}/vector_write/A_spatial_coordinate_#2-1788295356088.wav`, channels: 2, maxSeconds: 1.0 },
  { id: "vector-write-shimmer", file: "vector-write-shimmer.m4a", source: `${S}/vector_write/A_spatial_coordinate_#3-1788295356089.wav`, channels: 2, maxSeconds: 0.9 },

  // ---- Warp -------------------------------------------------------------------
  { id: "warp-commit", file: "warp-commit.m4a", source: `${S}/warp_commit/“Instantaneous_spati_#4-1788295484484.wav`, channels: 2, maxSeconds: 1.2 },
  { id: "warp-transit-a", file: "warp-transit-a.m4a", source: `${S}/warp_transit_short/“Extremely_short_fir_#1-1788297272115.wav`, channels: 2, maxSeconds: 1.1 },
  { id: "warp-transit-b", file: "warp-transit-b.m4a", source: `${S}/warp_transit_short/“Extremely_short_fir_#2-1788297253452.wav`, channels: 2, maxSeconds: 1.1 },
  { id: "warp-arrive-a", file: "warp-arrive-a.m4a", source: `${S}/warp_arrive/“Human-scale_telepor_#4-1788295530477.wav`, channels: 2, maxSeconds: 1.6 },
  { id: "warp-arrive-b", file: "warp-arrive-b.m4a", source: `${S}/warp_arrive/“Human-scale_telepor_#4-1788295550617.wav`, channels: 2, maxSeconds: 1.6 },

  // ---- Rewind -----------------------------------------------------------------
  { id: "rewind-begin-body", file: "rewind-begin-body.m4a", source: `${S}/rewind_begin/“Spatial_teleportati_#3-1788296272071.wav`, channels: 2, maxSeconds: 1.5 },
  { id: "rewind-begin-air", file: "rewind-begin-air.m4a", source: `${S}/rewind_begin/“Spatial_teleportati_#2-1788296307715.wav`, channels: 2, maxSeconds: 1.5 },
  { id: "rewind-begin-tail", file: "rewind-begin-tail.m4a", source: `${S}/rewind_begin/“Spatial_teleportati_#3-1788296317927.wav`, channels: 2, maxSeconds: 1.5 },
  { id: "rewind-arrive", file: "rewind-arrive.m4a", source: `${S}/rewind_arrive/“Reverse_teleport_se_#4-1788296373527.wav`, channels: 2, maxSeconds: 1.6 },

  // ---- Spatial actors ---------------------------------------------------------
  { id: "sphere-resolve-a", file: "sphere-resolve-a.m4a", source: `${S}/sphere_resolve/“Glowing_energy_sphe_#1-1788295637998.wav`, channels: 2, maxSeconds: 1.4 },
  { id: "sphere-resolve-b", file: "sphere-resolve-b.m4a", source: `${S}/sphere_resolve/“Glowing_energy_sphe_#2-1788295636559.wav`, channels: 2, maxSeconds: 1.4 },
  { id: "sphere-resolve-shimmer", file: "sphere-resolve-shimmer.m4a", source: `${S}/sphere_resolve/“Glowing_energy_sphe_#2-1788295609174.wav`, channels: 2, maxSeconds: 1.2 },
  { id: "shield-reject-a", file: "shield-reject-a.m4a", source: `${S}/shield_reject/“Futuristic_energy_p_#1-1788295709225.wav`, channels: 2, maxSeconds: 1.2 },
  { id: "shield-reject-b", file: "shield-reject-b.m4a", source: `${S}/shield_reject/“Futuristic_energy_p_#4-1788295709226.wav`, channels: 2, maxSeconds: 1.2 },
  { id: "cube-resolve-body", file: "cube-resolve-body.m4a", source: `${S}/Spatial Actor/cube_activate/“Geometric_technolog_#3-1788297381733.wav`, channels: 2, maxSeconds: 1.6 },
  { id: "cube-resolve-detail", file: "cube-resolve-detail.m4a", source: `${S}/Spatial Actor/cube_activate/“Geometric_technolog_#1-1788297360589.wav`, channels: 2, maxSeconds: 1.6 },
  { id: "diamond-resolve", file: "diamond-resolve.m4a", source: `${S}/Spatial Actor/diamond_activate/“Futuristic_motion_s_#4-1788297426660.wav`, channels: 2, maxSeconds: 1.6 },
  { id: "prism-resolve", file: "prism-resolve.m4a", source: `${S}/Spatial Actor/“Futuristic_motion_s_#1-1788297575664.wav`, channels: 2, maxSeconds: 1.6 },
  { id: "landing-adjust", file: "landing-adjust.m4a", source: `${S}/landing_adjust/“Extremely_subtle_fu_#4-1788296423992.wav`, channels: 2, maxSeconds: 0.7 },

  // ---- Hazards (mono: spatialised) -------------------------------------------
  { id: "hazard-hit", file: "hazard-hit.m4a", source: `${S}/hazard_hit/“Player_intersects_a_#1-1788296223411.wav`, channels: 2, maxSeconds: 1.2 },
  { id: "sweep-pass", file: "sweep-pass.m4a", source: `${S}/sweep_pass/“Fast_lethal_energy__#2-1788297815331.wav`, channels: 1, maxSeconds: 1.2 },
  { id: "gate-open", file: "gate-open.m4a", source: `${S}/gate_open/“Futuristic_energy_g_#1-1788297898779.wav`, channels: 1, maxSeconds: 1.0 },
  { id: "gate-close-a", file: "gate-close-a.m4a", source: `${S}/gate_close/“Futuristic_energy_g_#2-1788297953997.wav`, channels: 1, maxSeconds: 1.0 },
  { id: "gate-close-b", file: "gate-close-b.m4a", source: `${S}/gate_close/“Futuristic_energy_g_#3-1788297954000.wav`, channels: 1, maxSeconds: 1.0 },
  { id: "field-on", file: "field-on.m4a", source: `${S}/hazard_field_on/“Large_futuristic_le_#3-1788297651099.wav`, channels: 1, maxSeconds: 1.6 },
  { id: "field-off", file: "field-off.m4a", source: `${S}/hazard_field_off/“Large_energy_barrie_#1-1788297754405.wav`, channels: 1, maxSeconds: 1.6 },
  { id: "aperture-shift-body", file: "aperture-shift-body.m4a", source: `${S}/aperture_shift/“Large_spatial_apert_#1-1788298040521.wav`, channels: 1, maxSeconds: 1.7 },
  { id: "aperture-shift-air", file: "aperture-shift-air.m4a", source: `${S}/aperture_shift/“Large_spatial_apert_#2-1788298033815.wav`, channels: 1, maxSeconds: 1.7 },
  { id: "platform-activate", file: "platform-activate.m4a", source: `${S}/platform_activate/“Massive_floating_pl_#2-1788298108903.wav`, channels: 1, maxSeconds: 1.8 },

  // ---- Gravity ring (sector exit) --------------------------------------------
  { id: "gravity-ring-online-body", file: "gravity-ring-online-body.m4a", source: `${S}/gravity ring/gravity_ring_online/“Passing_through_a_l_#3-1788295885290.wav`, channels: 1, maxSeconds: 2.0 },
  { id: "gravity-ring-online-swell", file: "gravity-ring-online-swell.m4a", source: `${S}/gravity ring/gravity_ring_online/“Large_dormant_gravi_#1-1788295841789.wav`, channels: 1, maxSeconds: 2.0 },
  { id: "gravity-ring-enter", file: "gravity-ring-enter.m4a", source: `${S}/gravity ring/gravity_ring_enter/“Passing_through_a_l_#1-1788295958963.wav`, channels: 1, maxSeconds: 1.7 },
  { id: "gravity-ring-loop", file: "gravity-ring-loop.wav", source: `${S}/gravity ring/gravity_ring_active_loop — probably valuable/“Stable_active_gravi_#1-1788297199181.wav`, channels: 1, maxSeconds: 2.0, sampleRate: 24000, loopCrossfadeSeconds: 0.4 },

  // ---- Progression / UI -------------------------------------------------------
  { id: "sector-enter-campaign", file: "sector-enter-campaign.m4a", source: `${S}/sector_enter/“Minimal_futuristic__#4-1788296047234.wav`, channels: 2, maxSeconds: 2.0 },
  { id: "sector-enter-course", file: "sector-enter-course.m4a", source: `${S}/sector_enter/“Minimal_futuristic__#4-1788296054706.wav`, channels: 2, maxSeconds: 2.0 },
  { id: "sector-clear", file: "sector-clear.m4a", source: `${S}/sector_clear/“Abstract_futuristic_#1-1788296121057.wav`, channels: 2, maxSeconds: 1.6 },
  { id: "achievement-body", file: "achievement-body.m4a", source: `${S}/achievement_unlock/“Elegant_futuristic__#3-1788296485987.wav`, channels: 2, maxSeconds: 2.0 },
  { id: "achievement-air", file: "achievement-air.m4a", source: `${S}/achievement_unlock/“Elegant_futuristic__#4-1788296492939.wav`, channels: 2, maxSeconds: 2.0 },
  { id: "ui-confirm", file: "ui-confirm.m4a", source: `${S}/UI/ui_confirm/“Clean_futuristic_in_#1-1788296934242.wav`, channels: 2, maxSeconds: 0.9 },
  { id: "ui-back", file: "ui-back.m4a", source: `${S}/UI/ui_back/“Clean_futuristic_in_#2-1788296950202.wav`, channels: 2, maxSeconds: 0.9 },
  {
    id: "ui-nav-tick",
    file: "ui-nav-tick.m4a",
    source: `${S}/UI/ui_hover/“Extremely_subtle_fu_#1-1788296794580.wav`,
    channels: 2,
    maxSeconds: 0.5
  },
  {
    id: "ui-menu-select",
    file: "ui-menu-select.m4a",
    source: `${S}/UI/ui_error/menu select SFX TraversalFPS.wav`,
    channels: 2,
    maxSeconds: 0.7,
    unused: "Confirm-weight, too substantial to fire on every row a player passes through. The ui_confirm take already covers activation; this is the alternate for it if that one ever feels too light."
  },
  { id: "route-fail", file: "route-fail.m4a", source: `${S}/UI/ui_error/“Minimal_futuristic__#4-1788297007444.wav`, channels: 2, maxSeconds: 0.9 },


  // ---- Authored, intentionally unused ----------------------------------------
  {
    id: "gravity-ring-dormant-a",
    file: "gravity-ring-dormant-a.m4a",
    source: `${S}/gravity ring/gravity_ring_dormant_loop — optional later/“Very_quiet_dormant__#1-1788297135237.wav`,
    channels: 1,
    maxSeconds: 2.0,
    unused: "Author marked this 'optional later'. A dormant-ring bed would sit under every locked exit for the whole run; held back until the mix is judged with the active loop in place."
  },
  {
    id: "gravity-ring-dormant-b",
    file: "gravity-ring-dormant-b.m4a",
    source: `${S}/gravity ring/gravity_ring_dormant_loop — optional later/“Very_quiet_dormant__#3-1788297140026.wav`,
    channels: 1,
    maxSeconds: 2.0,
    unused: "Second dormant take. Same reasoning as gravity-ring-dormant-a."
  }
];

export const AUDIO_CUES: Readonly<Record<TraversalAudioEvent, AudioCueSpec>> = {
  // --- Core loop --------------------------------------------------------------
  "rifle.fire": {
    bus: "sfx",
    tier: "core",
    gain: 0.85,
    // With no round-robin, jitter is what keeps a 320ms cadence from sounding
    // mechanical. Both layers move together, so the weapon stays one object.
    pitchJitter: 0.03,
    maxVoices: 4,
    slots: [
      { assets: ["rifle-fire-body"] },
      { assets: ["rifle-fire-air"], gain: 0.5 }
    ],
    visualPair: "Muzzle FX + shot trace + `body.rifle-fired` impulse.",
    note: "Layered, not alternated. The three authored takes are not peers: one has a 10.7ms transient and 65% of its energy below 200Hz, one is bright and airy with a weak low end, one is a 231ms swell. Round-robin across them read as three different weapons. The first two are complementary, so they layer into a single consistent report — body plus air — and the swell is held back."
  },
  "vector.write": {
    bus: "sfx",
    tier: "core",
    gain: 0.72,
    slots: [
      { assets: ["vector-write-body"] },
      { assets: ["vector-write-shimmer"], gain: 0.85, delaySeconds: 0.012 }
    ],
    visualPair: "Live warp vector line + beam + `WARP VECTOR WRITTEN` flash message.",
    note: "Layered: take #2 is the body, take #3 is a near-silent bright shimmer. Complementary, so both play."
  },
  "warp.commit": {
    bus: "sfx",
    tier: "core",
    gain: 0.95,
    slots: [
      { assets: ["warp-commit"] },
      { assets: ["warp-transit-a"], gain: 0.5, delaySeconds: 0.02 },
      { assets: ["warp-transit-b"], gain: 0.32, delaySeconds: 0.04 }
    ],
    visualPair: "Endpoint burst, destination lock, warp streaks, `body.warp-committed`.",
    note: "Layered: commit transient + both short-transit takes staggered. Transits are usually under 200ms, so transit reads as the tail of the commit rather than a separate cue."
  },
  "warp.arrive": {
    bus: "sfx",
    tier: "core",
    gain: 0.9,
    pitchJitter: 0.015,
    slots: [{ assets: ["warp-arrive-a", "warp-arrive-b"], pick: "cycle" }],
    visualPair: "Arrival burst FX + `body.warp-arrival` flash.",
    note: "Peer takes at similar level and brightness, so they alternate instead of layering."
  },
  "rewind.begin": {
    bus: "sfx",
    tier: "deferred",
    gain: 0.85,
    slots: [
      { assets: ["rewind-begin-body"] },
      { assets: ["rewind-begin-air"], gain: 0.6, delaySeconds: 0.015 },
      { assets: ["rewind-begin-tail"], gain: 0.9, delaySeconds: 0.03 }
    ],
    visualPair: "`REWINDING LAST WARP` hint + `body.rewinding` + reverse transit.",
    note: "Layered: one loud body, one mid, one very quiet bright tail. Rewind is rare and dramatic, so richness beats variety."
  },
  "rewind.arrive": {
    bus: "sfx",
    tier: "deferred",
    gain: 0.85,
    slots: [{ assets: ["rewind-arrive"] }],
    visualPair: "Arrival burst FX + hint clears."
  },
  "sphere.resolve": {
    bus: "sfx",
    tier: "core",
    gain: 0.9,
    pitchJitter: 0.02,
    slots: [
      { assets: ["sphere-resolve-a", "sphere-resolve-b"], pick: "cycle" },
      { assets: ["sphere-resolve-shimmer"], gain: 0.5, delaySeconds: 0.008 }
    ],
    visualPair: "Kill FX burst + sphere count in HUD + vector written.",
    note: "Both: two peer takes alternate, and the third — a bright shimmer take — layers on every hit as a constant top end."
  },
  "shield.reject": {
    bus: "sfx",
    tier: "core",
    gain: 0.95,
    slots: [{ assets: ["shield-reject-a", "shield-reject-b"], pick: "cycle" }],
    visualPair: "`TARGET REJECT // CHANGE YOUR FIRING ORIGIN` flash + orange impact FX + `body.target-blocked` reticle."
  },
  "landing.adjust": {
    bus: "sfx",
    tier: "core",
    gain: 1,
    cooldownMs: 90,
    slots: [{ assets: ["landing-adjust"] }],
    visualPair: "Warp gauge percentage + stop-short readout + landing ring."
  },

  // --- Utility actors: fairness-critical --------------------------------------
  "actor.cube": {
    bus: "sfx",
    tier: "core",
    gain: 1,
    slots: [
      { assets: ["cube-resolve-body"] },
      { assets: ["cube-resolve-detail"], gain: 0.7, delaySeconds: 0.02 }
    ],
    visualPair: "`CUBE RESOLVED // BARRIER STATE CHANGED` flash + impact FX + the hazard visibly disappearing.",
    note: "Layered: a low body take plus a bright geometric detail take."
  },
  "actor.diamond": {
    bus: "sfx",
    tier: "core",
    gain: 1,
    slots: [{ assets: ["diamond-resolve"] }],
    visualPair: "`DIAMOND RESOLVED // MOTION ONLINE` flash + impact FX + the platform visibly starting to move."
  },
  "actor.prism": {
    bus: "sfx",
    tier: "core",
    gain: 1,
    slots: [{ assets: ["prism-resolve"] }],
    visualPair: "`PRISM RESOLVED // ENERGY REROUTED` flash + impact FX + the aperture visibly shifting.",
    note: "The loose `Spatial Actor/Futuristic_motion_s_#1` take. It was the only unfiled actor asset and Prism was the only unmapped actor."
  },

  // --- Hazards: positional second information channel -------------------------
  "hazard.hit": {
    bus: "sfx",
    tier: "core",
    gain: 1,
    slots: [{ assets: ["hazard-hit"] }],
    visualPair: "`body.hazard-hit` screen flash + immediate room restart."
  },
  "hazard.sweep": {
    bus: "world",
    tier: "deferred",
    gain: 0.62,
    positional: true,
    // Just enough to stop a pathological retrigger; low enough that two sweeps
    // flipping close together are still two audible events.
    cooldownMs: 90,
    maxVoices: 6,
    slots: [{ assets: ["sweep-pass"] }],
    visualPair: "The sweep blade itself: bright core, chevron pattern, fast pulse rate.",
    note: "Fires at each end of the sweep's drift cycle, panned to the blade's world position. A player can hear the rhythm and rough bearing without looking."
  },
  "hazard.gate-open": {
    bus: "world",
    tier: "deferred",
    gain: 0.5,
    positional: true,
    cooldownMs: 90,
    maxVoices: 6,
    slots: [{ assets: ["gate-open"] }],
    visualPair: "The sightline gate becoming transparent/non-solid."
  },
  "hazard.gate-close": {
    bus: "world",
    tier: "deferred",
    gain: 0.5,
    positional: true,
    cooldownMs: 90,
    maxVoices: 6,
    slots: [{ assets: ["gate-close-a", "gate-close-b"], pick: "cycle" }],
    visualPair: "The sightline gate becoming solid, with bars visible."
  },
  "hazard.field-on": {
    bus: "world",
    tier: "deferred",
    gain: 0.7,
    positional: true,
    cooldownMs: 90,
    maxVoices: 4,
    slots: [{ assets: ["field-on"] }],
    visualPair: "Lethal field re-appearing with its slow breathing pulse."
  },
  "hazard.field-off": {
    bus: "world",
    tier: "deferred",
    gain: 0.7,
    positional: true,
    cooldownMs: 90,
    maxVoices: 4,
    slots: [{ assets: ["field-off"] }],
    visualPair: "Lethal field disappearing — the safe window."
  },
  "hazard.aperture-shift": {
    bus: "world",
    tier: "deferred",
    gain: 0.9,
    positional: true,
    slots: [
      { assets: ["aperture-shift-body"] },
      { assets: ["aperture-shift-air"], gain: 0.8, delaySeconds: 0.02 }
    ],
    visualPair: "The aperture void frame visibly moving + the Prism resolve message.",
    note: "Layered: two takes of the same move, one bodied and one airy."
  },
  "hazard.cycle": {
    bus: "world",
    tier: "deferred",
    gain: 0.5,
    positional: true,
    cooldownMs: 160,
    slots: [{ assets: ["gate-close-a"] }],
    visualPair: "Whatever the specific hazard's cycle does on screen.",
    deprecated: "Superseded by the specific hazard.gate-* / hazard.field-* cues. Retained so any call site still using the generic name plays something."
  },
  "platform.activate": {
    bus: "world",
    tier: "deferred",
    gain: 0.8,
    positional: true,
    slots: [{ assets: ["platform-activate"] }],
    visualPair: "The platform starting to travel + `DIAMOND RESOLVED // MOTION ONLINE`."
  },

  // --- Sector exit -------------------------------------------------------------
  "exit.online": {
    bus: "world",
    tier: "deferred",
    gain: 1,
    positional: true,
    slots: [
      { assets: ["gravity-ring-online-body"] },
      { assets: ["gravity-ring-online-swell"], gain: 0.75, delaySeconds: 0.04 }
    ],
    visualPair: "`GRAVITY RING ONLINE // ENTER TO ADVANCE` flash + the ring lighting from locked grey to ready green.",
    note: "Layered: the activation transient plus the dormant-mass swell underneath it."
  },
  "exit.enter": {
    bus: "world",
    tier: "deferred",
    gain: 0.9,
    positional: true,
    slots: [{ assets: ["gravity-ring-enter"] }],
    visualPair: "Sector clear transition."
  },
  "exit.loop": {
    bus: "world",
    tier: "deferred",
    gain: 0.34,
    positional: true,
    loop: true,
    slots: [{ assets: ["gravity-ring-loop"] }],
    visualPair: "The lit gravity ring itself, plus the HUD objective line.",
    note: "Positional bed that only runs while the exit is actually open. It tells you where the exit is without looking — the same job the ground cue does for landings."
  },

  // --- Progression -------------------------------------------------------------
  "sector.enter": {
    bus: "music",
    tier: "core",
    gain: 0.8,
    slots: [{ assets: ["sector-enter-campaign", "sector-enter-course"] }],
    visualPair: "Sector transition card with kicker + title.",
    note: "Not a round-robin: Campaign picks the fuller take, timed/challenge modes the leaner one. Selected by `detail.campaign`."
  },
  "sector.clear": {
    bus: "music",
    tier: "core",
    gain: 0.9,
    slots: [{ assets: ["sector-clear"] }],
    visualPair: "Sector clear overlay + run stats."
  },
  "achievement.unlock": {
    bus: "music",
    tier: "deferred",
    gain: 0.85,
    slots: [
      { assets: ["achievement-body"] },
      { assets: ["achievement-air"], gain: 0.7, delaySeconds: 0.05 }
    ],
    visualPair: "Achievement toast.",
    note: "Layered: a warm take and a bright take. Rare enough that richness wins."
  },

  // --- UI ----------------------------------------------------------------------
  // Holding left/right on an adjustable Settings row re-activates it on a repeat
  // timer, so confirm and back carry a short retrigger guard.
  "ui.confirm": { bus: "ui", tier: "core", gain: 0.7, cooldownMs: 55, slots: [{ assets: ["ui-confirm"] }], visualPair: "Screen change / row activation. presentation-only." },
  "ui.back": { bus: "ui", tier: "core", gain: 0.7, cooldownMs: 55, slots: [{ assets: ["ui-back"] }], visualPair: "Screen change. presentation-only." },
  "ui.select": {
    bus: "ui",
    tier: "core",
    // A row tick fires more often than any other menu sound, so it sits well under
    // confirm and back rather than level with them.
    gain: 0.4,
    cooldownMs: 45,
    slots: [{ assets: ["ui-nav-tick"] }],
    visualPair: "Focus ring moves. presentation-only.",
    note: "Keyboard and controller only. Moving a mouse across a list is passive — it sweeps several rows in one gesture and the focus styling already shows where you are — so pointer hover is deliberately silent."
  },
  "route.fail": {
    bus: "sfx",
    tier: "core",
    gain: 0.8,
    slots: [{ assets: ["route-fail"] }],
    visualPair: "`CLEAN ROUTE FAILED // …` flash message + the run resetting the room.",
    note: "The authored ui_error take earns its keep on the one denial a player actually meets: a Challenge clean-route failure. The Shell skips disabled menu rows, so a menu error state is unreachable and wiring it there would have been dead audio."
  }
};

export const AUDIO_EVENT_IDS = Object.keys(AUDIO_CUES) as TraversalAudioEvent[];

export function audioAsset(id: string): AudioAssetSpec | undefined {
  return AUDIO_ASSETS.find((asset) => asset.id === id);
}

/** Assets a cue can reach, ignoring which alternate a given trigger picks. */
export function cueAssetIds(cue: AudioCueSpec): string[] {
  return cue.slots.flatMap((slot) => [...slot.assets]);
}

export const CORE_AUDIO_ASSET_IDS: readonly string[] = [
  ...new Set(
    AUDIO_EVENT_IDS
      .filter((id) => AUDIO_CUES[id].tier === "core")
      .flatMap((id) => cueAssetIds(AUDIO_CUES[id]))
  )
];
