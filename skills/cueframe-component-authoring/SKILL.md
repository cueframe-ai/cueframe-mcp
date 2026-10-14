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

When `get_context` reports the project lane as local, motion does not need an account or an org
component. Components here are native (source version 4) too:
- **New component:** open a draft with `open_component_preview`, passing `template`,
  `component_manifest` (`{version:4, runtime:'hyperframes', hfContract:1, kind:'scene', assets,
  graphics, alphaPolicy}`) and `component_definition`.
- **Existing component:** pass `component_id` instead, to start from the clip's pinned version or
  the library version.

The draft is admitted in full: template lint, determinism and the variable declaration.
`data-composition-variables` must equal the definition's projection (its scalar inputSchema
properties, then the manifest's slots).

Edit the draft with `update_component_preview` (exact-text `{oldText, newText, replaceAll?}`
edits). Check exact frames with `render_component_preview_frame`, and inspect playback for motion.
`commit_component_preview` publishes the checked source to the library and pins the clip, with a
fresh ETag. `read_component` and `edit_component` read and edit the library directly. Close the
preview when finished.

Media slots are image or video, declared in `component_manifest.assets` and bound to project
media ids in `component_assets`. The template passes them to `MediaTileScene` as
`streams: { hero: { asset: assets.hero } }`. Declare `alphaPolicy` explicitly:
`requires-transparency` for overlays, `allows-opaque` for full-frame plates.

Every frame must be a pure function of `render.frame`, params and `render.seed`. Timers, `Date`,
network, imports, other globals and CSS animation are refused at admission. The timeline and final
export render the exact committed version. Use `create_component` only for a reusable org-catalog
component on a reachable cloud lane.

## Upgrading an old project

`get_composition` returns `needsUpgrade` only when clips from before the native cutover remain:
`[{clipId, kind, componentId?, sourceVersionId?, primitiveId?, successorComponentId?,
successorSourceVersionId?}]`. Saves and renders refuse those clips. A retired component is
refused with `component_source_retired` (its `locator.clipIds` names the clips), and a retired
primitive with `render_unknown_primitive`. Upgrade only the listed clips. Keep every other clip,
timing, track and brand-kit binding as it is.

- **Any entry with a `successorSourceVersionId`:** call `repin_component` with its clip ids. It
  moves them to the native successor and keeps their saved inputs.
- **`v3-component` with no successor** (a custom pre-cutover component): read its source, params,
  timing and placement, and author a native replacement with `create_component` as a version-4
  template following the server instructions' Component Contract.
- **`unpinned-component`:** the clip carries a `retired` record (what was stored before the cutover), with its
  props preserved. Re-author it from those props the same way.
- **`retired-primitive`:** rebuild what `primitiveId` drew from the clip's params, as a card or
  a native component.

For each replacement, use `apply_composition` to replace only that clip at the same start,
duration, track and placement, pinned to the new exact `sourceVersionId`. Map the old params
onto the new inputs; do not invent new content. Verify each clip with `preview_frame` at a time
inside its window and confirm `needsUpgrade` is gone. Only then render (`create_render`).

## Choosing what to fork
Use the `component-library` projection to choose a definition, inspect its input schema and
capabilities, then fetch its exact scoped source as described in Path A. Presets and recipes
are different card kinds: follow their exact definition/document references rather than treating
those IDs as source IDs. Inspect appropriate previews before judging visual behavior.

## Layout inside a component — CSS flex/grid

When several cells must share space (a feature grid, a fixed rail beside fluid content, a cast of
objects next to type), lay them out with CSS flex or grid in the HTML, not hand-placed pixels.
Use the template of a native component, or a `card`:

```html
<div style="display:grid; grid-template-columns: 520px 1fr 3fr; gap:16px; width:100%; height:100%">
  <div class="rail"></div><div class="type"></div><div class="art"></div>
</div>
```

- Fixed tracks (`520px`) hold content-sized cells. Fractions (`1fr`, `3fr`) share what is left.
- Animate a reflow from the frame, never from time: in a card, drive `grid-template-columns`
  or `flex-basis` from `var(--cf-progress)` (or `--cf-enter`/`--cf-exit`); in a native template,
  derive it from `render.frame`.
- Size the container to its region instead of CSS-`scale()`-ing the layout, which resamples.
  Use `object-fit` for media in a cell.

## Don't
- Don't expect a forked primitive to use rich named props — read `params` inside and use the explicit
  `assets` and `render` bags for media and frame state.
- When a built-in fits the request, fork its exact snapshot using Path A. Never discard its
  definition by copying only its template; preserve the definition and manifest too.
- Don't `create_component` a fresh id each fix iteration — `update_component` (same id) is the loop.
