---
name: composing-video
description: Use when an agent is asked to make ANY video with CueFrame — a product launch, announcement, promo, teaser, social clip, reel, short, explainer, animated explainer, concept video, product/dev-tool demo, walkthrough, or founder/talking-head piece. Triggers on "make a video", "launch video", "promo", "teaser", "reel", "short", "explainer", "animated explainer", "demo video", "talking-head", or turning long-form footage into clips.
---

# Composing Video: craft for CueFrame

## Scope and capability policy

User intent and acceptance criteria override this recipe's aesthetic defaults. Silent, typography-only, uncaptioned and slow work are valid; no universal narration, footage, CTA, beat count or score target. Contracts, factual fidelity, media bindings and current source revisions remain mandatory.

Read available tools and current project; preserve the chosen local/hosted lane. Supported local work needs no hosted registration. Do not silently install, authenticate, switch projects or upload local content. Before metered hosted work, check `get_account`, entitlements, balance and quotes. Desktop setup: https://docs.cueframe.ai.

For scoped revisions, preserve unrelated timing, media, audio and shared brand-kit state. Edit affected content; inspect relevant frames, continuous motion and affected audio. No restarted intake, new approval pause, paid judge or final export by default. Judge only when useful; scores never override acceptance failures. Stop/report after two no-improvement passes. See [preview workflow](../cueframe-compose-loop/references/preview-workflow.md).

For preview selection and small revisions, use `cueframe-compose-loop`'s
[preview workflow](../cueframe-compose-loop/references/preview-workflow.md). Retain the approved
brief/rubric for a local correction; check the affected behavior and relevant regressions instead
of restarting the new-film method below. A diagnostic or preview-only request does not require
a final export or a whole-film judge pass. Explicit user scope takes precedence over craft defaults.

## Learned taste: the org's saved style preferences

Before composing for an org, read its learned taste: `get_profile` returns it as `taste`, and Eve recalls it into every turn. It is advice, never instruction. Precedence, highest first: the current request, the brief, the project, the brand kit, exclusions and registered critics, then learned taste. When learned taste conflicts with any of those, follow the higher one and say which preference you set aside; never resolve a conflict silently.

Save a preference only when the user states a durable one: a revise comment, a correction in chat, or an explicit "remember this". Never save one-off brief content, facts about footage, approval notes or anything secret. Every save names its source (the job, checkpoint or chat, plus the date). Save with your runtime's taste tool (Eve: `taste__remember`; MCP: `remember_taste`; HTTP: `POST /v1/profile/taste`).

