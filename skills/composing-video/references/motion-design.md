# Motion as connected action

For a supplied film, measure its actual action before choosing an animation recipe. For original work, identify what changes and what that change means. A pointer pressing a control, a word becoming an object and a camera discovering a space have different motion requirements.

## Object identity and space

Decide what belongs to an object and what belongs to the world. A phone's bezel, screen, text and buttons normally share one parent pose and clipping surface. A floating payment card may become an independent object during a deliberate handoff; preserve its projected size, contact point and direction at that handoff. Unrelated rotations on each layer can match an endpoint but shear the object in motion.

Use flex/grid for readable UI cells and text flow. Use coordinates and nested transforms for spatial choreography. Use the scene-shot contract when actual camera, depth, lighting or occlusion matters. Neither layout method is a universal substitute for the other. Evaluate perspective using the screen's projected corners and edge directions, not just an attractive tilt angle.

Preserve the silhouette, material and motion vocabulary across shots. A glossy card needs a consistent face, edge and reflected light; adding an arbitrary gradient is not evidence of the reference material. A pointer's tip is the contact landmark. Keep the cursor body and shadow consistent, ease into the intended target, and align its press with the resulting state change.

## Timing that remains editable

Name meaningful local events such as arrival, contact, response, readable hold and departure. Derive related motion from those values and one seekable clock. Use seconds for absolute events; normalized progress is useful when the whole gesture should stretch with its clip. Preserve frame rate and the production duration when previewing duration-dependent motion.

Separate travel, settling and reading time. A clip lasting two seconds may give its text only two frames at rest. Hold begins when the essential geometry and text are stable and legible, not when the layer first exists. Deliberate continuous motion or overlap can be appropriate; judge what the audience must perceive.

At a transition, compare the outgoing and incoming object at the same time: projected bounds, direction, velocity, opacity, occlusion and background continuity. An abrupt cut may be intended. If continuity is intended, a matched pose followed by a velocity jump still breaks it. Inspect the interval on both sides of the boundary.

## Choose the smallest useful representation

Cards suit authored 2D type/UI with frame-driven CSS; clip keyframes suit a whole-layer move. A native component suits richer internal behavior and explicit reusable inputs. Scene shots suit the supported 3D world. Keep one owner for a transform: do not rotate an already camera-projected scene again in its placement.

The [parented card recipe](../../cueframe-component-authoring/references/parented-motion.md) demonstrates shared geometry, a named contact time and deterministic evaluation in the card runtime. It is a technique example, not a prescribed visual style or a substitute for the reference's choreography.
