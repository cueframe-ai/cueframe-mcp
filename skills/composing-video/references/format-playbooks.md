# Format playbooks

Defaults, examples and detail for this topic. The [skill](../SKILL.md) and the [project and capability policy](project-policy.md) take precedence where they differ, and the current tool schemas are authoritative.

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
