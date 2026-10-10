# Plugin release artifacts

Author skills only in root `skills/`. `packages/skills/package.json` owns the version. Build the canonical cards and manifests with `pnpm build:plugin` before packaging.

For the OpenAI submission, run `pnpm build:plugin:openai`, then `pnpm check:plugin:openai`. This generates `dist/plugins/openai/` directly from an explicit list of canonical source files: portable and compatibility manifests, portable MCP configuration, skills including their references/cards/icons, listing image, license and NOTICE. `release-manifest.json` records source HEAD, `sourceDirty`, version and SHA-256 of every included source file. `sourceDirty` includes tracked and untracked repository changes; ignored build output does not affect it. Hashes identify working-tree contents, including uncommitted changes; HEAD alone does not identify the packaged bytes. A reviewed release should have `sourceDirty: false`; dirty artifacts remain useful for local installation smoke checks.

The OpenAI artifact intentionally omits all Claude lifecycle hooks. The source repository retains `hooks/` for Claude. An empty hooks setting alone does not make a repository ZIP suitable for submission. The checker rejects hook/app declarations, hook files, extra/missing/stale files, invalid MCP transport, and unresolved relative Markdown links. Generate into a fresh directory if the allowlist changes; unexpected existing files fail closed.

Create a ZIP with the artifact contents at the ZIP root:

```sh
cd dist/plugins/openai
zip -r ../cueframe-openai.zip .
```

Run `pnpm check`, `pnpm build`, then `pnpm test` on the exact release revision, regenerate/check the artifact, and record the ZIP checksum. Packaging is preparation, not publication or directory approval. The submission portal still requires identity/domain verification, reviewer access, positive/negative test cases and a demo. Do not submit the entire checkout or its Claude hooks to OpenAI.

Host formats verified 2026-10-08: [OpenAI Package your plugin](https://developers.openai.com/plugins/build/plugins), [OpenAI Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission), and [Claude Plugin manifest reference](https://code.claude.com/docs/en/plugins-reference). Portable `mcp.json` uses the Agent Plugins schema and `streamable-http`; Claude `.mcp.json` uses `http`.

Clean local Codex installation was exercised with an isolated `CODEX_HOME` and a temporary local marketplace pointing at the generated artifact, then repeated with root `plugin.json` removed to exercise `.codex-plugin/plugin.json` fallback. Final merged-tree checks installed version 0.1.2 and all 18 skills; no hooks were packaged. This verifies installation/file resolution, not model behavior, OAuth or portal eligibility. Claude Code 2.1.292 strict manifest validation passed. Cursor was unavailable; Gemini and fresh OAuth plus authenticated edit/preview/export remain release acceptance work. The already connected purpose-built CueFrame MCP `get_account` call succeeded on a Free account. Anonymous production `initialize` returned HTTP 401 with the OAuth protected-resource metadata challenge; anonymous tool discovery is unavailable. This existing connection does not verify OAuth from a freshly installed plugin. No metered operation was performed.

Read-only production connector checks on 2026-10-08 succeeded for `list_projects` (20 returned), `list_compositions` (2 returned for one project), `get_composition`, and `describe_composition_ops`. A composition request missing the required project identifier returned a tool error. No project content or identifiers are recorded here, and no edit, render, preview or export was requested. These checks exercise the existing authenticated connector, not authentication from a clean host install.
