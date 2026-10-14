---
name: cueframe-component-authoring
description: Use when authoring, forking, or customizing a CueFrame motion-graphics component/primitive/graphic — e.g. "customize the cinematic-title primitive", "make my own animated lower-third", "fork a CueFrame template and edit it", "author a custom graphic and render it". Covers cloud MCP, local desktop, and CLI project paths using complete versioned source snapshots. Use BEFORE hand-writing a component from scratch — forking a built-in is usually the faster start.
---

# CueFrame component authoring (fork / customize / own)

## Scope and capability policy

User intent and acceptance criteria override this recipe's aesthetic defaults. Silent, typography-only, uncaptioned and slow work are valid; no universal narration, footage, CTA, beat count or score target. Contracts, factual fidelity, media bindings and current source revisions remain mandatory.

Read available tools and current project; preserve the chosen local/hosted lane. Supported local work needs no hosted registration. Do not silently install, authenticate, switch projects or upload local content. Before metered hosted work, check `get_account`, entitlements, balance and quotes. Desktop setup: https://docs.cueframe.ai.

For scoped revisions, preserve unrelated timing, media, audio and shared brand-kit state. Edit affected content; inspect relevant frames, continuous motion and affected audio. No restarted intake, new approval pause, paid judge or final export by default. Judge only when useful; scores never override acceptance failures. Stop/report after two no-improvement passes. See [preview workflow](../cueframe-compose-loop/references/preview-workflow.md).

Use `cueframe-compose-loop`'s [preview workflow](../cueframe-compose-loop/references/preview-workflow.md)
to select hosted or local evidence and separate iteration from final delivery.

CueFrame ships built-in motion-graphics definitions (titles, lower-thirds, captions,
effects, transitions and layouts). Discover the current catalog; fork an exact definition, customize it,
and render it on CueFrame — or author a brand-new component. This is shadcn-for-video: own the
component code; CueFrame is the reliable engine that renders it.

**Before you hand-write 3D:** a device mockup or a screenshot floating in a lit 3D scene is a
**scene shot** — validated JSON with `scene.add` / `scene.update`, not a component you author.
See the `cueframe-scene-shot` skill and `cueframe://scene-shot`. Author a component here when
you need behaviour the scene contract does not express.

**Source format matters:**
- New and changed components are native (source version 4): `{version:4, componentId, template,
  manifest, definition}`. `template` is one HyperFrames sub-composition whose script ends in one
  `__cfScene.mount(...)`; the manifest is `{version:4, runtime:'hyperframes', hfContract:1,
  kind:'scene', assets, graphics, alphaPolicy}`. The definition declares input schema, defaults,
  timing, brand/media bindings and capabilities. The server instructions' Component Contract has
  the full rules. Version-3 TSX sources are retired and refused as `component_source_retired`.
- Neither renderer runs authored source in the editor process. Local and hosted execution
  use isolated render processes and exact immutable source revisions.

## Path A — MCP agent (no filesystem; source lives server-side)

Use the live tool schema for request envelopes; hosted write fields are normally under `body`.

1. **Discover and read a built-in:** call `list_components` with
   `projection: "component-library", origin: "builtin", libraryKind: "definition"`.
   Select the intended card and preserve its complete scoped source reference. Call
   `get_component_source` with that reference's `componentId`, `sourceVersionId`,
   `builtinCollection` (its scope collection).
   ID-only builtin reads are unsupported. An unavailable exact pin is a refusal; never
   retry another scope or an unpinned head.
2. **Author/own it:** edit the complete native `sourceSnapshot`; use your chosen owned ID
   consistently in its `componentId` and the request. Send it as `body.source` to
   `create_component`, with required metadata. Preserve its definition, capability
   declarations, manifest and source format. For an existing component, keep its ID and
   use `update_component` with the complete source. Do not send an old pin as the identity
   of changed source: saving produces a new immutable source version.
3. **Iterate (author→preview→fix):** `preview_component({ componentId, params })` queues a durable
   preview and returns a `jobId`; call `wait_job(kind:"preview")`. The typed terminal result is a
   verified artifact produced by the same bundle contract used by final render. A failed
   `component_does_not_compile` job carries the compiler error — read it, fix via `update_component`
   (same id, in place), and preview again.
   **Repin only the requested scope:** for all matching placements in one composition, use
   `update_component({ componentId, body: { source: editedSnapshot, projectId, compositionId? } })`
   with the observed revision and dependency guards. A placed clip
   renders the exact version it pins; only the composition you name moves to the new version in the
   same write (`repinned` says what moved). Without `projectId` your clips keep rendering the old
   version, and `placementsPinnedToPrevious` counts them. For a single placement, update the
   source without `projectId`, then change only that clip to the returned exact source pin
   using the observed concurrency guards.
   Set preview duration deliberately: `durationInFrames` is not a trim window and can retime
   duration-dependent motion. Preserve production timing; inspect the live tool's request shape.
