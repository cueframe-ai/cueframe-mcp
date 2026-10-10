# cueframe-mcp

This repository is the public home of [CueFrame](https://cueframe.ai)'s agent surface: the plugin that installs CueFrame's agent skills and the hosted MCP server into Claude Code, Codex and ChatGPT, Cursor, Gemini CLI and any Agent Skills client; the developer toolkit (a pnpm workspace with four published packages); and the registry files. CueFrame is a hosted service that composes, edits and renders video for agents.

- `skills/<name>/SKILL.md`: one skill per directory (frontmatter `name` and `description`, then the skill; optional `references/`). The manifests at the root and in the dot-directories (`.claude-plugin/`, `.codex-plugin/`, `.agents/plugins/`, `.cursor-plugin/`, `plugin.json`, `gemini-extension.json`, `skills.sh.json`, `.mcp.json`, `mcp.json`) are one plugin tree that every host reads; `hooks/` is the Claude Code session router and `rules/cueframe.mdc` the same text for Cursor.
- `packages/api-contract` (`@cueframe/api-contract`): the public OpenAPI document, its reviewed operation inventory and a content-addressed manifest, built from `api/`.
- `packages/sdk` (`@cueframe/sdk`): the typed TypeScript client. `src/generated/` is Orval output; `client.ts`, `errors.ts` and `sse.ts` are hand-written.
- `packages/skills` (`@cueframe/skills`): the root `skills/` tree as an npm package; `SKILLS_DIR` from `@cueframe/skills/dir` points at its `dist/skills`.
- `packages/cli` (`cueframe`): the command-line client. `cueframe install` writes the agent skills (copied from `@cueframe/skills` at build time) and the MCP config into a project.

The MCP server package, `@cueframe/mcp`, is private and lives in the application repository; it is not in this tree. `server.json` is the registry entry for the hosted server, and `glama/` holds a discovery shim (not a workspace member; it has its own `package.json` and lockfile).

## Install, one line per host

- Claude Code: `claude plugin marketplace add cueframe-ai/cueframe-mcp && claude plugin install cueframe@cueframe`
- Codex: `codex plugin marketplace add cueframe-ai/cueframe-mcp && codex plugin add cueframe@cueframe`
- Gemini CLI: `gemini extensions install https://github.com/cueframe-ai/cueframe-mcp`
- Any client that supports Agent Skills: `npx skills add cueframe-ai/cueframe-mcp`
- Any MCP client: `claude mcp add --transport http cueframe https://api.cueframe.ai/v1/mcp` (or the equivalent in your client)
- The CueFrame CLI: `npx -y cueframe@0.8 install`

## If you are an agent pointed at this repository

Read `llms-install.md` to connect the `cueframe` MCP server, then load the skill the router names. The router is `hooks/session-inject.md` (Claude Code injects it at session start; Cursor reads the same text from `rules/cueframe.mdc`). It maps the task to a skill: a new video starts with `cueframe-storyboard` then `composing-video`; clipping long footage is `clip-a-talking-head`; not connected yet is `cueframe-connect`. Call `get_account` before any metered call.

## Where the contract comes from

The private CueFrame API publishes its OpenAPI projection into `api/` (`openapi.json`, `scene-schema.json`, `scene-examples.json`, `contract-manifest.json`). Everything under `api/` and under any `generated/` directory is derived: never hand-edit it. A contract change starts in the API; this repository then runs `pnpm generate:api-consumers` and commits the result. `pnpm check:api-inputs` proves the three inputs hash to the manifest; `pnpm check:api-consumer-drift` proves the generated trees match them. Consumers outside this repository read the contract from the `@cueframe/api-contract` npm package, never from a second copy of `api/`, so any change to `api/*.json` is a new version of `packages/api-contract`: `pnpm check:contract-version` fails the change without the bump (and a sync manifest whose `contractVersion` names another version).

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

## Conventions

- Apache-2.0, inbound equals outbound; sign every commit (`git commit -s`).
- The CLI is written as `npx -y cueframe@<major.minor>` in docs and skills; the pinned value lives in `scripts/plugin/cli-version.json` and `pnpm check:plugin` enforces it in every skill.
- Comments cite documents by date and title, never by a filesystem path outside this repository.
