# Authoring paths

Defaults, examples and detail for this topic. The [skill](../SKILL.md) and the [project and capability policy](../../composing-video/references/project-policy.md) take precedence where they differ, and the current tool schemas are authoritative.

## Scope and capability policy

User intent and acceptance criteria override this recipe's aesthetic defaults. Silent, typography-only, uncaptioned and slow work are valid; no universal narration, footage, CTA, beat count or score target. Contracts, factual fidelity, media bindings and current source revisions remain mandatory.

Read available tools and current project; preserve the chosen local/hosted lane. Supported local work needs no hosted registration. Do not silently install, authenticate, switch projects or upload local content. Before metered hosted work, check `get_account`, entitlements, balance and quotes. Desktop setup: https://docs.cueframe.ai.

For scoped revisions, preserve unrelated timing, media, audio and shared brand-kit state. Edit affected content; inspect relevant frames, continuous motion and affected audio. No restarted intake, new approval pause, paid judge or final export by default. Judge only when useful; scores never override acceptance failures. Stop/report after two no-improvement passes. See [preview workflow](../../cueframe-compose-loop/references/preview-workflow.md).

Use `cueframe-compose-loop`'s [preview workflow](../../cueframe-compose-loop/references/preview-workflow.md)
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