Tell the user every time you save or forget: "Added to your profile: <preference>. Say undo to remove it." Undo forgets that entry (`taste__forget`, `forget_taste`, or `DELETE /v1/profile/taste/{id}`). When the user says not to learn from this job, save nothing for the rest of it. A refusal (the entry is too long, the org's taste is full, or the owner turned learned taste off) is final: tell the user, and do not retry or shorten the preference silently.

## Plan and author to the request

Use `cueframe-storyboard` only when new work lacks structure. For an existing title correction, retain the approved brief and edit the title directly; no whole-film rubric, paid judge or final export is required.

Choose content that serves the requested idea. Real footage, actual product captures, sourced data, diagrams, abstract motion and typography are all valid. Do not fabricate facts or present simulated UI as a real product capture. Search for footage when the request needs it; an explicit typography-only request needs no footage hunt or permission to remain typography-only.

For new work, state concise acceptance criteria from the brief before authoring. For broader review, reuse the approved criteria. Preview affected frames, inspect motion in the relevant window and listen when sound changes. Validate contracts and source/media bindings independently of aesthetic review. For face/active-speaker framing or behind-subject graphics, prepare the required subjectTrack/matte for the exact source trim window and wait for ready evidence; unresolved perception is not acceptable preview proof.

Use `score_composition` only when its broader editorial critique is useful, available and within budget. The hosted judge has editorial, spatial, brand and caption criteria; `editorialIntent` does not remove fixed criteria. A caption penalty for intentionally uncaptioned or silent work is a judge limitation, not a reason to add captions or declare user intent failed. Skill text does not repair the judge. Stop after two no-improvement passes and report gaps.

## Choose the film spine from the leading material

- Narrated explainer: draft the script, align visuals to its phrases, verify intelligibility and any requested captions against actual word timings.
- Recorded interview: preserve meaning and source order where required; cut and frame from the transcript and actual speaker evidence, with no invented narration.
- Product action: plan around real captured interactions and results; add voice or music only when requested or appropriate.
- Silent brand study or typography: plan visual rhythm, reading time and transitions directly. Silence is already decided by the request; no audio generation or footage requirement.
- Visual/music motion or observational sequence: use the chosen motion, music, activity or deliberate holds as the timing authority. No universal beat count, cut interval or CTA.

Use `cueframe-component-authoring` for custom 2D motion. Load `cueframe-scene-shot` for supported device, camera or 3D tasks. `cueframe-compose-loop` owns scoped preview and optional review; `video-craft-standards` supplies aesthetic defaults under the scope policy above.

### The card token contract — `tokens` key `x` is read as `var(--cf-x)`

A `{kind:'card', html, tokens}` clip binds brand-swappable values through `tokens`. Each
**key** is projected onto the card's wrapper as a CSS custom property with a `--cf-`
prefix, so the html reads it back **prefixed**:

```jsonc
{ "kind": "card", "tokens": { "plate": "#0af", "fg": "$brand:colors.text" },
  "html": "<div style=\"background:var(--cf-plate);color:var(--cf-fg)\">…</div>" }
```

Values may be literals or whole-string `$brand:<path>` refs (resolved against the
project's brand kit at render).

**Do not put dashes in the key.** `tokens: {"--plate": …}` projects to `--cf---plate`, so
the card's `var(--plate)` matches nothing — and CSS treats an undefined custom property as
*invalid at computed-value time*, which means it does not error, it **degrades**:
`background` falls back to transparent and `color` inherits (usually black). The render
succeeds and the graphic is unreadable. `apply_composition` returns `warnings[]` when it
catches this, but the fix is to never write the dashes.

Two `--cf-*` families share the wrapper: **your token vars** (above) and the **motion
vars** below, which are always injected and are not yours to declare.

### The motion runtime — three ways anything you author can move

CSS `@keyframes`/`transition` **never animate in a render** (frames are independent
Chromium captures; the clock never advances). Use these instead:

1. **Card motion vars (`--cf-*`)** — every card's wrapper carries frame-driven, unitless
   custom properties: `--cf-progress` (0→1 across the clip), `--cf-ease` (eased progress),
   `--cf-enter` (0→1 over the first ~0.6s), `--cf-exit` (1→0 over the last ~0.6s), plus
   `--cf-frame` / `--cf-t` / `--cf-fps` / `--cf-duration`. Author motion directly in card
   CSS: `opacity: var(--cf-enter)`, `transform: translateY(calc((1 - var(--cf-enter)) * 40px))`,
   an exit slide via `--cf-exit`. This supports entrance/exit choreography within the
   card medium — and a `preview_frame` still at time *t* shows the exact *t*-frozen state.
2. **`transitionIn` on any overlay clip** — `{ transitionIn: { type: "fade", duration: 0.4 } }`
   now applies to overlay-family clips (cards, components, primitives), not just video.
   Use it for entrances; author exits in-card via `--cf-exit`.
3. **`clip.setKeyframes` op** — animate the whole clip on one channel:
   `{ type: "clip.setKeyframes", clipId, property, keyframes: [{ time, value, ease? }, …] }`
   for `opacity`, `scale`, `rotation`, `position.x` or `position.y` (times in seconds from the
   clip's start). For motion beyond that, author a native component with `create_component`.

---

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

### Audio design — how to USE sounds (canonical doctrine + our calibration)

This is established film/UI sound-design craft — Chion, Murch, Thom, and the
Material sound guidelines — with the numbers calibrated on our own measured films.
The stakes are empirical, not aesthetic: films with sound effects measure >3x higher
perceived immersion than without (Kock & Louven), and audio-aware models consistently
beat vision-only models at predicting short-video engagement (VQualA 2025) — the
soundtrack is a measurable share of whether anyone keeps watching.

0. **Who owns time — pick the rhythm authority FIRST.** Before any hit or bed,
   decide what the cut serves. A film has ONE rhythm authority (word timings, beat
   maps, and shot boundaries are the same TYPE — a temporal grid; pick which one
   drives). **VO-driven** (a narration film): cut every beat boundary to the
   *voice* (author the script first for a narrated piece, then read the word grid
   off `get_media_context` — `wordGrid.wordTimesMs`, the word onsets in ms — and
   land each cut/caption on a word). **Music-driven** (a montage/no-VO piece): cut
   on the *beat* — read `beatGrid` off `get_media_context` (bpm + `beatTimesMs`),
   land cut points and transition MIDPOINTS on beats, and resolve risers exactly on
   a downbeat/strong beat (every 4th beat from the grid start). A grid is EVIDENCE,
   not autopilot — you choose which beats carry cuts; on-beat reads as craft,
   off-beat as accident (synchresis, Chion). Trust `beatGrid` for cutting when its
   `confidence` is high; a beatless bed reports low and carries no reliable grid.
   Once you have picked the authority, **materialize its grid onto the timeline
   with the `materializeGrid` op** (`{clipId, grid:"beat"|"word", maxMarkers?}`):
   the server reads that clip's source grid and lands `kind:"beat"|"word"` markers
   at the correct TIMELINE times (projected through the clip's trim/playbackRate/
   excludedRanges — you never do the media→timeline math yourself). Then place cuts
   and transition **midpoints** on the markers — a transition's midpoint IS the cut
   point, so start a 0.5s transition 0.25s *before* the marker so its center lands
   on the beat. Materialize ONCE per authority clip; re-running the op refreshes the
   markers in place (it replaces the prior set from the same clip+grid), so re-run
   after you retrim or restretch the clip. (`grid:"shot"` is reserved — not exposed
   yet.)

0b. **Declare the audio's ROLE at ingest — evidence follows the declaration.**
   Uploads/imports accept an optional `audioRole: vo|music|sfx|ambience` (finalize
   and import bodies). Declaring it routes enrichment: `vo` → transcript + word
   grid; `music` → `beatGrid` (detected, no prompt needed); `sfx`/`ambience` →
   `envelope` evidence on `get_media_context` (`envelopeClass:
   transient|sweep|ambient` + attackMs/crest stats — pick pack-style hits by
   class, not by listening). Undeclared audio is transcribed as before, and a
   no-speech file still comes back envelope-classed. **`ambience` is the fourth
   role**: a bed that grounds the SPACE — it loops, sits at the bottom of the mix,
   and HOLDS under VO (it is never ducked; only `music` ducks under speech). Use
   ambience for room tone/atmosphere continuity across cuts (the room-changes
   floor's natural fix), never for anything that must be *noticed*.

0c. **The engine owns the default mix — author levels only to deviate.** A clip
   tagged with an `audioRole` but no authored `volumeDb`/`volume` is auto-staged
   to the clarity hierarchy (VO 0 dB, sfx −6, music −16 under VO else −8,
   ambience −22 — keeping VO ≥6 dB over the bed). An authored level always wins,
   a role-less clip stays at unity, and authored levels that invert the hierarchy
   (e.g. music over VO) raise a non-blocking `mix_hierarchy_inverted` warning on
   `create_render` naming the offending clips. Tag roles and let the engine mix;
   reach for `volumeDb` only when you intend to break the hierarchy.

0d. **A brand kit can carry a SOUND identity — set it once, it rides every
   compose.** `create_brand_kit`'s `audio` block (echoed on
   `get_profile`) holds the brand's sonic taste; every ref is a palette reference
   (a pack `soundId` | `bedId` | an org `mediaId` from `list_catalog`'s `audio[]`).
   Four optional fields, resolution precedence **brand > org > pack** (the audio
   analog of how a brand FONT sits above org/pack defaults):
   - **`sonicLogo` `{ ref, placement: intro|outro|both, offsetMs? }`** — the brand
     signature. When the kit ALSO carries the matching bookend (`intro`/`outro`
     bumper), compose binds an sfx-role clip at the body edge that bookend abuts
     (intro → body start; outro → body end − logo length; `offsetMs` shifts
     within). No matching bumper ⇒ a non-blocking `brand_sonic_logo_no_bookend`
     advisory and nothing placed (the sonic logo is the AUDIO companion to the
     VISUAL bookend). A `ref` that no longer resolves fails loud
     `brand_audio_unresolvable` — re-point it or clear the sonic logo.
   - **`uiSoundSet` `{ family → ref }`** — per-family SFX overrides (the brand's
     own tick/pop/impact/…). Consumed by the compose SFX draw as the HIGHEST tier:
     a family the brand overrides plays the brand's sound, everything else falls to
     the org palette then the pack default.
   - **`bedStyle` `{ bedId? | genre?, bpmRange? }`** and **`ambiencePreference`
     `{ ref } | null`** — SURFACED-ONLY today: compose auto-selects neither a music
     bed nor ambience, so these carry the brand's preference for a DRIVING agent to
     honor when it pins/generates a bed (`brief.audio.music`) or places ambience.
   Extraction can't hear: `extract_brand_kit` (website → colors/fonts) never fills
   the `audio` block — set the sound identity explicitly on `create_brand_kit`.

1. **Every hit is a SYNC POINT — sound welded to a visible event.** Chion
   (*Audio-Vision*) calls this **synchresis**: the immediate, involuntary weld the
   brain makes between a sound and the image it lands on — that weld is where
   "added value" comes from, and a hit with no visible cause produces none (it's
   the audio version of unmotivated motion, slop tell #6). Bind hits to their
   events via `anchor: { clipId, offsetMs }` so the weld survives re-edits. And
   per Randy Thom (*Designing a Movie for Sound*): sound is a storyteller, not
   decoration — score the moments that matter, let ordinary cuts breathe.
2. **Class → moment.** `transient` (tick/pop/impact/confirm/error) = entrances,
   cuts, UI semantics — Material's sound guidelines are the reference for UI
   semantics (each sound expresses its place in the hierarchy; decorative sound
   used sparingly). `sweep`: whoosh = motion carrying ACROSS a cut (pair with the
   exit→entrance handoff); riser = tension INTO a reveal — resolve exactly on the
   downbeat, never into nothing (an unresolved riser is a broken promise).
3. **Density has a perceptual ceiling.** Murch (*Dense Clarity — Clear Density*):
   the brain tracks only ~two-and-a-half simultaneous sound streams; past that,
   individual sounds stop reading and merge into texture — his mixes convey
   complex scenes with a FEW carefully chosen elements. Our calibration: the
   41.6s film that beat its reference carried 9 hits; the rejected cut carried 15
   from 3 sounds. At 6+ hits optional audio review may report `sfx-same-sound-reuse`
   below 0.4 distinct/hits.
4. **Hierarchy within a family** (Murch's balanced-spectrum principle + Material's
   sound hierarchy): the pack orders soundIds subtle→strong; the biggest beat gets
   the strong impact ONCE, everything else sits a tier down. Fifteen strong hits
   = zero strong hits.
5. **Gain staging.** SFX under a music bed must READ: target the hit ~≥6 dB above
   the bed at its transient (our measured failure: ticks 1.5 dB over bed =
   inaudible mush). Working precedent: sfx `volumeDb: -12`, bed lower still.
   Author sane levels and STOP — the engine masters to −14 LUFS (the streaming
   loudness standard); never pre-compress or push peaks to compensate.
6. **The bed is tempo, not wallpaper.** Match bed BPM/energy to the cut rate (our
   fast recut earned a 124 BPM driving bed; a calm film wants sparser pulse), arc
   the energy with the narrative, and always `duck` under VO
   (`duck: { duckDb, attackMs, releaseMs }`) — dialogue sits atop Murch's
   encoded–embodied spectrum; sfx punctuate BETWEEN phrases, never fight words.
7. **Silence is a device** (Thom: quiet is the most underrated tool in the
   soundtrack). Clean air before the first hit; a dropout before the biggest
   reveal is worth more than any riser. If the whole film is scored, nothing is.

---

## Craft defaults

Make deliberate choices about hierarchy, type, framing, juxtaposition and motion. For a product demonstration, use real captures and sourced claims; never present a mock UI as documentary evidence or invent a performance number. For an explicit abstract or typography study, judge its reading time, rhythm and visual intent directly: text and gradients are valid material, not automatic failures.

Platform conventions can suggest hooks, captions, short cuts and clear closing actions. Apply them only when they serve the requested format. An observational long hold, slow logo-first opening, silent piece or no-CTA ending is not a failure merely because another format prefers something else. Caption speech when requested or appropriate; verify actual word timing. Use audio or visual rhythm as the timing authority selected in the brief.

## Format playbooks (examples, not fixed structures)

Each playbook is an illustrative format default; explicit intent and scope govern. Every beat maps to a real CueFrame capability. Default to **16:9 landscape** for product/demo/explainer/founder-web; **9:16 vertical** for social cutdowns or other explicitly vertical work (a wide source crammed vertical crops the subject wrong and wastes the frame).

### 1 — Product launch / announcement
**When:** launching or announcing a product; teaser or full launch film.
**Beat sheet (45s, 16:9):**
| Beat | Time | Content | Words |
|---|---|---|---|
| Cold-open hook | 0–3s | One wow frame or the single pain moment. No logo. | ≤10 |
| Problem | 3–12s | The specific status-quo pain, shown not told. | ~20 |
| Reveal | 12–30s | The product doing the thing on REAL footage/screen. | ~35 |
| Proof | 30–40s | One concrete result or credible demo moment. | ~20 |
| CTA + date | 40–45s | Exact action + launch date. Logo last. | ≤12 |

**Frameworks:** 3-act teaser (Tease → Reveal → CTA) or StoryBrand SB7 (customer is hero, you are guide). One pain or one wow — not five diluted features.
**Reach for:** `import_media` a real demo capture or founder clip · `list_catalog` with `projection:"component-library", origin:"builtin"` to discover a maintained preset or recipe that fits the footage; resolve its exact scoped identity before `apply_template` · an authored card or native component for the closing wordmark, date and CTA on the final held frame.
**Anti-patterns:** opening on a logo animation; stacking five features; narrating specs; a fabricated/rounded stat; a mocked terminal standing in for a real screen.
**Quality bar:** the first frame survives with zero text on it. If your open is a gradient with the product name, you've already lost.

### 2 — Short-form social clip (TikTok / Reels / Shorts)
**When:** a vertical clip for social, usually cut from existing long-form.
**Beat sheet (22s, 9:16):**
| Beat | Time | Content |
|---|---|---|
| Visual + verbal hook | 0–3s | Bold claim / question / pattern-interrupt, on screen AND spoken. Answer teased, not given. |
| Setup | 3–8s | Frame the stakes; open loop #1. |
| Escalation | 8–16s | Value in ≤2 beats, each opening the next loop. Cut every ~1.5–2s. |
| Payoff | 16–20s | Close the main loop; put the payoff word on screen. |
| CTA / loop-back | 20–22s | Soft CTA or a re-hook that rewards replay. |

**Frameworks:** Hook → Retention → Payoff with curiosity stacking. Keep cutdowns ≤30s — shorter clips complete far more often.
**Reach for:** `suggest_briefs` on the long-form media (the AI clip-finder authors trim + speaker framing + captions from the transcript for you), then `compose({ suggestionId })` (Director ensemble) or author yourself via `apply_composition` · reframe `focus: {mode:"active-speaker"}` to keep the speaker centered in the vertical crop · word-level captions with `emphasis` on the payoff word and `entrance:"word-pop"` · `derive_composition` to auto-reframe a 16:9 master to 9:16 content-aware (not letterboxed).
**Anti-patterns:** a wide source letterboxed into 9:16 with black bars instead of subject-tracked reframe; no captions (dies on mute); a hook that describes instead of provokes ("In this video I'll…").
**Quality bar:** the hook sentence starts at t ≤ 1.5s; the face box is a real fraction of the frame with the top of the head in-frame on every sampled still.

### 3 — Explainer
**When:** explaining a concept, mechanism, or product so a viewer *gets* it.
**Beat sheet (75s, 16:9, ~160 words @ ~130 wpm):**
| Beat | Time | Words | Content |
|---|---|---|---|
| Hook | 0–5s | ~12–15 | The "why watch" — land inside 3s. |
| Problem | 5–20s | ~30 | Name the exact pain; they must feel understood. |
| Solution | 20–45s | ~55 | Your answer and how it differs. Show it working. |
| Proof | 45–62s | ~35 | One result / mechanism / credible demo. |
| CTA | 62–75s | ~20 | One clear next step. |

**Frameworks:** Hook → Problem → Solution → Proof → CTA. Decide the CTA first, script it last; write for the ear.
**A fully animated explainer is a FIRST-CLASS grounded format**, not a fallback for missing footage. An explainer built on authored diagrams of the *actual* mechanism (its real pipeline, the real data) is grounded — the grounding is that each visual depicts THIS thing specifically, not a decorative loop. Reach for it deliberately, not as a consolation for "no footage."
**Reach for:** an authored `card` clip (your own HTML/typography, animated in its CSS or with `clip.setKeyframes`) to anchor an abstract mechanism with a real diagram — process/algorithm/data viz, not cinematic footage · an authored card for term labels · one idea per beat · when using real footage, narrate to the detected transcript timing.
**Anti-patterns:** a wall of narration over stock gradient loops with no visual keyed to the words (the generic-filler tell — a purposeful diagram of the real mechanism is the opposite); explaining features before establishing the problem; using `generate_media` text-to-video to fake a "product" that doesn't match the real UI (it hallucinates specifics).
**Quality bar:** every beat has a visual keyed to what's being said — grounded and specific to this content, not decoration; the hook lands in 3s.

### 4 — SaaS / dev-tool demo
**When:** showing a product/CLI/app actually doing a real task.
**Beat sheet (~2 min, 16:9, real screen capture):**
| Beat | Time | Content |
|---|---|---|
| Hook + problem | 0–15s | The workflow that hurts today. Real UI or founder to-camera. |
| Setup | 15–30s | The task we'll accomplish; the promised outcome. |
| Walkthrough | 30–95s | Do the real thing on the real screen. Punch-in on the exact UI region per step; ~3–4s cadence; caption each action. |
| Outcome | 95–110s | Result achieved; the payoff vs the opening pain. |
| CTA | 110–120s | One action: start free / book / docs. |

**Frameworks:** Problem → Product-in-action → Outcome, wrapped in one completed task, not a feature tour. ~2 min is a good ceiling; chapter beyond that.
**Reach for:** `import_media` a REAL screen recording (captured by the user, or by an external screen-capture client such as a headed Playwright walkthrough recorded to MP4 — CueFrame does not screen-record) · reframe punch-in to the active UI element each step (`focus:{mode:"point",x,y}` on the click target, or a `face` focus for a founder inset) — the single biggest amateur→pro delta in demos, because the click target is ~30px in a 3840px 4K frame and nobody sees it unzoomed (**see `cueframe-product-video`** for the full click-point→reframe-segment auto-zoom tiling + PiP recipe) · an authored step-label card.
**Anti-patterns:** the cardinal demo sin — a mocked/fake terminal or static UI card instead of the real app; showing the full 4K screen unzoomed; narrating every menu.
**Quality bar:** every UI/terminal on screen is a real capture; the actual action is visibly punched-in, not lost in a wide frame.

### 5 — Founder / talking-head (CueFrame's home turf)
**When:** a real person speaking to camera — founder update, announcement, testimonial. The format CueFrame composes best, and the one that agent walked past.
**Beat sheet (75s, 16:9 for web; 9:16 cutdown for social):**
| Beat | Time | Content |
|---|---|---|
| Attention / Problem | 0–5s | Founder states the pain or bold claim to camera. Eyes to lens. |
| Interest / Agitate | 5–25s | Why it matters now; personal stakes. B-roll cutaway. |
| Desire / Solution | 25–55s | What they built and the shift it creates. Product B-roll. |
| Proof | 55–68s | One credible result. Lower-third for name/title/metric. |
| Action | 68–75s | One CTA. |

**Frameworks:** PAS (Problem → Agitate → Solution) or AIDA. Framing: eyes on the upper-third line, small headroom, subject looks into the lens; break every ~5–8s of pure talking head with a cutaway.
**Reach for:** THE canonical CueFrame job. `get_media_context` for faces + transcript → reframe `focus:{mode:"active-speaker"}` for a solo speaker, `{mode:"all-faces"}` to hold a two-shot, or `{mode:"face",faceId,shotScale:"close"}` to punch in on emphasis → transcript-timed `captions` with a legibility plate (`setCaptionStyle` `emphasisPlate`, `position:"bottom"`) → a text overlay at `zPlane:"behind-subject"` when you want a title/word to sit *behind* the head (the signature look; render bakes the person matte) → an authored card or owned native component for name/title, shown once; use the selected component’s documented color inputs. Zero generation needed.
**Anti-patterns:** a static wide talking head running 30s uncut (reads as a raw webcam upload); captions slapped over the chin with no plate; head dead-center or too much headroom; missing the lower-third identity.
**Quality bar:** a face is on screen within 3s; the person framed is the person speaking; captions never cover the mouth or eyes.

---

## Map craft to CueFrame tools (never invent a tool, primitive, or param)

| Craft goal | Do this in CueFrame |
|---|---|
| Bring in the real thing | `import_media` — requires `url` (public https) + `filename` + `contentType` (from the fixed enum: `video/mp4`, `video/quicktime`, `image/png`, `audio/mpeg`, …). Poll `list_media` or `create_webhook` on `media.completed` (status inside: complete|failed). |
| Know where subject + speech are | `get_media_context` → face boxes per frame (with `faceId`) + transcript. If faces are not detected, `prepare_media(kind:"subjectTrack", intent:{startSec,endSec})` → poll `get_media_facts` for the same SOURCE window until ready. |
| Keep the speaker framed / punch-in | `setCropIntents` op (the PREFERRED authoring path) or inline `reframe.segments` on a `clip.add` source. Each segment needs `startSec`/`endSec`/`focus`/`zoom`; **segments must TILE the clip** (an uncovered span → `reframe_coverage_gap` at validate). `focus.mode`: `frame-center` \| `point{x,y}` \| `face{faceId, shotScale?: close\|standard\|wide}` \| `all-faces` \| `active-speaker`. `zoom<1` punches in, `=1` full frame, `>1` rejected (min 0.1). Times in **seconds**. |
| Captions that track real speech | `composition.captions.segments[].words[]` = `{text, startMs, endMs, emphasis?, annotate?: circle\|underline}` — word times in **milliseconds**. Author the words directly with the `setCaptions` op (segments wholesale — how a generated-VO film gets its word-synced spine without a source transcript); style via `setCaptionStyle`: `position` (top\|center\|bottom), `entrance` (fade\|word-pop\|stagger-up), `emphasisPlate` + plate colors for legibility. Captions default to front; set top-level `composition.captions.zPlane:"behind-subject"` only when the user wants the whole caption layer behind the speaker. It resolves person cutouts for every overlapping source window and degrades visibly to front where the legibility gate refuses the effect. |
| Text behind the speaker's head | An `overlay` clip using the built-in `heroText` primitive with `zPlane:"behind-subject"`. This is the focused hero treatment; caption-layer depth is a separate whole-layer choice. Before preview/judgment, `prepare_media(kind:"matte", intent:{startSec,endSec})` for the overlapping clip's SOURCE trim and poll `get_media_facts` until ready. Render also resolves the person cutout on miss. |
| Name someone / label a step | An authored `card` or owned native component with the intended name, typography and placement. |
| Title / closing wordmark | An authored `card` or owned native component for the closing wordmark, held long enough to read. |
| Set a graphic's palette | The selected component's documented color inputs, or an authored treatment in its complete native source. |
| Anchor an abstract mechanism | An authored `card` clip animated in its CSS or with `clip.setKeyframes` (diagrams of the real mechanism — NOT cinematic; a first-class grounded path) |
| Long-form → clips | `suggest_briefs` → `wait_job(kind:"suggestions")` → `compose({ suggestionId })` |
| Auto-reframe to another aspect | `derive_composition` (content-aware 9:16 / 1:1 / 4:5 from a 16:9 master) |
| Discover what to build with | `list_catalog` with `projection:"component-library", origin:"builtin"` discovers maintained preset/recipe cards. Preserve each card's complete identity and resolve its exact collection, id and revision with `resolve_builtin_component` before `apply_template`; retain the returned `documentSha256` and source pins. Page with `limit` and the returned cursor. The default catalog and `cueframe://component/{id}` describe the one primitive (`heroText`) and org-installed components. |
| Own / fork a custom graphic | Discover a definition with `list_catalog` projection `component-library`; `get_component_source` with its exact `componentId`, `sourceVersionId` and `builtinCollection`, then `create_component` / `update_component` with the complete native version-4 source snapshot — **see `cueframe-component-authoring`** for the full fork→preview→push loop |
| Several cells that share space and must reflow together (feature grid, rail + fluid content, cast + type) | An authored card or native component laid out with CSS flex/grid (fixed tracks for content-sized cells, `fr` for the rest), animated from the frame. Static PiP / split is clip `region` + `fit` instead. Never CSS-scale the layout. **See `cueframe-component-authoring`** |
| Seed + edit the timeline | `apply_composition` (atomic batch ops; `dry_run:true` to check, `if_match` for OCC) — this is where clips, reframe, captions, and format are authored |
| Set the brand | `create_brand_kit` (402-gated) → set `brandKitId` on the **project** (`create_project` / `update_project`). It lives on the project, NOT on a composition op — trying to set it elsewhere is silently dropped. |
| Shape-check (NOT quality) | `validate_composition` → `{ valid, errors[] }` (`unknown_primitive`, `invalid_primitive_params`, `clip_source_track_mismatch`, `reframe_coverage_gap`, …); does **not** check trim bounds or image-on-video-track (those fail at save/render) |
| Look at real pixels | `preview_frame` at timestamps → PNG stills → LOOK |
| Judge motion or audio timing | `preview_clip` for the affected `[fromSec, toSec)` window → `wait_job(kind:"render")` → watch/listen; use matching reference timestamps |
| Check an isolated card | `preview_card` with its HTML and tokens; no scratch composition needed |
| Preview one graphic | `preview_component` (202 + jobId → `wait_job(kind:"preview")`; returns the verified artifact from the same immutable bundle used by production; compile/runtime/capability errors land on the job's failed terminal with the author-fixable message) |
| Independent grade (steered, un-gameable) | `score_composition` (sessionless; `editorialIntent`=your vision, `brandContext`=brand facts) → four fixed criteria + composite + worst-first critique, on frames it samples itself |
| Director ensemble compose | `compose` — set EXACTLY ONE of `fromComposition:true` (author from the seeded composition) or `suggestionId` (clipping path) → `wait_job(kind:"compose")` |
| Final MP4 | `create_render` → `wait_job(kind:"render")` or `create_webhook` on `render.completed`; `retry_render` (transient only) / `cancel_render` |
| Orient before spending | `get_account` FIRST — read `balance`, NOT `included`. Rendering / generation / previews / judge / Director share ONE credit wallet (`fundedBy`); each `balance` restates that same wallet in that feature's unit. Positive balance is not proof of capability or entitlement: check the exposed contract, entitlements and quote before proceeding. New orgs get a free credit grant, so an empty usage history is not a blocker. 402 `billing_required` fires once the balance is spent; `generate_media` also 402s over its USD ceiling |

Everything needs a `projectId` — `create_project` is step 0.

**Hard limits — respect them, don't fake around them.** No cinematic AI generation: `generate_media` is limited text-to-video/text-to-image/image-to-video, plus audio: `text-to-speech` (narration VO) and `text-to-music` (instrumental bed); use generated visuals where their actual capabilities fit the brief, and do not present synthetic footage as documentary evidence. No screen capture: that needs an external screen-capture client (e.g. a headed Playwright walkthrough recorded to MP4). When the right move needs footage CueFrame can't generate, `import_media` real footage — do not synthesize a substitute. **Units trap:** `startTime`/`duration`/`trim`/reframe `startSec`/`endSec`/`ease` are **seconds**; caption word times are **milliseconds**. **Render-time fail-loud errors to expect** (render never ships a wrong frame silently): `content_anchor` (a clip's `trim` frames *different* footage than its captions show — align the trim to the captioned moment), `behind_split_unsupported` (one media used under two *different* behind-subject windows — one behind-subject window per MEDIA; to render two different behind windows of one source, import it as two separate MEDIA ITEMS (distinct mediaIds) — duplicating the same mediaId into two clips still throws), `BehindMatteUnresolved`/`TrajectoryUnresolved` (the behind/face bake found no detectable person — drop the intent or fix the source).

**Worked alignment example (the error-prone mechanic).** You want the caption emphasis to land on the founder's stressed word "faster," and the frame to punch in on the same beat. From `get_media_context`, the transcript word "faster" runs `startMs:8120, endMs:8560` (transcript/source time). **For these round numbers, assume an untrimmed clip placed at timeline 0** — then source time, timeline time, and clip-relative time all coincide. So: put that word in `captions.segments[].words[]` with `emphasis:true` at `startMs:8120`; and author reframe with `setCropIntents` as a **contiguous segment list that tiles the whole clip** — e.g. a wide segment `{startSec:0, endSec:8.12, focus:{mode:"active-speaker"}, zoom:1}` then the punch `{startSec:8.12, endSec:<clipEnd>, focus:{mode:"face",faceId:"…",shotScale:"close"}, zoom:0.8, ease:{in:0.4,out:0}}` (ms → s: 8120ms = 8.12s). A lone mid-clip segment that leaves `[0..8.12]` uncovered fails validation with `reframe_coverage_gap`.

**Watch the timebase: reframe segment times are CLIP-RELATIVE; caption/transcript times are TIMELINE-based — convert when the clip is trimmed or not at t=0.** They coincide only for an untrimmed clip placed at timeline 0 (the case above). For a clip trimmed to start at source `trim.start` and sitting at `clip.startTime` on the timeline, the reframe boundary is `startSec = transcriptSec − trim.start`, and the caption time is `clip.startTime + (transcriptSec − trim.start)`. (The simple case just has `trim.start = 0` and `clip.startTime = 0`, so both reduce to `transcriptSec`.) Land the caption entrance *on* the stressed word, not a round frame like 8.0s — on-beat reads as craft. And if the clip's `trim` window doesn't actually contain source-second 8.12, the captioned word shows different footage → `content_anchor` at render.

---

## Craft principles (aesthetic defaults) (reason FROM these — the rules above are their consequences)

- **Curiosity is an information gap** (Loewenstein, 1994). A slide that *states* a fact satiates before it primes; a cold open that *poses* ("…and that's the number that made us kill the old pipeline") opens a gap the viewer must watch to close. Order clips to pose, not answer. A definitional title card is appropriate when requested or useful for this format.
- **Emotion outweighs everything** (Murch's Rule of Six: emotion ~51%, then story, rhythm, eye-trace, planarity, spatial continuity). The slop instinct optimizes the bottom of the list — aligned text, smooth easing — while ignoring the top. When choosing where to cut, ask "does this land the emotion / advance the point?" first, "is it geometrically neat?" last.
- **Attention and rhythm.** Consider motivated changes of state or shot scale when attention is the goal. Deliberate repetition, continuous motion and long holds can serve other requested formats.
- **Sound is half the picture** (Chion, *Audio-Vision*; synchresis). Cut on stressed words / beats via transcript word-timing; hold a silence beat before the peak line. On-beat reads as craft, off-beat as accident.
- **Story can use a value-shift** (McKee). Pain → product → win is one launch structure; a sequence of raised-and-answered questions is another. Neither is required for a brand study, observation or a different requested arc.
- **Premium = legible intent, not polish.** Audiences forgive imperfect video with a point of view; they don't forgive adequate video with no soul. Restraint, typographic discipline, and one consistent color/type/motion system across the whole piece are the premium signal. Consider why motion serves the requested visual experience.

### Deconstructed grammars (steal the structure, map to the tools)
These are *archetypes*, not documented cuts of specific films — reason from the grammar, don't cargo-cult a company.

- **Hardware reveal example:** a product materializing against negative space can carry a reveal, with one capability per shot and sourced numbers held long enough to read. This is one option; a requested logo or title opening is equally valid. Use actual product footage when claiming to show the real hardware.

- **Human testimony example:** founder-to-camera footage can give a launch specificity. Reframe from actual speaker facts and use transcript timing for requested captions. Do not add a person or voice to a piece that calls for another medium.

- **Product-action example:** real UI interactions on a restrained stage can make a software demo readable. Choose holds, cuts, music and graphic-only intervals from the brief; a frame without the product is not an automatic failure. A typography or gradient study can use those elements as its subject.

These examples suggest choices, not a required opening shot, visual medium or film structure. Real captures matter when presented as product evidence; authored diagrams and typography are valid requested media.

---

## Acceptance template

Use only what the request needs:

```
INTENT: the requested outcome or visual experience.
SCOPE: new work | affected revision | broader review | final delivery.
PROJECT/LANE: current project and capabilities actually exposed.
ACCEPTANCE: observable requirements at relevant timestamps/windows.
PRESERVE: unrelated timing, media, audio, source identity and shared kit state.
FACTS: sources for factual claims; identify simulated UI honestly.
EVIDENCE: matching frames plus motion/audio checks where relevant; source revision and job identity.
REVIEW: optional judge critique within budget; acceptance failures take precedence over scores.
DELIVERY: preview evidence or verified final export as requested; report remaining gaps.
```

Before final export, verify the requested acceptance criteria, current source revision and media bindings, valid composition shape, relevant motion/audio, and applicable hosted account/quote safeguards. Return the artifact location and distinguish preview proof from final-export proof.
