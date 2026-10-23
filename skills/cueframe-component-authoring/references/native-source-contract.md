# Native version-4 source contract

Read this when authoring or changing a custom native component. Scene-shot JSON is a different contract served by `cueframe://scene-shot` or desktop `get_scene_contract`; it does not describe a custom component source. Live schemas and named admission errors govern supported fields.

Create and update components with a complete `source` object: `{version:4, componentId, template, manifest, definition}`. TSX (version 3) sources are retired: writing one is refused as `component_source_retired`. The definition declares input schema, defaults, timing, brand/media bindings and placement capabilities. The manifest is `{version:4, runtime:'hyperframes', hfContract:1, kind:'scene', assets, graphics, alphaPolicy}`: `assets` declares the media slots (only `image` and `video` slots), `graphics.api` is `webgl2` (or `webgl`), and `alphaPolicy` is `requires-transparency` or `allows-opaque`.

The `template` is one sub-composition. Every source is admitted before it is stored or rendered, and a refusal names the broken rule:
- `<template>` holds one root `<div id="root" data-composition-id="<componentId>" data-width="1920" data-height="1080" data-no-timeline data-composition-variables='…'>` containing one empty `<div data-cf-scene></div>` (and any static DOM of your own beside it), and one classic inline `<script>`.
- The script finds its root with `document.getElementById('root')`. The runtime scopes that lookup to each placed instance; a global `[data-composition-id]` selector is refused, because a component placed twice would find no root.
- `data-composition-variables` is the definition's projection: each scalar `inputSchema` property in schema order, then each manifest slot. `number`/`integer` → `{"id","type":"number","label","default","min","max"}` (min/max from minimum/maximum, omitted when absent); a property with `enum` → `{"type":"enum","default":"<as string>","options":[{"value","label"}]}`; `boolean` → `"boolean"`; a string whose `pattern` admits exactly `#RRGGBB` → `"color"`; any other string → `"string"`; an image slot → `{"id","type":"image","label":"<id>","default":""}`; a video slot → the same with `"type":"string"`. `label` is the property's `title`, else its id; `default` is `definition.defaults[id]`, else the schema default. Any difference is refused as `component_api_mismatch`.
- The script ends with exactly one `__cfScene.mount({ root: document.getElementById('root'), component: Name, variables: __hyperframes.getVariables() })`. `Name({ params, assets, render, durationInFrames })` returns `h(MediaTileScene, { streams, tiles, camera, fog, background })`, taken from `const { h, MediaTileScene, three } = __cfScene`: a description, not React. `render` is `{ frame, fps, width, height, seed }`. `params` holds only the keys the placement's `execution.params` sets, so read every param with its default as a fallback.
- Pass a declared slot as `streams: { hero: { asset: assets.hero } }` and place it with `tiles: [{ stream: 'hero', x, y, width, height }]` (pixels; x/y are the tile centre's offset from the frame centre, y down). Tiles also take `z`, `rotation`, `rotationX`, `rotationY` (degrees), `opacity`, `crop` and `renderOrder`; the camera takes `x`, `y`, `z`, `zoom` and `perspective`. Video streams take `trimBeforeFrames`, `trimAfterFrames`, `playbackRate` and `loop`. Audio belongs on composition audio tracks.
- The template lays out at its declared `data-width` × `data-height`, and the host scales that whole box to the rendered size: DOM beside the scene keeps its place and proportion at every size. The scene draws at the rendered size (`render.width` × `render.height`). A component without media passes `streams: {}` and no tiles; its scene presents its `background`.
- Every frame is a pure function of `render.frame`, `params` and `render.seed`. The script reads only its own declarations, `__cfScene`, `__hyperframes`, `document` and JavaScript built-ins such as `Math` and `JSON`. Timers, `Date`, `requestAnimationFrame`, `fetch`, `eval`, imports, `window` and other globals are refused (`component_v4_nondeterministic`, `component_import_denied`). The template has no `<img>`, `<video>`, `<link>` or `<iframe>`, no external or `data:` URL, and no CSS `transition`, `animation` or `@keyframes`. The template linter runs in sub-composition mode, and its errors refuse the source (`component_v4_lint_failed`).

Example: one image swinging flat over the clip. Its definition and manifest:

```json
{
  "definition": {
    "inputSchema": { "type": "object", "additionalProperties": false, "properties": {
      "background": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$", "default": "#101014" },
      "tilt": { "type": "number", "minimum": 0, "maximum": 60, "default": 35 }
    } },
    "defaults": {}, "brandBindings": [], "timing": { "defaultDuration": { "frames": 90, "fps": 30 } }, "capabilities": [{ "kind": "clip" }]
  },
  "manifest": { "version": 4, "runtime": "hyperframes", "hfContract": 1, "kind": "scene",
    "assets": { "hero": { "kind": "image", "required": true } },
    "graphics": { "api": "webgl2", "required": true, "accelerationPreference": "hardware-preferred" }, "alphaPolicy": "allows-opaque" }
}
```

Its template, with `componentId` `swing-hero`:

```html
<template><div id="root" data-composition-id="swing-hero" data-width="1920" data-height="1080" data-no-timeline data-composition-variables='[{"id":"background","type":"color","label":"background","default":"#101014"},{"id":"tilt","type":"number","label":"tilt","default":35,"min":0,"max":60},{"id":"hero","type":"image","label":"hero","default":""}]'><div data-cf-scene></div></div><script>
const { h, MediaTileScene } = __cfScene;
function SwingHero({ params, assets, render, durationInFrames }) {
  const t = Math.min(1, render.frame / Math.max(1, durationInFrames - 1));
  const ease = 1 - Math.pow(1 - t, 3);
  const tilt = Number.isFinite(params.tilt) ? params.tilt : 35;
  return h(MediaTileScene, {
    streams: { hero: { asset: assets.hero } },
    tiles: [{ stream: 'hero', x: 0, y: 0, width: 1280, height: 720, rotationY: tilt * (1 - ease) }],
    camera: { x: 0, y: 0, z: 0, zoom: 1, perspective: 1200 },
    background: params.background ?? '#101014',
  });
}
__cfScene.mount({ root: document.getElementById('root'), component: SwingHero, variables: __hyperframes.getVariables() });
</script></template>
```

Place a component as a `{kind:'component', componentId, props:{}, execution:{version:4, componentId, sourceVersionId, params, seed, assets:{hero:'<mediaId>'}}, placement:{version:3, kind:'clip'}}` clip. Bind each slot to a project media id in `execution.assets`; a slot never travels in `params`.

