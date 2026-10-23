# Sound and timing

Choose timing from the material: speech phrasing, musical structure, product action, physical causality or deliberate silence. They may interact; a film does not need every cut on a beat. Record the events that matter so a visual revision can also revisit its dependent sounds.

Use existing audio first when it fits the request. `list_catalog` exposes the current audio palette with roles, duration, provenance and licensing. Import an exact curated SFX/music entry through `import_resource`, or use the supported search/generation capability when the palette cannot meet the brief. Keep attribution and distinguish a reused mix from newly composed sound. `add-music-bed` covers the existing-edit recipe.

Set audio roles intentionally. Speech, music, SFX and ambience have different mix behavior; use authored levels to make an intentional change to the engine's default staging. Read the current schema for gain, ducking, fades and anchors rather than copying guessed fields. A role declaration or envelope analysis does not prove a sound suits the scene.

For speech-led editing, derive captions from the saved edited composition after trims, exclusions, playback-rate and placement changes. Transcript times refer to the source; output captions refer to the edited timeline. `captions.fromComposition` handles this mapping. Do not apply the simple source-minus-trim formula to excluded or retimed media.

When using detected rhythm, inspect the source's actual grid and confidence through `get_media_context`. `materializeGrid` projects the supported beat or word grid through the clip's edits into timeline markers. Refresh those markers after changing the authority clip's timing. A grid's existence is not a requirement to quantize every cut or accent.

Tie meaningful sound accents to their visible cause. A click follows pointer contact; a reveal may resolve a rising sound; room tone can bridge a cut. Use supported clip anchors where appropriate, and reread their behavior before retiming. Reusing the same audio bytes after a picture edit proves preservation, not continued synchronization.

For review, distinguish three observations: numerical properties such as peak/loudness; visible waveform or event alignment; actual listening for intelligibility, texture, balance and transitions. Report which occurred. Listen across changed events and transitions when the host supports it; if listening is unavailable, do not describe the mix as approved by ear.
