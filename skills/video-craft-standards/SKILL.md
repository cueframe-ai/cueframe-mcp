---
name: video-craft-standards
description: Craft defaults and applicable review checklists for CueFrame videos (social reel, launch film, brand reel, talking-head clip). User intent and requested scope govern their application; factual fidelity and tool contracts remain mandatory. Triggers on "is this good enough", "quality bar", "what should a finished reel have", "review my video", or any request to make a video when no other skill has stated the bar.
---

# Video-Craft Standards — what "finished" means

## Scope and capability policy

User intent and acceptance criteria override this recipe's aesthetic defaults. Silent, typography-only, uncaptioned and slow work are valid; no universal narration, footage, CTA, beat count or score target. Contracts, factual fidelity, media bindings and current source revisions remain mandatory.

Read available tools and current project; preserve the chosen local/hosted lane. Supported local work needs no hosted registration. Do not silently install, authenticate, switch projects or upload local content. Before metered hosted work, check `get_account`, entitlements, balance and quotes. Desktop setup: https://docs.cueframe.ai.

For scoped revisions, preserve unrelated timing, media, audio and shared brand-kit state. Edit affected content; inspect relevant frames, continuous motion and affected audio. No restarted intake, new approval pause, paid judge or final export by default. Judge only when useful; scores never override acceptance failures. Stop/report after two no-improvement passes. See [preview workflow](../cueframe-compose-loop/references/preview-workflow.md).

These are aesthetic defaults for the named formats, not universal delivery gates. Apply only the checklist items relevant to the requested artifact; a silent typography study needs neither footage nor narration, and a title correction needs only affected evidence. User acceptance criteria govern delivery. The labels below describe recommendations; do not reject explicit creative choices using a default or a judge score.

## The controlling idea — the rule above every rule

