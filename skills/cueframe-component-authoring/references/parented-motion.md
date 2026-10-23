# Parented motion with an editable event clock

Use this example to keep mounted UI on one projected plane and make a cursor action retimeable. It is original CueFrame sample artwork under this repository's Apache-2.0 license, with no external assets. It is not a Cardly reproduction or a real app capture. For physical lighting, depth intersections or a moving 3D camera, use the scene-shot contract instead.

[Complete card source](parented-device-card.json) is a `kind:"card"` source object. Put it on an overlay clip at full-frame 1920×1080, 30 fps, duration 4 seconds; use the live `clip.add` schema for the surrounding operation. It includes an opaque full-duration background, so it is a complete scene plate. When using it over other content, remove that background intentionally rather than hoping it is transparent.

The `.phone` applies the pose once. Its `.screen` clips the card, text, control and pointer as mounted children. Their coordinates stay in phone space. No child independently counter-rotates to approximate the parent's pose. The pointer's top-left tip arrives at the control center `(180,435)` in screen coordinates.

The host supplies `--cf-t` in clip-local seconds. Tokens `settleSec`, `contactSec`, `approachSec` and `responseSec` determine arrival, pointer contact and response; the status and control use the same response phase. The sample keeps its readable state after settling and after contact. Changing `contactSec` shifts the approach and response together. Positive travel/response durations are required by its CSS divisions; keep contact after the approach and allow a readable hold before the clip ends.

`holder` is a CSS string token, so its value includes quote characters. Preserve it when editing the pose or timing. `accent` and `tiltDeg` control visible style and geometry. They are ordinary card tokens; built-in clock keys are not authored tokens.

For the initial proof, inspect the pose in travel, the settled plane, the frame before contact, the contact frame, the response and the last frame. Also inspect a motion preview across arrival and contact. After changing `contactSec`, check that the cursor and response move together, the holder remains, and the full scene still covers its duration. These are tests of this recipe's mechanism; use the reference's actual landmarks for a real film.

This CSS uses a fixed design-space phone inside a full-size card. Recompose for a different aspect/size instead of assuming this sample is responsive. Static layout fidelity, sampled motion and actual playback are distinct evidence. The validation record belongs with the produced preview artifact, not inside this reusable skill.

## Fit and reuse the same object

For a reference-led device, compare the outer silhouette, screen corners and inset, then the mounted card and its typography. A correct bounding width can still hide the wrong perspective. Parenting keeps transforms together, but a child rendered on a different apparent plane can still contradict the device. Inspect a moving pose as well as the settled one before reusing the object across scenes.

Use a small set of editable properties for likely corrections: screen inset, card size, text scale, internal gap, pose and event times. A CSS font-size is not a measurement of visible cap height or text width. Calibrate those relationships from the rendered glyphs and preserve intentional copy adaptations. Do not turn every measured pixel into a global design token.

Publish a reusable native source once, then pass its exact version and relevant parameters to coauthors. Editing its source creates a new version; placed clips remain pinned to the old version. Explicitly adopt the fitted version in the intended placements through the available admitted composition operation, and inspect those uses. Source publication and placement adoption are separate operations; an isolated preview alone does not prove the timeline changed.

When several authors work on one project, existing clip guards cover the whole clip and its structural dependencies, not independent CSS fields. A shared source adoption or dependent timing revision needs current composition state. If another author or the user changed the target, reread and reconcile the intended edit; preserve their copy, timing and unrelated placements rather than replacing a stale document with a fresh token.
