# Retired project sources

## Upgrading an old project

`get_composition` returns `needsUpgrade` only when clips from before the native cutover remain:
`[{clipId, kind, componentId?, sourceVersionId?, primitiveId?, successorComponentId?,
successorSourceVersionId?}]`. Saves and renders refuse those clips. A retired component is
refused with `component_source_retired`, and a retired
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

