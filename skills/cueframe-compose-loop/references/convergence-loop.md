# The convergence loop

Defaults, examples and detail for this topic. The [skill](../SKILL.md) and the [project and capability policy](../../composing-video/references/project-policy.md) take precedence where they differ, and the current tool schemas are authoritative.

## Scope and capability policy

User intent and acceptance criteria override this recipe's aesthetic defaults. Silent, typography-only, uncaptioned and slow work are valid; no universal narration, footage, CTA, beat count or score target. Contracts, factual fidelity, media bindings and current source revisions remain mandatory.

Read available tools and current project; preserve the chosen local/hosted lane. Supported local work needs no hosted registration. Do not silently install, authenticate, switch projects or upload local content. Before metered hosted work, check `get_account`, entitlements, balance and quotes. Desktop setup: https://docs.cueframe.ai.

For scoped revisions, preserve unrelated timing, media, audio and shared brand-kit state. Edit affected content; inspect relevant frames, continuous motion and affected audio. No restarted intake, new approval pause, paid judge or final export by default. Judge only when useful; scores never override acceptance failures. Stop/report after two no-improvement passes. See [preview workflow](../../cueframe-compose-loop/references/preview-workflow.md).

You are the director. CueFrame gives you hands (author), eyes (capture), and a
judge (verify); you supply the taste and the iteration. The engine does NOT
auto-compose for you here — you drive the loop and decide when it's done. Drive
the primitives with the `cueframe-cli` skill; this tells you *how to converge*.

Before choosing a preview or export, read [preview-workflow.md](preview-workflow.md).
It owns hosted/local routing, bounded motion evidence, and the distinction between a small edit
and final delivery. For a minor revision, keep the approved brief and inspect the changed behavior
plus relevant regressions; do not restart the full planning/judging loop below.

## The loop

```
get_context  →  author  →  scoped preview (look)  →  judge if useful
                   ↑                                      │
                   └──────── fix the WORST criterion ──────┘  → stop → render
```

Hosted preview and scoring are durable, stateless jobs. Keep their job IDs and
wait for each terminal result; there is no hosted render box to open, warm, or close.
Use the local live-preview tools when working in a desktop project that exposes them.

## 0. Context — relevant project and source first

`GET /v1/media/:id/context` (`cueframe_api_getMediaContext`) returns what you need
to author well for a source:

- **faces** — the subject roster per source window: `faceId` (face-0 = largest/
  primary speaker), normalized `bbox`, `speakingShare` (0–1). Use these to aim
  reframe/crop intents at the right subject. `faces.status: "not_detected"` means
  no detection has run yet — author without face-targeted reframe, or trigger a
  pass first; never invent face ids.
- **transcript** — utterances with per-word `start`/`end` (seconds). Use for
  caption timing and for placing overlays on the right beat.

For a maintained builtin package, follow [exact builtin insertion](builtin-insertion.md)
before authoring custom source.

## 1. Author

Build/modify the working composition with the op vocabulary —
the curated `apply_composition({ projectId, body: { ops: [...] } })`. Read
`describe_composition_ops` for supported operations and `get_composition` for
current revision and brand witnesses before editing. Pass that revision as `if_match`
on every committing call. A 409 means someone saved after your read: call `get_composition`
again, rebuild your ops against what it returns, and send them with its revision. Never resend
the same ops with the 409's `currentEtag`; that overwrites a save you have not read. Op keys
are `.strict()`: a typo'd key is rejected, not silently dropped, so read the
error and fix the key. Reference faces from get_context in your reframe segments;
time captions/overlays from the transcript word timings.

## 2. Preview — look at it

Use the curated `preview_frame` MCP tool, or
`POST /v1/projects/:id/preview-frame-jobs`, with the composition target and the
timestamps you need to inspect. The operation returns `{ jobId }` immediately.
Call `wait_job({ kind: "preview_frame", id: jobId })`, then view the image artifact
URLs in the successful result. Look at the beats you're unsure about: a cut, an
overlay entrance, or the hook. The stills are real render evidence, not continuous-motion proof.
Use `preview_clip` for the affected composition window to judge cuts, entrances, camera movement,
and audio timing; use `preview_component` or `preview_card` for isolated authoring checks.

## 3. Score it

When broader review is useful and within budget, use `score_composition`, or `POST /v1/projects/:id/score-composition`, with the
composition target plus optional `editorialIntent` and `brandContext`. It returns
`{ jobId }`; call `wait_job({ kind: "verify", id: jobId })`. CueFrame's judge samples
the meaningful beats, renders them, and returns:

```
{ perCriterion: { editorial, spatial, brand, caption } each { score 0–10, critique },
  composite,        // weighted overall
  critique,         // worst-first, leads with the criterion to fix
  beats }
```

The four criteria:

| criterion | what it grades |
|---|---|
| **editorial** | does the framing/cut serve the stated intent (the hook, the point)? |
| **spatial**   | subject framing — centered/tight enough, not lost in dead space, not occluded by captions |
| **brand**     | on-brand color/typography/voice; cohesive look |
| **caption**   | caption legibility, timing, placement (or `no_captions` when absent) |

The hosted caption criterion can penalize intentionally uncaptioned work; do not add captions solely for a score. These instructions do not change judge behavior.

You get **scores and the critique, never the rubric** — the taste is CueFrame's.
Pass `editorialIntent` (your brief/hook) so editorial is graded against what you
meant.

## 4. Fix the worst — then re-score

Read `critique` — it names the lowest criterion first and says why. Fix **that one
thing** (re-author the relevant ops), then score again. One criterion per pass:
chasing all four at once thrashes. Example: editorial 4 "two subjects off-center
vs centered intent" → tighten the reframe onto face-0 → re-score. A layout critique
("cramped", "unbalanced", "text crowds the art") on a laid-out card or component is a
change to its CSS grid tracks or flex basis. Re-author those; never nudge pixels (see
`cueframe-component-authoring`).

## 5. Stop — then render

For a whole-film review, check the brief's actual acceptance criteria; no fixed score threshold applies. Two no-improvement passes are a reason to stop spending and report what
remains, not to declare a rejected result approved. Render with `create_render` only when a
finished video is requested or the work reaches final delivery. A scoped revision can end with
verified preview evidence and an explicit note that no new final export was made.

## Notes

- **Whose tokens:** you run this loop on your own model/tokens; CueFrame bills the
  infra (capture/render) + the judge. That's the point — you keep the orchestration.
- **Don't re-derive the judge or beat sampling** — verify owns both. Your job is
  author → read scores → fix worst → repeat.
- **Budget the loop:** 3–5 scoring passes is plenty for most clips. If composite
  won't climb, the limiter is usually the source or the intent, not more passes.
