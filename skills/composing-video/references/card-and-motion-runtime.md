# Card tokens and the motion runtime

Defaults, examples and detail for this topic. The [skill](../SKILL.md) and the [project and capability policy](project-policy.md) take precedence where they differ, and the current tool schemas are authoritative.

### The card token contract — `tokens` key `x` is read as `var(--cf-x)`

A `{kind:'card', html, tokens}` clip binds brand-swappable values through `tokens`. Each
**key** is projected onto the card's wrapper as a CSS custom property with a `--cf-`
prefix, so the html reads it back **prefixed**:

```jsonc
{ "kind": "card", "tokens": { "plate": "#0af", "fg": "$brand:colors.text" },
  "html": "<div style=\"background:var(--cf-plate);color:var(--cf-fg)\">…</div>" }
```

Values may be literals or whole-string `$brand:<path>` refs (resolved against the
project's brand kit at render).

**Do not put dashes in the key.** `tokens: {"--plate": …}` projects to `--cf---plate`, so
the card's `var(--plate)` matches nothing — and CSS treats an undefined custom property as
*invalid at computed-value time*, which means it does not error, it **degrades**:
`background` falls back to transparent and `color` inherits (usually black). The render
succeeds and the graphic is unreadable. `apply_composition` returns `warnings[]` when it
catches this, but the fix is to never write the dashes.

Two `--cf-*` families share the wrapper: **your token vars** (above) and the **motion
vars** below, which are always injected and are not yours to declare.

### The motion runtime — three ways anything you author can move

CSS `@keyframes`/`transition` **never animate in a render** (frames are independent
Chromium captures; the clock never advances). Use these instead:

1. **Card motion vars (`--cf-*`)** — every card's wrapper carries frame-driven, unitless
   custom properties: `--cf-progress` (0→1 across the clip), `--cf-ease` (eased progress),
   `--cf-enter` (0→1 over the first 18 frames), `--cf-exit` (1→0 over the last 18 frames), plus
   `--cf-frame` / `--cf-t` / `--cf-fps` / `--cf-duration`. Author motion directly in card
   CSS: `opacity: var(--cf-enter)`, `transform: translateY(calc((1 - var(--cf-enter)) * 40px))`,
   an exit slide via `--cf-exit`. This supports entrance/exit choreography within the
   card medium — and a `preview_frame` still at time *t* shows the exact *t*-frozen state.
2. **`transitionIn` on any overlay clip** — `{ transitionIn: { type: "fade", duration: 0.4 } }`
   now applies to overlay-family clips (cards, components, primitives), not just video.
   Use it for entrances; author exits in-card via `--cf-exit`.
3. **`clip.setKeyframes` op** — animate the whole clip on one channel:
   `{ type: "clip.setKeyframes", clipId, property, keyframes: [{ time, value, ease? }, …] }`
   for `opacity`, `scale`, `rotation`, `position.x`, `position.y` or `volume` (times in seconds from the
   clip's start). For motion beyond that, author a native component with `create_component`.

---
