---
name: cueframe-scene-shot
description: Author a CueFrame 3D world-object shot as canonical SceneShotSpecV2 JSON. Use for slabs, pages, phones, laptops, captured component or video surfaces, world text, camera motion, studio lighting, focus, and product-shot recipes.
---

# CueFrame scene shots

Use the [project and capability policy](../composing-video/references/project-policy.md) for scope, current state and metered work.

Use `scene.add` and `scene.update` through `apply_composition`. Author the scene JSON; CueFrame owns the generated wrapper, preparation, resource admission, previews, and export.

Before authoring, read `cueframe://scene-shot`. It serves the canonical generated `SceneShotSpecV2` schema, exact operation contracts, supported brand tokens, refusal rules, and a copyable nested slab-and-page recipe. Do not infer fields from an older example.

On the CueFrame desktop app that resource is unreachable — its MCP surface is tools-only and no `cueframe://` URI resolves there. Call the `get_scene_contract` tool instead: same document, served in sections (`essentials` by default, then `rules` and `schema`).

## Workflow

Use `cueframe-compose-loop`'s [preview workflow](../cueframe-compose-loop/references/preview-workflow.md)
for the available hosted/local lane. Inspect affected camera/focus/entrance windows in motion,
not only keyframes. A scene tweak can finish with preview evidence; export for final delivery.

1. Create or open a composition at the target aspect and FPS.
2. Register every image or video source. Capture-backed component surfaces use an exact component id, source version id, capture frame, layout, and optional bake scale.
3. Read `cueframe://scene-shot` (desktop: `get_scene_contract`), copy its `world-objects` recipe, and replace placeholder ids and copy.
4. Send `apply_composition` with `dry_run: true`. Fix the exact reported field path.
5. Apply the same batch for real. Preview the first frame, object entrances, focus transitions, and the last frame.
6. Revise with `scene.update`; do not hand-edit a generated wrapper.
7. Render only after surfaces report ready and the previews show the intended pixels.

## Ownership boundaries

The composition owns clip start, duration, ordering, cuts, and transitions. The scene owns objects, camera, environment, backdrop, post effects, constraints, and normalized animation. Scene clips occupy a dedicated full-frame front overlay track. Outer region, position, scale, rotation, fit, clip effects, and internal fades are refused because they would create two transform or timing owners.

`referenceSize` must have the same aspect ratio as the composition. World coordinates are reference pixels with origin at frame center, +X right, +Y up, and +Z toward the default viewer. World rotations use radians in Euler XYZ order; laptop `openAngle` uses radians in [0, PI]. Equal-aspect outputs scale uniformly.

Animation keyframe `at` is normalized over clip duration. Easing belongs to the keyframe it arrives at. The first keyframe has no easing; each later keyframe supplies `linear`, `hold`, or cubic `bezier` easing. Topology, bindings, text content, fonts, material roles, and object kind remain static within a shot.

## Objects and surfaces

V2 supports nested `group` layers and canonical `slab`, `page`, `phone`, `laptop`, and `text` layers. Use each object's declared surface slot:

- `source: "image"` binds an admitted PNG, JPEG, or WebP through the outer `assets` map.
- `source: "component"` captures an immutable component source at the declared frame and layout. Omitted `bakeScale` lets preparation select 2× or 3×; an explicit insufficient scale refuses.
- `source: "video"` binds an admitted media id with frame-addressed start/end facts. Video decoding and committed-frame readiness are sealed before drawing.
- `source: "color"` supplies an unlit solid surface.

Never insert a URL, raw HTML, shader source, or placeholder art into a surface. Every required slot must resolve before capture. UI surfaces and world text are unlit and color-managed; bodies use declared physical material roles. Invisible objects do not write depth.

World text participates in camera, depth, occlusion, and focus. Screen text stays fixed above the world result. Both are line-authored with no automatic reflow. Every exact font family, weight, and style used by base or emphasized runs must be admitted.

## Lighting and post

Choose the generated studio environment for named studio profiles or `{kind:"photographic-studio-v1"}` for the fixed photographic recipe. Arbitrary HDR fields are refused. Backdrops may be transparent, solid, linear, or radial. Focus is per-pixel world depth; sample the actual object face rather than its layer origin when choosing distance and range.

Brand tokens are allowed only in schema-declared color and font-family fields. Read the token enums from the resource. A font token resolves the family only; authored weight and style still require exact admitted bytes.

## Limits and refusals

The contract admits at most 32 layers, 4 devices, 16 distinct image slots, 256 keyframes per channel, and 2048 keyframes per shot. Raw HTML, custom shader properties, imported GLB models, arbitrary external HDR environments, skeletal animation, and physics are unsupported. Unknown keys, duplicate ids, missing bindings, non-finite values, aspect mismatch, budget overflow, and unsupported capabilities fail with a named code and exact path.

Composition-level global wrap effects do not reach front-overlay scene clips. Author grain, vignette, focus, backdrop, and environment inside the scene.

## Delivery checks

- The rendered subject is a real object with a real admitted surface.
- Every key entrance, reflection sweep, screen update, and focus transition was previewed.
- Device and slab bodies receive the intended light while UI colors remain unchanged.
- Text uses the intended admitted face and remains legible.
- The output aspect matches the authored reference aspect.
- The final response identifies the composition, render, source provenance, and any intentional unsupported boundary.
