# CueFrame tool reference

Generated from the @cueframe/mcp 0.13.0 catalog (commit eb1b03358). Do not edit it by hand.

Every CueFrame tool by its catalog name. A host may show it with a connection prefix (`mcp__cueframe__get_account`, `cueframe-read__get_account`); the name after the last `__` is the catalog name. **read** tools change no state, though some are metered; **write** tools change state, and a composition write takes the revision it edits.

Hosted surfaces: `api` is the MCP server at `https://api.cueframe.ai/v1/mcp`; `editor` and `compose` are the hosted Director's editor and compose sessions. Desktop surfaces: `director` is the desktop app's agent, `plan` its planning mode, `external` an outside MCP client connected to the desktop app, and `cli` the Director running as a CLI agent such as Claude Code. A tool is callable only on the surfaces listed for it; list your host's tools for what this connection serves.

| Tool | Access | Hosted | Desktop |
| --- | --- | --- | --- |
| `analyze_transcript` | read | editor, compose | director, plan, external, cli |
| `apply_composition` | write | api, editor, compose | director, external, cli |
| `apply_template` | write | api, editor | director, external, cli |
| `cancel_compose` | write | api | - |
| `cancel_export` | write | api | - |
| `cancel_job` | write | api | - |
| `cancel_render` | write | api | - |
| `check_template` | read | - | director, plan, external, cli |
| `close_component_preview` | write | - | director, plan, external, cli |
| `close_project` | write | - | external |
| `commit_component_preview` | write | - | director, external, cli |
| `compare_frames` | read | api, editor, compose | director, plan, external, cli |
| `compose` | write | api | - |
| `consult` | write | api | - |
| `create_brand_kit` | write | api | - |
| `create_brief` | write | api | - |
| `create_checkout` | write | api | - |
| `create_component` | write | api, editor, compose | director, external, cli |
| `create_project` | write | api | external |
| `create_render` | write | api, editor, compose | director, external, cli |
| `create_upload` | write | api | - |
| `create_webhook` | write | api | - |
| `delete_brief` | write | api | - |
| `delete_composition` | write | api | - |
| `delete_critic` | write | api | - |
| `delete_media` | write | api | - |
| `delete_project` | write | api | external |
| `delete_webhook` | write | api | - |
| `derive_composition` | write | api, editor, compose | director, external, cli |
| `describe_composition_ops` | read | api, editor, compose | director, plan, external, cli |
| `download_media` | read | api | - |
| `edit_component` | write | - | director, external, cli |
| `editorial_apply` | write | api, editor, compose | director, cli |
| `editorial_begin` | write | - | director, cli |
| `editorial_create_brief` | write | api, editor, compose | - |
| `editorial_create_run` | write | api, editor, compose | - |
| `editorial_findings_append` | write | api, editor, compose | director, cli |
| `editorial_findings_list` | read | api, editor, compose | director, plan, cli |
| `editorial_get_run` | read | api, editor, compose | director, plan, cli |
| `editorial_inspect_audio` | write | api, editor, compose | director, cli |
| `editorial_inspect_source` | write | api, editor, compose | director, cli |
| `editorial_inspect_transcript` | write | api, editor, compose | director, cli |
| `editorial_integrate` | write | api, editor, compose | director, cli |
| `editorial_list_briefs` | read | api, editor, compose | director, plan, cli |
| `editorial_list_evidence` | read | api, editor, compose | director, plan, cli |
| `editorial_list_runs` | read | api, editor, compose | director, plan, cli |
| `editorial_run_source` | read | api, editor, compose | director, plan, external, cli |
| `editorial_sample_motion` | write | api, editor, compose | director, cli |
| `export_project` | write | - | external |
| `extract_brand_kit` | write | api | - |
| `finalize_upload` | write | api | - |
| `forget_taste` | write | api, editor, compose | director, external, cli |
| `generate_media` | write | api, editor, compose | director, external, cli |
| `get_account` | read | api, editor, compose | director, plan, external, cli |
| `get_app_state` | read | - | director, plan, external, cli |
| `get_brief` | read | api | - |
| `get_checkpoint` | read | api | - |
| `get_component_source` | read | api, editor, compose | director, plan, external, cli |
| `get_composition` | read | api, editor, compose | director, plan, external, cli |
| `get_context` | read | editor, compose | director, plan, external, cli |
| `get_director_state` | read | - | external |
| `get_editor_state` | read | - | director, plan, external, cli |
| `get_import_status` | read | - | director, plan, external, cli |
| `get_media_context` | read | api, editor, compose | director, plan, external, cli |
| `get_media_facts` | read | api | director, plan, external, cli |
| `get_profile` | read | api, editor, compose | director, plan, external, cli |
| `get_project_settings` | read | - | external |
| `get_render` | read | api | - |
| `get_scene_contract` | read | - | director, plan, external, cli |
| `get_template` | read | api, editor | director, plan, external, cli |
| `get_transcript` | read | api, editor, compose | director, plan, external, cli |
| `get_usage` | read | api, editor, compose | director, plan, external, cli |
| `import_local_media` | write | - | director, external, cli |
| `import_media` | write | api, editor, compose | director, external, cli |
| `import_resource` | write | api, editor, compose | director, external, cli |
| `install_local_person_runtime` | write | - | director, external, cli |
| `list_briefs` | read | api | - |
| `list_catalog` | read | api, editor, compose | director, plan, external, cli |
| `list_checkpoints` | read | api | - |
| `list_component_packages` | read | - | external |
| `list_compositions` | read | api | - |
| `list_critics` | read | api | - |
| `list_media` | read | api, editor, compose | director, plan, external, cli |
| `list_plans` | read | api | - |
| `list_projects` | read | api | external |
| `list_render_fonts` | read | api | director, plan, external, cli |
| `list_taste` | read | api, editor, compose | director, plan, external, cli |
| `list_templates` | read | api, editor | director, plan, external, cli |
| `new_composition` | write | api, editor, compose | director, external, cli |
| `open_component_preview` | write | - | director, plan, external, cli |
| `open_project` | write | - | external |
| `play_pause` | write | - | director, plan, external, cli |
| `prepare_component_library_previews` | write | - | external |
| `prepare_component_media` | read | - | external |
| `prepare_media` | write | api | director, external, cli |
| `preview_card` | read | api, editor, compose | - |
| `preview_clip` | write | api | - |
| `preview_component` | read | api | - |
| `preview_frame` | read | api, editor, compose | director, plan, external, cli |
| `propose_plan` | write | - | director, plan, cli |
| `publish_component` | write | - | external |
| `read_component` | read | - | director, plan, external, cli |
| `redo_edit` | write | - | external |
| `refresh_render_url` | write | api | - |
| `register_critic` | write | api | - |
| `remember_taste` | write | api, editor, compose | director, external, cli |
| `rename_project` | write | - | external |
| `render_component_preview_frame` | read | - | director, plan, external, cli |
| `repin_component` | write | api | director, external, cli |
| `resolve_builtin_component` | read | api | - |
| `resume` | write | api | - |
| `retry_render` | write | api | - |
| `save_as_template` | write | - | director, external, cli |
| `score_composition` | write | api, editor, compose | director, external, cli |
| `search_fonts` | read | api, editor, compose | director, plan, external, cli |
| `search_library` | read | editor, compose | director, plan, external, cli |
| `search_resources` | read | api, editor, compose | director, plan, external, cli |
| `seek` | write | - | director, plan, external, cli |
| `select_candidate` | write | api | - |
| `send_director_prompt` | write | - | external |
| `set_playback_rate` | write | - | director, plan, external, cli |
| `start_template` | write | api, editor | - |
| `submit_plan` | write | - | director, plan, cli |
| `suggest_briefs` | write | api | - |
| `undo_edit` | write | - | external |
| `update_brief` | write | api | - |
| `update_component` | write | api | - |
| `update_component_preview` | write | - | director, plan, external, cli |
| `update_project` | write | api | - |
| `update_project_settings` | write | - | external |
| `update_webhook` | write | api | - |
| `validate_composition` | read | api, editor, compose | director, plan, external, cli |
| `verify_webhook` | write | api | - |
| `view_asset` | read | - | director, plan, external, cli |
| `view_style_reference` | read | compose | - |
| `wait_job` | read | api, editor, compose | director, plan, external, cli |
