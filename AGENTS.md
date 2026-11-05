# cueframe-mcp

This repository is the public home of [CueFrame](https://cueframe.ai)'s agent surface: the plugin that installs CueFrame's agent skills and the hosted MCP server into Claude Code, Codex and ChatGPT, Cursor, Gemini CLI and any Agent Skills client; the developer toolkit (a pnpm workspace with four published packages); and the registry files. CueFrame is a hosted service that composes, edits and renders video for agents.

- `skills/<name>/SKILL.md`: one skill per directory (frontmatter `name` and `description`, then the skill; optional `references/`). The manifests at the root and in the dot-directories (`.claude-plugin/`, `.codex-plugin/`, `.agents/plugins/`, `.cursor-plugin/`, `plugin.json`, `gemini-extension.json`, `skills.sh.json`, `.mcp.json`, `mcp.json`) are one plugin tree that every host reads; `hooks/` is the Claude Code session router and `rules/cueframe.mdc` the same text for Cursor.
- `packages/api-contract` (`@cueframe/api-contract`): the public OpenAPI document, its reviewed operation inventory and a content-addressed manifest, built from `api/`.
- `packages/sdk` (`@cueframe/sdk`): the typed TypeScript client. `src/generated/` is Orval output; `client.ts`, `errors.ts` and `sse.ts` are hand-written.
- `packages/skills` (`@cueframe/skills`): the root `skills/` tree as an npm package; `SKILLS_DIR` from `@cueframe/skills/dir` points at its `dist/skills`.
- `packages/cli` (`cueframe`): the command-line client. `cueframe install` writes the agent skills (copied from `@cueframe/skills` at build time) into `~/.agents/skills` and `~/.claude/skills`, and updates detected clients’ MCP configuration.

The MCP server package, `@cueframe/mcp`, is private and lives in the application repository; it is not in this tree. `server.json` is the registry entry for the hosted server, and `glama/` holds a discovery shim (not a workspace member; it has its own `package.json` and lockfile).

## Install, one line per host

- Claude Code: `claude plugin marketplace add cueframe-ai/cueframe-mcp && claude plugin install cueframe@cueframe`
- Codex: `codex plugin marketplace add cueframe-ai/cueframe-mcp && codex plugin add cueframe@cueframe`
- Gemini CLI: `gemini extensions install https://github.com/cueframe-ai/cueframe-mcp`
- Any client that supports Agent Skills: `npx skills add cueframe-ai/cueframe-mcp`
- Any MCP client: `claude mcp add --transport http cueframe https://api.cueframe.ai/v1/mcp` (or the equivalent in your client)
- The CueFrame CLI: `npx -y cueframe@0.12 install`

## If you are an agent pointed at this repository

Read `llms-install.md` to connect the `cueframe` MCP server, then load the skill the router names. The router is `hooks/session-inject.md` (Claude Code injects it at session start; Cursor reads the same text from `rules/cueframe.mdc`). It maps the task to a skill: a supplied reference uses `cueframe-reference-video`; a new video without structure starts with `cueframe-storyboard` then `composing-video`; clipping long footage is `clip-a-talking-head`; not connected yet is `cueframe-connect`. Call `get_account` before any metered call.

## Where the contract comes from

The private CueFrame API publishes its OpenAPI projection into `api/` (`openapi.json`, `scene-schema.json`, `scene-examples.json`, `contract-manifest.json`). Everything under `api/` and under any `generated/` directory is derived: never hand-edit it. A contract change starts in the API; this repository then runs `pnpm generate:api-consumers` and commits the result. `pnpm check:api-inputs` proves the three inputs hash to the manifest; `pnpm check:api-consumer-drift` proves the generated trees match them. Consumers outside this repository read the contract from the `@cueframe/api-contract` npm package, never from a second copy of `api/`, so any change to `api/*.json` is a new version of `packages/api-contract`: `pnpm check:contract-version` fails the change without a changeset for `@cueframe/api-contract` (and a sync manifest whose `contractVersion` names another version than `packages/api-contract/package.json`). The stamp names the version of the checkout the private sync ran against, so on a pull request it is the released version, not the planned one; the Version packages pull request restamps it after `changeset version` (`scripts/sync-contract-stamp.mjs`), and the package build applies the same rule.

## The one rule for skills

Skills are edited in root `skills/` and nowhere else. The plugin hosts read that directory from this repository; `pnpm build` copies it into `packages/skills/dist` (published as `@cueframe/skills`) and from there into the CLI's `dist/skills`; CueFrame's own services read the npm package. A change made in a copy is overwritten on the next build or sync. Edit `skills/<name>/SKILL.md`, run `pnpm build:plugin && pnpm check:plugin`, commit the regenerated `agents/openai.yaml` beside it, and open a pull request. `packages/skills/package.json` is the plugin's one version authority: `pnpm build:plugin` stamps every host manifest from it.

## How to run checks

```
pnpm install
pnpm check      # input provenance, the contract version rule, the public-contract gate, server.json, the plugin (check:plugin), and tsc --noEmit in sdk and cli
pnpm build      # stamps the plugin manifests and skill cards; tsup in every package; the CLI also packages the skills and proves its bundle carries no kernel code
pnpm test       # vitest per package plus node --test under tools/ and scripts/; no network
```

Run all three before proposing a change, in that order: the CLI's tests read the skills from `packages/skills/dist`, which `pnpm check` or `pnpm build` creates. Tests are hermetic; nothing in them talks to the hosted API. CI additionally runs `claude plugin validate --strict` on the marketplace manifest, the plugin manifest and `skills/`.

## The one rule about servers

The hosted MCP server at `https://api.cueframe.ai/v1/mcp` is the product; every user-facing instruction points there. The CueFrame desktop app runs its own local server for the open project; that one lives inside the app and is documented at https://docs.cueframe.ai, not here. The shim in `glama/` is not a server: it replays a snapshot of the hosted server's tool list and instructions for registries that introspect over stdio, and executes nothing. Keep the three distinct in anything you write, and never describe the shim as a way to use CueFrame.

## Releases: Changesets, published when the Version packages pull request merges

Board decisions, 2026-11-04 and 2026-11-05 (Paperclip CUE-49, CUE-51): Changesets, normal semver versions only, and **a merged Version packages pull request publishes**. `.github/workflows/publish-npm.yml` runs on every push to `main`: CI, then

- while `.changeset/*.md` files are pending, `changesets/action` runs `pnpm release:version` (`changeset version`, then the contract manifest's `contractVersion` and the plugin manifests restamped) on the branch `changeset-release/main` and opens or updates the "Version packages" pull request. It publishes nothing and never pushes to `main`. GitHub starts no `pull_request` run for a pull request opened with `GITHUB_TOKEN`, so the workflow dispatches CI on that branch.
- when `main` carries a package version npm does not have, which only that merge produces, `changeset publish` publishes it through npm trusted publishing, then `pnpm check:public-packages` waits up to 10 minutes for npm to serve each new version.

Homer merges the Version packages pull request under his approval rules; nobody dispatches a publish. A failed publish is retried with "Re-run failed jobs" on the same run. The rules for every pull request:

1. **A pull request that changes a published package adds a changeset**: `pnpm changeset`, or a `.changeset/<name>.md` file naming each package and its bump, then a one-line summary for the CHANGELOG. A file reaches a package when it is under the package's directory, or is an input the package bundles: `api/` is `@cueframe/api-contract`; root `skills/` is `@cueframe/skills`; the CLI (`cueframe`) bundles the SDK and the skills, so an SDK or skills change also names `cueframe`. Tests, vitest configs and package CHANGELOGs are excluded. `pnpm check:changesets` (CI) fails a branch without one.
2. **`review` checks the bump level against the change**: breaking means `major`, or `minor` while the package is below 1.0; a feature is `minor`; a fix is `patch`. A CLI minor bump also moves `scripts/plugin/cli-version.json` and every `cueframe@<major.minor>` pin in the same pull request (`scripts/plugin/cli-version.test.mjs` compares the pin with the version the changesets plan), which in turn is a `@cueframe/skills` change.
3. **Never hand-edit `version` in a `package.json`**, and never enter prerelease mode (`.changeset/pre.json`). `pnpm check:changesets` fails both; the only version edit it accepts is the Version packages branch applying exactly what the consumed changesets plan. Internal dependency ranges are Changesets' job (`updateInternalDependencies: "patch"`).
4. **No prerelease and no local `@cueframe` pins**: no `-ea…`, `-rc` or `-dev` version anywhere, and no `file:`, `link:`, tarball, git or URL source for any `@cueframe/*` dependency, override or catalog entry. Consumers pin versions npm has. `pnpm check:cueframe-pins` checks all three (and the same script runs in cueframe and cueframe-private). Known exception until the kernel publishes a normal version from the application repository: the `@cueframe/kernel` contract-build pin (root `pnpm.overrides` → `artifacts/`, and the `packages/api-contract` devDependency), which is why that check is not yet a CI step here (Paperclip CUE-51).

Landmine: GitHub skips every push and pull_request workflow for a commit whose message contains `[skip ci]` (or `[ci skip]`, `[no ci]`, `[skip actions]`, `[actions skip]`). On the Version packages merge commit that silently skips the release. Never write those markers in a commit message, pull request title or description (a squash or a "title and description" merge commit repeats them), and never in a changeset summary: summaries become the Version packages pull request's body, so `pnpm check:changesets` refuses them.

## Conventions

- Apache-2.0, inbound equals outbound; sign every commit (`git commit -s`).
- The CLI is written as `npx -y cueframe@<major.minor>` in docs and skills; the pinned value lives in `scripts/plugin/cli-version.json` and `pnpm check:plugin` enforces it in every skill.
- Comments cite documents by date and title, never by a filesystem path outside this repository.
