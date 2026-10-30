# Forking and layout

Defaults, examples and detail for this topic. The [skill](../SKILL.md) and the [project and capability policy](../../composing-video/references/project-policy.md) take precedence where they differ, and the current tool schemas are authoritative.

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
