# Audio design

Defaults, examples and detail for this topic. The [skill](../SKILL.md) and the [project and capability policy](project-policy.md) take precedence where they differ, and the current tool schemas are authoritative.

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
