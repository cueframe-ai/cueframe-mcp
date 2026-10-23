# Native component workflows

Choose the path exposed by the current host. Request schemas and the Component Contract own exact fields; these examples explain source and placement identity.

## Path A — MCP agent (no filesystem; source lives server-side)

Use the live tool schema for request envelopes; hosted write fields are normally under `body`. When `get_composition` advertises `clipIds` and `response`, use selected clip IDs with `response:"full"` to retrieve the complete sources you need without pulling every large HTML body. Treat a projection as a partial read, never a replacement composition. Compact apply receipts retain the saved revision and warnings; reread relevant state before a dependent edit. Desktop surfaces may expose different fields.

1. **Discover and read a built-in:** call `list_catalog` with
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
   **Adopt the source in the requested scope:** publication leaves existing placements pinned
   to their previous versions; `placementsPinnedToPrevious` reports those uses. Source publication
   plus placement adoption is not an atomic source-write operation. Read the current composition
   and `describe_composition_ops`, then use the admitted `component.repin-v3` operation with complete
   before/after execution references and the observed exact composition revision. Its historical
   name also covers supported version-4 execution references. Preserve unrelated placements and
   parameters. An unavailable placement capability is a refusal, not permission to bypass source
   admission or substitute an unpinned head. Reinspect the adopted source in the saved timeline.
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
npx -y cueframe@0.11 init --json                       # scaffold cueframe.json + cueframe/components/
npx -y cueframe@0.11 new component my-badge --category ui-blocks --json   # scaffold a component in the workspace
#   New scaffolds contain template.html and definition.json (native source, version 4).
# …edit cueframe/components/<id>/template.html and definition.json in your editor…
npx -y cueframe@0.11 push my-badge --json              # send the native source; the server admits it
#   or: npx -y cueframe@0.11 sync --json               # push every component in the workspace
# reference the component id in your composition, then render:
npx -y cueframe@0.11 render <projectId> -o ./out.mp4 --json
```

The CLI writes `template.html` and `definition.json` (input schema, defaults, timing and
capabilities). `cueframe.json` → `components.<id>` holds the version-4 `manifest` and the catalog
`name` and `category`, which `push` requires; it refuses a component missing either.
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
`commit_component_preview` publishes the checked source to the library and pins the clip, and
returns the project's new ETag. `read_component` and `edit_component` read and edit the library
directly. Close the preview when finished.

Media slots are image or video, declared in `component_manifest.assets` and bound to project
media ids in `component_assets`. The template passes them to `MediaTileScene` as
`streams: { hero: { asset: assets.hero } }`. Declare `alphaPolicy` explicitly:
`requires-transparency` for overlays, `allows-opaque` for full-frame plates.

Every frame must be a pure function of `render.frame`, params and `render.seed`. Timers, `Date`,
network, imports, other globals and CSS animation are refused at admission. The timeline and final
export render the exact committed version. Use `create_component` only for a reusable org-catalog
component on a reachable cloud lane.

