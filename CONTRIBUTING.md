# Contributing

## How to contribute

New here? Browse [good first issues](https://github.com/cueframe-ai/cueframe-mcp/labels/good%20first%20issue). These have a limited scope, named files, and acceptance criteria; they should not require access to private infrastructure or paid cloud operations. Comment on an issue with your proposed approach before starting so maintainers can help avoid duplicate work.

The easiest entry points are documentation, per-client setup examples, and skill guidance. For a skill change, edit root `skills/`, regenerate its cards with `pnpm build:plugin`, and include the generated files. For code changes, start with the Development section below. Hosted server implementation changes happen in the application repository; this repository accepts reports and public toolkit fixes.

Reports, ideas, documentation fixes and code pull requests are welcome. Open a GitHub issue with a bug report, a feature request or a correction, or open a focused pull request when you have a proposed fix.

A great issue includes:

- **Bug:** the exact command, SDK call or MCP tool call, what you expected, what happened, and the `x-request-id` from the response if you have one.
- **Doc fix:** the file, the sentence that is wrong, and what it should say.
- **Feature:** what you are trying to make your agent do, and where the current surface stops you.

Issues about the hosted API itself are welcome too; this is the public tracker for the whole developer surface.

## Two kinds of paths in this repository

- **Authored source.** The skills (`skills/<name>/SKILL.md` and their `references/`), the plugin manifests, the session router (`hooks/session-inject.md`), the SDK's hand-written files (`client.ts`, `errors.ts`, `sse.ts`), the CLI, the discovery shim in `glama/server.mjs`, the tools under `tools/` and `scripts/`, and the documentation are reviewed and changed here. The MCP server (`@cueframe/mcp`) is a private package in the application repository; report server behaviour as an issue here, but its code is not in this tree.
- **Generated or synchronized output.** Do not edit these by hand. Change the listed input, run the generator, and commit the result.

### Generated and synchronized paths

| Path | Source / action |
| --- | --- |
| `api/openapi.json`, `api/scene-schema.json`, `api/scene-examples.json`, `api/contract-manifest.json` | Written by the private API's contract sync. `pnpm check:api-inputs` fails when the three inputs do not hash to the manifest. Nothing here is edited in this repository; a contract change starts in the API. |
| `api/public-surface.json` | The reviewed operation inventory. `pnpm check:openapi-public` fails when `api/openapi.json` adds or removes an operation that the inventory does not list. |
| `packages/sdk/src/generated/**` | Generated from `api/openapi.json` by Orval (`pnpm generate:sdk`). Do not hand-edit; update the contract and regenerate the SDK. The tarball ships only `dist/`: the zod sources are not published (they are inside `dist/zod.js.map` as `sourcesContent`), and `@cueframe/sdk/zod` exports every `<operationId>Body` schema under its camelCase name, which is what the application repository's MCP generator and server key on; `scripts/pack-install-smoke.mjs` asserts that set. |
| `api/openapi.json` → `#/components/schemas/SceneShotSpecV2` | `api/scene-schema.json`, vendored into named, depth-capped OpenAPI components with canonical references and an agent-facing description by `tools/vendor-scene-schema.mjs`; the SDK's `sceneShotSpecV2*` models are generated from them. Regenerate whenever the scene contract moves. |
| `packages/api-contract/dist/**` | Built from `api/` by `packages/api-contract/scripts/build.mjs`: the five `api/*.json` files (the vendored `openapi.json`; the build refuses the sync's un-vendored form) plus `manifest.json` and the digest exports. The build stamps `contractVersion`, the package's own version, into `contract-manifest.json`, `manifest.json` and the index. `pnpm check:contract-version` fails when any `api/*.json` changed since the baseline commit (the PR base in CI; `HEAD~1`, or `HEAD` for uncommitted changes, on `main`; the merge-base with `origin/main` on a branch) and `packages/api-contract/package.json` did not move: every consumer reads the contract from the npm package, so a contract change is a version. |
| `glama/tools.json`, `glama/instructions.txt` | A snapshot of the hosted MCP server's `tools/list` and `initialize` instructions, exported by the server package's introspection mode in the application repository; `glama/refresh-snapshot.md` has the procedure. The `source` header records the `@cueframe/mcp` version and commit. Do not hand-edit. |
| `skills/<name>/agents/openai.yaml`, `skills/<name>/assets/icon.svg` | The per-skill ChatGPT/Codex card and its icon, generated from the skill's frontmatter and `assets/icon.svg` by `scripts/plugin/sync-openai-yaml.mjs` (`pnpm build:plugin`, part of `pnpm build`). `pnpm check:plugin` fails a stale card. |
| `version` in `plugin.json`, `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `gemini-extension.json` | Stamped from `packages/skills/package.json` by `scripts/plugin/sync-versions.mjs` (`pnpm build:plugin`): the plugin and the `@cueframe/skills` package carry one version. Bump it there only. |
| `packages/skills/dist/skills/**` | A copy of root `skills/` made by `packages/skills/scripts/build.mjs`; the package's `check` fails when the copy differs from the source. Nothing is filtered: consumers that install into hosts other than ChatGPT/Codex drop `agents/openai.yaml` and `assets/icon.svg` themselves. |
| `packages/cli/dist/skills/**` | Copied at build time from the workspace `@cueframe/skills` package (`packages/skills/dist/skills`, minus the two OpenAI-directory files) by `packages/cli/scripts/copy-agent-skills.mjs`. Skills are edited in root `skills/` and nowhere else. |

`pnpm generate:api-consumers` runs every generator in order; `pnpm check:api-consumer-drift` runs it and fails when the committed output differs. `pnpm build:plugin` runs the plugin's two generators; CI fails when their output is not committed.

## The skill contract

Each skill is a directory under `skills/` whose name is the skill name. `SKILL.md` must start with YAML frontmatter and then a title:

- `name` in the frontmatter equals the folder name.
- `description` is a non-empty string; it is what agents read to decide when to load the skill, so lead with the trigger phrases.
- The first heading after the frontmatter is a `# ` title; the generator uses it as the card's display name.
- Optional `defaultPrompt`: the text after "Use $<name> to" on the ChatGPT card. Without it the generator uses the first sentence of the description.
- Files use LF line endings (`.gitattributes` enforces this) and stay under 1 MiB.
- Other skills are referred to by name only when that skill exists in `skills/`.
- Calls to the CLI are written `npx -y cueframe@<version>` with the version in `scripts/plugin/cli-version.json`.

`pnpm check:plugin` (part of `pnpm check`) enforces all of this, checks that the host manifests agree with each other and point at the hosted server, and runs the session-start hook; CI also runs Claude Code's own `claude plugin validate --strict` on the marketplace manifest, the plugin manifest and `skills/`. After editing a skill run `pnpm build:plugin && pnpm check:plugin` and commit the regenerated `agents/openai.yaml` with it.

## Development

Use **pnpm** and **Node 24 or newer** (see `.nvmrc`). The repository is a pnpm workspace; run the commands below from its root. Internal dependencies use the `workspace:` protocol, so a clean clone installs and builds against local source.

```bash
pnpm install
pnpm check      # input provenance, the contract version rule, the public-contract gate, server.json, the plugin, and tsc --noEmit in sdk and cli
pnpm build      # the plugin generators, then tsup in every package; the CLI also packages the skills and proves its bundle is kernel-free
pnpm test       # vitest in every package plus the node:test suites under tools/ and scripts/; hermetic, no network
```

Run them in that order on a fresh clone: the CLI's tests read the skills from `packages/skills/dist`, which `pnpm check` (or `pnpm build`) creates.

The private contract sync only warns when it rewrites `api/*.json` under an un-bumped `packages/api-contract` version; the rule itself is `pnpm check:contract-version`. Until the organisation's GitHub Actions run, running `pnpm check` locally before a contract commit is the only place that rule is enforced.

Per-package loops work too: `pnpm --filter @cueframe/sdk test`.

## Security

Please do not open public issues for security reports; mail security@cueframe.ai. Read [SECURITY.md](SECURITY.md) before testing or reporting a potential vulnerability.

## Community expectations

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Licensing of contributions

This project is [Apache-2.0](LICENSE), and contributions come in under the same license they go out under: by contributing (including issue text), you license your contribution under Apache-2.0. There is no contributor license agreement and no copyright assignment; you keep the copyright in your work.

**Sign off every commit.** Each commit needs a `Signed-off-by: Your Name <you@example.com>` line, which `git commit -s` adds. It certifies the [Developer Certificate of Origin](https://developercertificate.org/): that you wrote the change or otherwise have the right to submit it under the project's license. Pull requests with unsigned commits are not merged.

**Third-party code** copied or vendored into the repository, and new npm dependencies, must be under MIT, BSD-2-Clause, BSD-3-Clause, ISC, Apache-2.0, Zlib, CC0-1.0, Unlicense or 0BSD. LGPL, GPL-3.0 and AGPL-3.0 code needs maintainer approval recorded in the pull request. GPL-2.0-only, non-commercial or source-available licenses (FSL, BUSL, the Commons Clause, CC-BY-NC) and unlicensed code are refused.
