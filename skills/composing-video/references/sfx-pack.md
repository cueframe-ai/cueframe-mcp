# SFX pack

Defaults, examples and detail for this topic. The [skill](../SKILL.md) and the [project and capability policy](project-policy.md) take precedence where they differ, and the current tool schemas are authoritative.

## SFX pack — the curated CC0 sound palette

CueFrame ships a **closed, versioned pack of CC0 sound effects** (40 sounds, all
peak-normalized). There are two ways to place them. **Automatically:** the compose
SFX pass binds them **deterministically** — a hit on every eligible graphic
entrance (family from the primitive: `impact` for hero/title, `pop` for
stat/value, `tick` for enumeration items), a `whoosh` on video transitions, and a
`riser` ending at the hero entrance — timed to the same frames as the overlay,
ducked under speech. **By hand:** a client author places any pack sound directly —
`import_resource { kind:"sfx-pack", id:"<soundId>" }` returns the org's media
receipt (`{ id, status:"ready" }`) for that sound, which you then drop in as a
normal sfx clip (`mediaId`). Idempotent per (org, soundId); an unknown soundId is
a loud 422. Same curated bytes either path.
Restraint (density caps, min spacing, speech collision) comes from the AUDIO_MIX
SSOT the eval floors grade with, so placement and grading can't disagree.

**Optional audio review:** the `sfx-same-sound-reuse` craft floor can report
when a dense mix (≥6 SFX hits) draws from too small a palette — distinct sounds ÷
hits below **0.4**. The pack carries **≥4 distinct sounds per transient family**
to support a varied palette. This is reported judge behavior, not a universal creative requirement: preserve intentional repetition or silence and assess it against the brief. Browse the full palette structurally on
`list_catalog` (the `sfx` array — `soundId`, `family`, `envelopeClass`,
`description`, `durationSec`).

**One palette, org sounds first.** `list_catalog` also returns an `audio` array —
the ONE unified sound palette: the curated packs (SFX one-shots **and** CC0 music
beds) unioned with THIS org's own uploads/imports (`source:"org"`) and generated
audio (`source:"generated"`), each entry a uniform `{ref, role, envelopeClass,
description, durationSec, evidence, source, license, provenance}` (music entries
carry `bpm`). Provenance rides every entry — pack attribution, `org-owned`, or the
generator + prompt. **Prefer an org sound when one fits the family/envelope class:**
an org that uploads its product's real UI sounds hears ITS product, not a generic
pack tick — the compose SFX pass does this automatically (org sound of the matching
envelope class beats the pack default, exactly like a brand kit overrides the
default font), and by hand you place an org `ref` (a `mediaId`) directly. **The
music tier is curated beds + a generate escape hatch:** browse the `source:"pack"`
`role:"music"` beds (each with `bpm` + mood, spanning slow/mid/fast) and place one
via `import_resource { kind:"music-pack", id:"<bedId>" }` (FREE, like sfx-pack); for
a bed the pack lacks, `generate_media { generator:"text-to-music" }`. Buy/curate SFX,
curate-or-generate music.

**Transient one-shots** (entrance hits, per-element ticks):

| family | soundIds (subtle→strong) |
|---|---|
| `tick` | `tick-soft` · `tick-toggle` · `tick-scroll` · `tick-select` · `tick-click` · `tick-mouse` · `tick-shutter` · `tick-switch` |
| `pop` | `pop-drop` · `pop-glass` · `pop-pluck` · `pop-drop-low` · `pop-bong` · `pop-confirm` |
| `impact` | `impact-generic` · `impact-soft` · `impact-tin` · `impact-metal` · `impact-wood` · `impact-firm` · `impact-punch` · `impact-bell` |
| `confirm` | `confirm-soft` · `confirm-chime` · `confirm-question` · `confirm-bright` |
| `error` | `error-soft` · `error-buzz` · `error-tone` · `error-hard` |

**Sweeps** (transitions + hero lead-in, ~0.15–1.2s):

| family | soundIds |
|---|---|
| `whoosh` | `whoosh-air` · `whoosh-whip` · `whoosh-page` · `whoosh-sweep` · `whoosh-phaser` · `whoosh-low` |
| `riser` | `riser-jump` · `riser-phaser` · `riser-sweep` · `riser-power` |

(The SFX pack is transient/sweep one-shots; a sustained bed is a MUSIC-role clip —
a curated `music-pack` bed or a `text-to-music` generation, not a pack hit; see the
`audio` palette above.) For a sound the pack lacks, search
CC0 stock at curation time via `search_resources { kind:"sfx" }` (Freesound,
duration-bounded) and `import_resource` it — the pack is the fast default, not the
ceiling. For a sound that doesn't exist anywhere, generate it:
`generate_media { generator: "text-to-sfx", prompt: "short bright metallic tick, fast decay, no tail" }`
(0.5–22s; the delivered file is envelope-checked before it goes ready).