- **DEFAULT** For new work, consider stating the video's CLAIM in one sentence —
  the thing a viewer should be able to repeat afterward ("real bread takes
  48 hours and you can taste every one of them"). Not a vibe, not a tagline:
  a claim with tension (what does this brand/story believe that its category
  doesn't?).
- **DEFAULT** Each included channel serves the requested intent, in harmony:
  - **Footage** — each clip earns its place as proof of the claim, chosen
    from the claim's shot list, not from search-term aesthetics.
  - **Sound** — the bed's mood and TEMPO embody the claim (a "slow" claim
    gets a patient, sparse bed and the nerve to hold shots; an "instant"
    claim cuts hot). Silence and pauses are rhetoric, not absence.
  - **Pacing** — the cut rhythm IS part of the argument; it may defy
    platform convention when the claim demands it.
  - **Type/cards** — copy advances the argument; the tagline lands as the
    CONCLUSION the beats have earned, never as a caption.
- **Review prompts:** (1) beats reorderable without changing what the video
  says; (2) any channel (bed, shot, card) that would fit a different claim
  equally well; (3) a viewer who watched it cannot state the claim.

## Cross-cutting rules (every artifact)

These are final-artifact criteria, not a requirement to re-plan or export after every tweak.
For scoped corrections and preview selection, use `cueframe-compose-loop`'s
[preview workflow](../cueframe-compose-loop/references/preview-workflow.md). Inspect continuous
motion and listen to affected audio, not only stills or judge scores. Keep the user's explicit
scope and acceptance criteria; approved simulated UI is not evidence of a real product capture.

- **DEFAULT** Brand/text graphics are AUTHORED — `kind:"card"` HTML (your
  typography, layout, palette-as-fields) shelled with `applyMotionPreset`,
  or a custom component. Catalog text primitives are for utility only.
  **Consider:** a brand graphic rendered from a catalog text primitive.
- **DEFAULT** Audio is decided, never defaulted: a music bed (curated packs via
  `import_resource {kind:"music-pack"}`) or ambience/loops (Freesound via
  `search_resources kind:"sfx"`), honoring the brand kit's `musicMood`;
  cut to the beat via `materializeGrid` when the bed drives pacing — OR an
  explicit intentional-silence decision recorded in your delivery note with
  the reason. **Consider:** a render whose silence nobody chose.
- **DEFAULT** Footage carries the video: real footage / real UI / real data
  ≥60% of runtime for footage-first classes. Typography-only work is a valid requested format.
- **DEFAULT** Every stock asset's provenance is recorded (provider, id, author).
- **DEFAULT** Safe-area respected: no critical copy in the outer ~8% of frame.
- **DEFAULT** One final render per approval; iterate with previews, not renders.
- **DEFAULT** Delivery never ends with "done": the last message carries the
  output link and where to find it, plus the intentional-silence note if any.

## 1. Social reel — 9:16 · 8–30s

- **DEFAULT** The hook lands inside 2 seconds: the strongest image, motion,
  or claim opens the piece. No logo-first cold opens, no fade-in-from-black
  preambles.
- **DEFAULT** Typography is poster-grade: composed plates/fields in the brand
  palette, considered alignment and scale. **Consider:** centered white text
  floating on footage.
- **DEFAULT** Pacing is cut-driven: a new visual beat at least every ~4s; static
  holds >4s need motion inside the frame (reframe push, kenBurns, animated
  card) or they die.
- **DEFAULT** Ends on a deliberate beat: tagline, logo, or CTA lockup — not a
  clip running out.
- **SHOULD** Cuts land on the music grid when a bed exists.

## 2. Launch film / feature announcement — 16:9 · 30–90s

- **DEFAULT** Payoff-first hook: the OUTCOME, not the feature name
  ("Close the books two days faster" beats "Introducing the reconciliation
  module"). No throat-clearing ("in this video we're going to…").
- **DEFAULT** Narration or a bed that builds toward the reveal; pacing tightens
  as the payoff approaches.
- **DEFAULT** Real product surface: actual UI/screens/output — never mocked.
- **DEFAULT** End card with a single CTA.
- **DEFAULT** Captions present when narrated.

## 3. Brand-identity reel — 9:16 · 12–20s (the showcase class)

Everything in §1, plus:
- **DEFAULT** Three-beat arc: opening brand moment (wordmark treatment) →
  middle craft/proof beat (the subject's world, with an editorial device —
  numbered chapter, pull-quote, stat) → closing tagline lockup.
- **DEFAULT** Every graphic is bespoke to the brand: its type, its palette as
  fields, its layout system. **Consider:** any layout that would look correct with
  another brand's hex swapped in.
- **DEFAULT** Footage color and brand palette agree — grade toward the palette
  or choose footage that lives in it.

## 4. Talking-head clip — any aspect · 15–60s

- **DEFAULT** Hook = the strongest sentence, first. Cut TO the moment;
  never open on wind-up.
- **DEFAULT** Active-speaker reframe (`focus: active-speaker` / `face`) — a
  moving camera, not a static center crop.
- **DEFAULT** Captions timed to the saved edited timeline (`captions.fromComposition`
  after the clip edits; re-run after later edits). Speech clips must have saved duration matching playable source duration divided by
  playbackRate.
  The focused behind-the-speaker LOOK is an overlay text layer at
  `zPlane:"behind-subject"` where the footage allows. Use caption-layer
  `zPlane:"behind-subject"` only when the user explicitly wants every running
  caption behind the speaker and the legibility gate accepts it.
- **DEFAULT** Dead air and false starts cut (`addExcludedRange` /
  `cutAndRipple`).

## Scoring discipline

Check the requested criteria against appropriate real evidence: affected stills, continuous motion and audio when relevant. Broader review can use `score_composition` when useful and within budget; it is not mandatory for a scoped correction. The hosted judge includes a fixed caption criterion and can penalize intentionally uncaptioned work; do not add captions solely to improve that score. These skill changes do not change judge behavior. Failed user acceptance criteria remain failures regardless of score. Stop and report remaining gaps after two passes without improvement; export only for requested final delivery.
