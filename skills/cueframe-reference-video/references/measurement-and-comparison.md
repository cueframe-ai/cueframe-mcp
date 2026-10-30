# Reference ledger and matched-time comparison

Keep observations, measurements and inferred implementation separate. A ledger can use ordinary shot notes; it does not require a new timeline or rigid production schema.

| Note | Useful evidence |
|---|---|
| Purpose and identity | What this phrase communicates; recurring subject, type, palette, artwork and material cues |
| Time | Source seconds/frames, meaningful arrival/hold/exit windows, source/output time mapping |
| Geometry | Normalized positions and projected sizes, margins, two corners or edges of a moving subject |
| Motion | Direction, changing displacement, acceleration/settling, rotation/depth cues, blur and opacity |
| Handoff | What disappears first, what overlaps, which object carries the eye, actual cut versus inferred morph |
| Sound | Observed cue/onset, rhythmic change or deliberate silence; whether heard or only measured |
| Evidence and confidence | Source identity, sampled timestamps, image/motion/audio evidence, observed/measured/inferred/unknown |

Start with broad coverage to find the important windows. Use denser samples for a fast handoff, a long camera move or text with a short reading window. Source-rate inspection is useful near impacts, replacements and direction changes. Sample only valid source times; an encoded audio tail is not extra video. If the tool samples or seeks approximately, retain that uncertainty rather than claiming frame-exact timing.

For each difficult move, compare source and output at identical timestamps. Follow the same landmarks: projected width may match while pose, occlusion or velocity is wrong. Inspect before, during and after the transition, not just its landed state. Do not temporally warp the result to conceal drift. A visible replacement is not evidence of a continuous extraction, and cursor contact does not prove a selected or confirmed UI state.

Use isolated authoring previews to establish technique, then persisted timeline previews to verify placement and interaction with other layers. After changing component source, verify its pinned source version and the output where the change should be visible; a composition ETag alone may not identify a changed referenced source.

Record findings as `time/window · observed mismatch → intended correction · what stays`. Reinspect the affected move and adjacent handoffs. Structural feedback can change the story and require retiming dependent copy, camera, graphics and sound; preserve unrelated user edits against current shared state.

A complete delivery can include a small set of fidelity anchors, critical motion comparisons, actual movie identity, asset/source provenance and unresolved differences. Audio signal measurements establish technical properties, not a listening verdict. Reusing the reference mix can isolate picture timing, but it does not demonstrate an authored score; reordering visuals may require reconsidering that mix.

## Handoff and review continuity

Use the existing brief, ledger or review notes for continuity. For reference work, supply inspectable reference media/frames and their identities and relevant timestamps. Once a candidate exists, include its evidence, saved composition and pinned source versions, and the current finding with its intended correction. Include consecutive motion where a still cannot establish behavior. Confirm the receiving author can access and has inspected this evidence before dependent authoring; a coordinator's inspection, ID, path or verbal summary does not establish receipt. If evidence is missing, recover it through supported tools and continue independent work. A busy render slot does not prevent sharing existing artifacts, and analysis-only reference media need not be added to the authored output.

Keep the full delivery goal distinct from the latest scoped amendment. After resumption or delegation, recover both and the current saved review state before acting. Route failed saved comparisons back to their author or name a successor with that continuity. Source-only changes leave an open review until the saved result is reinspected. Tie each review verdict to the inspected window and composition/source versions: preserve unrelated review results, and recheck windows affected by changed source or timing.

## Worked correction: title spacing and a list thumbnail

In a 1920×1080, 30 fps reference study, the title at frame 117 had a 34px gap from its left word to a central mark and a 41px gap from that mark to the right word. The saved reproduction measured about 3px and 22px. Its type group was also narrower: 1021px against 1304px. These were visible glyph bounds in the output, not the HTML elements' CSS widths.

Inspect the separate frames, then an unaligned 50% overlay. Establish outer group placement and cap height before adjusting the two internal gaps. Change the actual title/mark source, preserving approved copy and the timeline. The corrected saved preview measured about 35px and 39px, with a 1315px group width. Those measurements had approximately ±2–4px uncertainty. They establish a specific spacing improvement, not a font match or a whole-film fidelity percentage.

At frame 180, a list thumbnail was 190px high against a 154px reference and had about 30px top inset against 48px. Its row pitch was already close. Reducing the thumbnail and recovering its inset corrected that relationship without rebuilding the outer panel or retiming the film. Use the same crop coordinates for both images so a shifted crop cannot hide a shifted object.

The title's settled frame improved, but around frame 99 its moving carrier remained displaced by roughly 90px. The list entrance and exit also remained late. This is the useful counterexample: a well-fitted endpoint does not establish the correct path, rotation, overlap, acceleration or timing. Reinspect the affected entrance, hold and exit; use continuous playback for the final motion verdict.

These observations come from CueFrame's Cardly reconstruction study. They are a worked diagnostic example, not default gaps, a required style or a reusable claim about every film. Keep the source reference separate from authored reconstruction layers.

## Reading comparison evidence

`compare_frames` compares already identified inputs. A source-frame operand may decode the certified representation; a candidate references an existing saved preview. Replaying a comparison or changing its crop does not mean a new composition render occurred. Read the delivered images and receipt rather than inferring delivery from URLs or metadata.

Keep actual frame indices, rational FPS/timebase, requested versus sampled time, dimensions, source hashes and composition/source versions with the observation. Hosted render bookends can make the internal render frame differ from the composition frame. A normalized representation is not necessarily the original file's clock. Unknown color transforms, approximate seeks or missing frames constrain the conclusion.

Use the raw pair and overlay at unchanged coordinates. A difference image can locate change but is easily dominated by backgrounds and materials; it is not an acceptance score. Automatic image registration can conceal displacement. Cropping is a view into the same coordinate space, not permission to independently fit the two images.

For an intentional structural revision, record the source-to-output event correspondence and compare those events. Do not temporally warp the evidence or undo the user's changed timing merely to reduce image differences. After editing, compare a preview from the new saved source, then inspect connected motion and sound.