4. **Check integration:** add it as a `{kind:'component', componentId, props:{},
   execution:{version:4,componentId,sourceVersionId,params,seed,assets}, placement:{version:3,kind:'clip'}}` clip
   (`apply_composition`), then inspect saved-composition stills or a scoped `preview_clip` for
   placement and motion. Use `create_render` → `wait_job kind:"render"` when delivering a
   finished MP4, not per tweak.

## Path B — CLI / coding agent (customer-owned source under git)

Source lives in `cueframe/components/<id>/` (the `cueframe.json` workspace); edit the native
template locally, push to render.

```bash
npx -y cueframe@0.8 init --json                       # scaffold cueframe.json + cueframe/components/
npx -y cueframe@0.8 new component my-badge --json     # scaffold a component in the workspace
#   New scaffolds contain template.html and definition.json (native source, version 4).
# …edit cueframe/components/<id>/template.html and definition.json in your editor…
npx -y cueframe@0.8 push my-badge --json              # send the native source; the server admits it
#   or: npx -y cueframe@0.8 sync --json               # push every component in the workspace
# reference the component id in your composition, then render:
npx -y cueframe@0.8 render <projectId> -o ./out.mp4 --json
```

The CLI writes `template.html` and `definition.json` (input schema, defaults, timing and
capabilities). The version-4 manifest lives at `cueframe.json` → `components.<id>.manifest`.
`push`/`sync` send these as one native `source`, checked against the contract's source schema;
the server's admission (template lint, determinism, declarations) refuses with a named rule.
For a builtin fork, copy **all three parts** from the selected `sourceSnapshot`: template,
definition and manifest. A workspace component that still has a version-3 `index.tsx` is
refused as `component_source_retired` before any API call; author it again as a native template. To preview before
a full render, push it and use the appropriate component preview loop.

## Path C — Director editing a local desktop project (project-embedded source)

When `get_context` reports the project lane as local, motion does not require an account or an org
component. When exposed, use `open_component_preview` to compile an isolated preview (new source,
with an explicit `component_definition`, or `component_id` to preserve an existing library source), `update_component_preview`
with exact-text edits (`{oldText, newText, replaceAll?}`, each `oldText` matching once), and
`render_component_preview_frame` for exact frame evidence. Inspect playback for motion;
`commit_component_preview` publishes the checked source to the library and pins the clip, with a
fresh ETag. `read_component` and `edit_component` read and edit the library directly. Close the preview when finished. This loop does not bake a timeline video and
does not imply HMR: source updates still compile.

If those tools are unavailable, add/update through `apply_composition` and inspect the local
timeline. An inline custom overlay has this shape:

```json
{
  "type": "clip.add",
  "clip": {
    "id": "local-motion",
    "kind": "overlay",
    "startTime": 0,
    "duration": 3,
    "source": {
      "kind": "overlay",
      "primitiveId": "custom",
      "params": {
        "jsxSource": "export default function Graphic({ durationInFrames, params, assets, render }) { ... }",
        "componentManifest": { "version": 2, "assets": {}, "graphics": { "api": "canvas2d", "required": true, "accelerationPreference": "software-allowed" }, "alphaPolicy": "requires-transparency" },
        "componentDefinition": { "inputSchema": { "type": "object", "properties": {}, "additionalProperties": false }, "defaults": {}, "timing": { "defaultDuration": { "frames": 90, "fps": 30 } }, "brandBindings": [], "capabilities": [{ "kind": "clip" }] },
        "componentAssets": {}
      }
    }
  },
  "newTrack": true
}
```

The desktop compiles the module in an isolated child process and creates it in the desktop's component
library as a complete v3 source. Declare the actual parameter schema and defaults in
`componentDefinition`; the empty schema above is for a graphic with no custom parameters.
Keep a fork's existing definition and nested manifest together with its source. Inline source creates a component only: a clip whose component already exists with other
source is refused as `component_exists`, and that component changes through edits.
The timeline and final export render that exact version; no preview media is baked. A compile failure
refuses the whole batch and leaves the composition untouched. Use `create_component` only for a reusable
org-catalog component on a reachable cloud lane.

For media-backed graphics, declare each slot in `componentManifest.assets`, bind the slot to a
project media id in `componentAssets`, and read its request-scoped handle from `assets`. The renderer
localizes and hashes the file before execution. Remote URLs, undeclared assets, arbitrary filesystem
paths, WebGL substitution, and static/card substitution are not fallback paths.

