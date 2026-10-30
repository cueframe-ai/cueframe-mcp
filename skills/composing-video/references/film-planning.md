# Film planning

Defaults, examples and detail for this topic. The [skill](../SKILL.md) and the [project and capability policy](project-policy.md) take precedence where they differ, and the current tool schemas are authoritative.

## Scope and capability policy

User intent and acceptance criteria override this recipe's aesthetic defaults. Silent, typography-only, uncaptioned and slow work are valid; no universal narration, footage, CTA, beat count or score target. Contracts, factual fidelity, media bindings and current source revisions remain mandatory.

Read available tools and current project; preserve the chosen local/hosted lane. Supported local work needs no hosted registration. Do not silently install, authenticate, switch projects or upload local content. Before metered hosted work, check `get_account`, entitlements, balance and quotes. Desktop setup: https://docs.cueframe.ai.

For scoped revisions, preserve unrelated timing, media, audio and shared brand-kit state. Edit affected content; inspect relevant frames, continuous motion and affected audio. No restarted intake, new approval pause, paid judge or final export by default. Judge only when useful; scores never override acceptance failures. Stop/report after two no-improvement passes. See [preview workflow](../../cueframe-compose-loop/references/preview-workflow.md).

For preview selection and small revisions, use `cueframe-compose-loop`'s
[preview workflow](../../cueframe-compose-loop/references/preview-workflow.md). Retain the approved
brief/rubric for a local correction; check the affected behavior and relevant regressions instead
of restarting the new-film method below. A diagnostic or preview-only request does not require
a final export or a whole-film judge pass. Explicit user scope takes precedence over craft defaults.

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
