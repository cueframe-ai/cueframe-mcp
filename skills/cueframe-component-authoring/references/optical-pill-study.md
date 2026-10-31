# Optical pill: experimental canonical scene study

Use [the complete scene](optical-pill-study.scene.json) as a SceneShotSpecV2 document through the supported `scene.add` / `scene.update` operations in `apply_composition`. Read the installed scene contract first and dry-run the complete operation against the current project revision. This is a two-second, 1280×720, 30 fps engineering study, not a native v4 component or a certified recreation of a reference film.

The scene combines three existing owners: an opaque bounded shader mesh behind the subject, a physical rounded transmission slab, and canonical screen text. CueFrame owns preparation, shader admission, transmission sampling, font resolution and the clip-local clock. Do not replace these with a custom wrapper, SVG filter, browser clock or external texture. The field is six deterministic unrolled filaments; it has no samplers or external assets.

## Bounded input controls

These are conservative study ranges, not additional API guarantees. Keep all values finite and validate every complete document. Change only the listed paths; preserve geometry, shader source, profile, ids and font facts.

| Control | Exact owner | Study range |
| --- | --- | --- |
| Field position | `field.shader.uniforms.fieldOffset.value` | Each coordinate −0.2 to 0.2 in UV space |
| Field color | `field.shader.uniforms.tint.value` | Three display-linear channels, each 0 to 1 |
| Filament spacing / variation | `spread.value` / `variation.value` under field uniforms | 0.008–0.035 / 0–0.02 |
| Deterministic distribution | `filamentSeed.value` | Integer 0–32; no random or wall-time input |
| Core / glow width | `coreWidth.value` / `falloff.value` | 0.001–0.008 / 0.02–0.08; never zero |
| Core / glow intensity | `coreIntensity.value` / `fieldIntensity.value` | 0–0.8 / 0–0.05 |
| Field clock | `clockRate.value` / `phase.value` | 0–2 / −3.141593 to 3.141593 |
| Pill position / orientation | `pill.transform.position` / `rotation` | X ±180, Y ±80, Z 0–60; each Euler angle ±0.3 radians |
| Pill optics | body material `roughness` / `ior` | 0.08–0.3 / 1.3–1.6; preserve transmission 1 and thickness 60 |
| Type | title run text / `fontSize` / `color` | One short line, size 24–40, canonical color; verify actual glyph bounds |

Field position and pill pose are independent. The physical slab samples the scene field through the existing transmission owner; there is no hidden pill-following uniform. Keep the pill fixed for the field-only comparison, then keep field uniforms fixed for the pill-only comparison. Do not describe either as demonstrated until received frames show it.

## Two input records and clock checks

Input A is the packaged JSON. Input B changes fieldOffset to `[0.08,-0.04]`, tint to `[0.72,0.18,0.08]`, spread to `0.024`, variation to `0.012`, filamentSeed to `13`, phase to `0.4`, pill position to `[80,0,0]`, and title to `LIGHT / SHIFT`. Other fields stay exact. First test the field-only and pill-only changes independently, then the combined B input. Read back the saved canonical document, undo/redo the scoped change, reopen and compare the retained owners.

For each admitted input request clip-local frames 15, 45, then 15 again (0.5→1.5→0.5 seconds). The two frame-15 results must agree under the same sealed inputs; frame 45 must establish actual visible clock behavior rather than merely a different timestamp. Inspect the pill edge, transmitted field and title at final scale, plus continuous motion and the last valid frame 59. A successful direct shader probe alone is not the combined prepared scene or the normal product route.

## Source, font and rights closure

The scene/shader are original Apache-2.0 study source under this repository license. There are no private images, imported models, HDR files, remote media or texture samplers. The photographic environment is the maintained generated recipe. Text requests Inter 400 normal: the maintained render-entry font is `inter-400.woff2`, 48,432 bytes, SHA-256 `c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4`. Its separate license is OFL-1.1, Inter Project Authors (2020); preserve the owning `public/fonts/FONT_LICENSES.md` notice with a portable delivery. A family name is not proof of resolved font bytes: retain the actual preparation/font witness and glyph result on the selected route.

## Evidence boundary

The complete document passes the installed canonical parser and the existing production Node scene preparation owner seals the combined shader/slab/text plan. That local preparation is not a mounted GPU or normal-product route verdict. Exact runtime font resolution, normal-product A/B preview/export, received pixels, successor reuse and creative fidelity remain pending until recorded against an exact installed candidate. This source does not certify optical equivalence to a ring/phone reference. Keep the creative fidelity verdict experimental and post-freeze; do not infer it from parser admission, a generic transmission test or a guide read.
