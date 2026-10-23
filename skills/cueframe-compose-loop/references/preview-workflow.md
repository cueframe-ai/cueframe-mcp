# Preview, iteration, and delivery

Choose the evidence for the current request. A small revision is not a new-film workflow. Preserve the approved brief, timeline, and unaffected source; inspect the affected behavior and relevant regressions. Export when the user requests a finished video or the work reaches final delivery, not after every preview or parameter edit.

## Select the available lane

Read the current tool contracts and project context. Do not infer a hosted session from a local desktop tool, or require cloud registration for a local project.

| Need | Hosted evidence | Local desktop evidence, when exposed |
|---|---|---|
| Isolated HTML card layout | `preview_card` with the card's HTML and tokens | Inspect the card in the local project |
| Authored component layout or motion | `preview_component`, with explicit dimensions, FPS, params, assets, and appropriate duration | `open_component_preview` → `update_component_preview` (exact-text edits); inspect playback and `render_component_preview_frame` at exact frames |
| Saved composition layout and overlap | `preview_frame`, batching the needed timestamps | The local composition preview/capture tools |
| Cuts, entrances, camera motion, or audio timing | `preview_clip` for the affected `[fromSec, toSec)` window, including its lead-in and settle | Play/seek the affected window; capture matching frames when needed |
| Finished deliverable | `create_render` and verify the resulting file | The project's export path and verification of its resulting file |

Hosted calls use `projectId` and the request shape declared by the live tool. `preview_component` returns a job ID: wait with `kind:"preview"`. `preview_frame` uses `kind:"preview_frame"`. `preview_clip` returns a render job: wait with `kind:"render"`, even though it is a preview. Reuse the returned job ID; do not submit duplicate jobs while waiting. Hosted evidence jobs do not require opening or warming a compose session.

The local component preview compiles replacement source revisions; it is not a promise of browser HMR or zero compilation work. `commit_component_preview` commits the inspected revision and returns the project's new ETag. An isolated preview does not itself edit the saved timeline. Close the preview when finished if that tool is available.

## Bound the work without changing the animation

- Use a component's existing params for supported changes; update its source in place only when necessary. Do not create a new component ID for each tweak.
- `durationInFrames` sets the component's render duration; it is **not a generic trim window**. Shortening it can retime animations normalized over duration. Preserve production timing. Use a documented component-specific offset only if it preserves that timing, or use the saved composition's `preview_clip` window. `startFrame` is not a universal preview API parameter.
- Preserve FPS when judging motion. Choose resolution for the question: a low-resolution motion preview may establish timing but not typography, glass edges, or final-resolution shader quality. Use appropriate stills for those details.
- Batch related still timestamps within the tool's delivery bounds. Check which image blocks actually arrived and their timestamp/identity; metadata for more frames does not establish their delivery. Request missing frames through the supported selector or another bounded preview. Repeating an unchanged completed job is not evidence of additional frames. A contact sheet shows sampled frames, not continuous playback. Inspect the critical motion window and listen when the change affects sound.
- Scope output and compute are different: a short composition preview can still trigger preparation or an alpha bake on a cache miss. Inspect progress/receipts before diagnosing cost. Do not promise instant previews, cross-job cache hits, or that every requested still requires a full bake.

## Evidence and stopping

Keep component source revision/hash, params, asset bindings, dimensions, FPS, requested frames/window, and returned artifact/job identity together. For hosted composition parity, inspect `previewed.source`, composition ID, and ETag where provided. Source can change without changing the composition ETag. Unchanged pixels outside an edit's visible frame range do not by themselves prove a stale cache.

Compare affected frames and motion with the reference at matching timestamps, or corresponding named events when a requested revision intentionally retimed them. For structural changes, inspect connected layers and the intervals on both sides of each affected boundary; preserve a complete ending, including its background and audio tail. Keep isolated-component proof distinct from saved-composition proof and final-export proof. For a minor edit, stop once the requested behavior and relevant regressions are checked; report the preview and explicitly say if no new final export was made.

For precise reference matching, `compare_frames` can place a certified source frame beside an existing saved preview and return an unaligned overlay. Use full-resolution images for glyph bounds and spacing; request a common-coordinate crop for details. Read actual frame/source identities, color/display transforms and delivery status from the result. Derived comparison images are diagnostic evidence, not authored reconstruction layers. Reuse the candidate preview; comparing a different view does not require rendering it again.

After a correction, capture the affected saved version and compare it with the same reference moment. Inspect the adjacent movement separately: doubled edges in an overlay can identify a displaced object, but they cannot explain its acceleration or establish that sound is synchronized. A former comparison remains evidence of the former source; it does not update when a component or composition changes.

Use `score_composition` for broader editorial/brand review when useful and within budget. Do not require repeated whole-film judging to verify a known local correction. A judge score does not override a failed acceptance criterion or the user's visual feedback.

Check account balance and current quotes before metered hosted work. Record actual job charges separately for preview, judging, and final export; separate those from agent time/token cost and from infrastructure estimates. Compare workflows only after testing equivalent changes and evidence requirements. Existing previews should be exercised before proposing new infrastructure.
