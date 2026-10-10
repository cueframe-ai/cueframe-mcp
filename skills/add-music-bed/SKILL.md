---
name: add-music-bed
description: Retrofits a music bed (and ambience or SFX) onto an existing composition — license-aware search, correct mix hierarchy, ducking under speech, cuts moved onto the beat. Triggers on "add music to this", "this video feels dead", "put a bed under it", "it needs sound", "add background music", "make the cuts hit the beat", "add some sfx", "the audio is just silence".
---

# Add a music bed

## Scope and capability policy

User intent and acceptance criteria override this recipe's aesthetic defaults. Silent, typography-only, uncaptioned and slow work are valid; no universal narration, footage, CTA, beat count or score target. Contracts, factual fidelity, media bindings and current source revisions remain mandatory.

Read available tools and current project; preserve the chosen local/hosted lane. Supported local work needs no hosted registration. Do not silently install, authenticate, switch projects or upload local content. Before metered hosted work, check `get_account`, entitlements, balance and quotes. Desktop setup: https://docs.cueframe.ai.

For scoped revisions, preserve unrelated timing, media, audio and shared brand-kit state. Edit affected content; inspect relevant frames, continuous motion and affected audio. No restarted intake, new approval pause, paid judge or final export by default. Judge only when useful; scores never override acceptance failures. Stop/report after two no-improvement passes. See [preview workflow](../cueframe-compose-loop/references/preview-workflow.md).

> **Stock-audio limits (verified in production):** a Freesound import lands with
> `audioRole:"sfx"` and NO beat grid — `import_resource` takes no audioRole param, and
> `materializeGrid grid:"beat"` will 422 `grid_unavailable` on it. Set the role yourself when
> placing the clip (`audioRole:"music"` on the composition clip), put the bed on its own AUDIO
> track (the judge expects a dedicated music track), and until curated music-pack discovery
> exists, prefer fades over beat-cuts for stock beds — beat-grid cutting works with pack beds.

You point at an existing composition that sounds empty; you get it back with a licensed bed that
matches the brand's mood, sits correctly under any speech, and — where the bed drives pacing —
cuts moved onto its beat grid. Attribution included, levels disciplined, one re-render.

## Before you start

Listen first — identify what audio the composition already has before proposing anything. When
the first tool call approaches and CueFrame isn't connected, load **`cueframe-connect`** and
follow it once.

Then back to the soundtrack — this is usually a one-sitting job.

## Inputs

- **The composition** (required): id, or find it via `list_compositions`.
- **Mood**: the brand kit's `musicMood` is the default answer — honor it before asking. No kit
  → ask for one adjective pair ("calm/driving", "warm/dark").
- **What speech exists**: check `get_media_context` on the composition's media for VO/dialogue —
  it decides the whole mix shape.
- **Beat-cut permission**: moving cuts onto the beat changes timing slightly; default yes for
  social pieces, ask for approved masters.

## Workflow

Use `cueframe-compose-loop`'s [preview workflow](../cueframe-compose-loop/references/preview-workflow.md).
Listen to a scoped `preview_clip` across speech, ducking, fades, and beat changes before final
delivery; stills and a visual judge cannot establish the mix. Recheck visuals where cuts moved.

1. **Read the composition and its speech.** `list_compositions` / the composition body for
   what's on the timeline; `get_media_context` for transcripts. Speech present → the voice is
   the rhythm authority and the bed serves it. No speech → the bed IS the rhythm authority and
   earns beat-cuts.
2. **Find the bed, license-aware.** Beds come from the curated music packs —
   `import_resource { kind:"music-pack" }` — honoring the brand kit's `musicMood` (mood and
   energy matched to the cut rate). For ambience or loop textures, `search_resources
   kind:"sfx"` (Freesound, CC0-only) works too. For SFX accents, the curated pack
   (`import_resource { kind:"sfx-pack" }`) is the fast default. Record provider/id/author for
   everything — attribution ships in the delivery note.
3. **Place it with a role, not a volume.** `apply_composition`: add the bed as an
   `audioRole:"music"` clip. The engine's default mix staging already keeps voice on top;
   author `volumeDb` only to deliberately deviate. Under speech, set `duck` so the bed drops on
   words and recovers between them — the voice is never fought.
4. **Fades at the edges.** A bed that starts at full level on frame one is a jolt: fade in over
   the first beat, fade/resolve out under the end card. The bed should feel like it was always
   there.
5. **Cut to the beat where the bed drives.** `materializeGrid { clipId, grid:"beat" }` on the
   bed — the server lands beat markers at correct timeline times. Move cut points and
   transition MIDPOINTS onto markers (start a 0.5s transition 0.25s early so its center hits
   the beat). Skip this when speech is the authority — there you land accents between phrases,
   on the words that matter.
6. **Restraint is the discipline.** A few placed sounds read; a wall of them merges into mush.
   The biggest moment gets the strongest accent ONCE. And silence stays a device — clean air
   before the first hit, a dropout before the biggest beat, is worth more than any riser.
7. **Listen and verify the affected window.** Check intelligibility, ducking, fades and synchronization in a motion/audio preview; stills alone cannot verify a music change. Preserve existing cut timing unless retiming was requested. Broader judging is optional and budgeted; export only for requested final delivery.

If, after listening, the right call is NO bed — a raw testimonial, a piece whose room tone is
the point — that is a legitimate outcome of this skill: record the intentional-silence decision
and its reason in the delivery note instead of forcing a bed.

## What good looks like

Quoted from `video-craft-standards` (cross-cutting rules — every artifact); this skill exists to
satisfy the second one:

> **DEFAULT** Audio is decided, never defaulted: a music bed (curated packs via
> `import_resource {kind:"music-pack"}`) or ambience/loops (Freesound via
> `search_resources kind:"sfx"`), honoring the brand kit's `musicMood`; cut to the beat via
> `materializeGrid` when the bed drives pacing — OR an explicit intentional-silence decision
> recorded in your delivery note with the reason. **Consider:** a render whose silence nobody chose.

> **DEFAULT** Every stock asset's provenance is recorded (provider, id, author).

And from §1: *"**SHOULD** Cuts land on the music grid when a bed exists."*

## Delivering

The last message carries:

- The new render link and where it lives (project + composition id).
- The bed's attribution (provider, id, author, license) plus any SFX used.
- The mix decisions in one line each: role, ducking, any authored level, which cuts moved onto
  the beat.
- OR the intentional-silence note with its reason, if no-bed was the right call.