Declare `componentManifest.alphaPolicy` explicitly: `requires-transparency` for overlays and
`allows-opaque` for intentional full-frame plates. Both adapters verify the same field.

Normal static imports are supported only from the runtime allowlist: React, Remotion, Three.js
WebGPU/TSL, React Three Fiber/Drei, Remotion Three, and CueFrame animation helpers. Use ordinary hooks,
loops, refs, constructors, typed arrays, canvas, and WebGPU when needed. Drive visible animation from
`render.frame`/`render.fps` and seed variation from `render.seed`; ambient time/randomness is refused.

## Upgrading an old project

When `get_composition` flags `needsUpgrade`, the project has clips from before the native
cutover. They cannot render, and the flag lists their clip ids. Upgrade only those clips.
Keep every other clip, timing, track and brand-kit binding as it is.

1. **A retired clip that names a `successorSourceVersionId`:** call `repin_component` for it.
   That moves the clip to its native successor and keeps its saved inputs. You can name several
   clip ids in one call. Clips with no successor come back listed as without one.
2. **Any other retired clip** (a custom pre-cutover component, or a retired built-in with no
   successor): read the clip's preserved original data, meaning its source, params, timing and
   placement. Author a native replacement from it with `create_component`, as a version-4
   HTML template following the Component Contract in the server instructions. Then use
   `apply_composition` to replace that one clip at the same start, duration, track and placement,
   bound to the new exact `sourceVersionId`. Map the old params onto the new inputs; do not
   invent new content.
3. **Verify** each upgraded clip with `preview_frame` at a time inside its window. Confirm that
   `needsUpgrade` is gone from `get_composition`. Only then render (`create_render`).

## Choosing what to fork
Use the `component-library` projection to choose a definition, inspect its input schema and
capabilities, then fetch its exact scoped source as described in Path A. Presets and recipes
are different card kinds: follow their exact definition/document references rather than treating
those IDs as source IDs. Inspect appropriate previews before judging visual behavior.

## Layout inside a component — `FlexLayout` / `solveFlex`
When a graphic has several cells that must share space — a feature grid, a fixed rail beside
fluid content, a cast of objects next to type — don't hand-place pixels. The layout helpers
are in `@cueframe/animate` (on the import allowlist):

```tsx
import { FlexLayout } from '@cueframe/animate';
const R = params.region ?? { x: 0, y: 0, w: 1, h: 1 };
<FlexLayout
  tracks={[{ weight: 0, basis: 520 }, 1, { weight: 3, split: [1, 1] }]}
  tracksEnd={[{ weight: 0, basis: 520 }, 1, { weight: 1, split: [2, 1] }]}
  fits={[{ mode: 'stretch' }, { mode: 'position' }, { mode: 'matte', aspect: 1 }, { mode: 'stretch' }]}
  gap={16} width={R.w * width} height={R.h * height}>
  <Rail /> <Type /> <Art /> <Block />
</FlexLayout>
```

- Tracks are **weights, not pixels**; `{ weight: 0, basis: 520 }` is content-sized and pushes its
  neighbours. Children fill the leaves depth-first (a `split` nests cells on the other axis).
- `tracksEnd` animates: weights ease across the clip and **every cell re-solves per frame**. A cell
  present on only one side enters from / exits to zero. Layout is the motion — no keyframed positions.
- `fits`, one per leaf: `stretch | contain | cover | position | scale | matte`. `position` keeps type at
  its natural size; `matte` clips a window instead of resizing the art.
- Inside a `params.region` container pass `width`/`height` = the region's pixel size so nested splits and
  aspect fits solve against the region, not the frame. **Never CSS-`scale()` the layout** — it resamples;
  size the container instead.
- 3D in the same rig: `solveFlex(tree, size, weights)` returns the boxes; `flexBoxToThree(box, size)`
  centres a mesh under `<ThreeCanvas orthographic>` (frustum pinned 1:1 to pixels), so one canvas holds
  every object exactly on its cell.
- Same inputs, same boxes everywhere: the solve is pure and yoga-backed; nothing is measured from the DOM.
  Text is placed, not measured — declare sizes with `basis` when a cell must fit its content.

## Don't
- Don't expect a forked primitive to use rich named props — read `params` inside and use the explicit
  `assets` and `render` bags for media and frame state.
- When a built-in fits the request, fork its exact snapshot using Path A. Never discard its
  definition by copying only its template; preserve the definition and manifest too.
- Don't `create_component` a fresh id each fix iteration — `update_component` (same id) is the loop.
