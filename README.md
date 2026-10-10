# CueFrame MCP

CueFrame composes, edits and renders finished video from an agent: bring footage, a brief or a brand and get back an MP4 with content-aware reframing, captions behind the subject and motion graphics authored as real components. See a render end to end in [the quickstart](https://docs.cueframe.ai/docs/quickstart#render).

This is the one public repository for CueFrame's agent surface. It is three things; most people want the first.

1. **The plugin.** Eighteen agent skills under [`skills/`](./skills), the session router and the manifests that install them into Claude Code, Codex and ChatGPT, Cursor, Gemini CLI and any Agent Skills client, every one pointed at the hosted MCP server.
2. **The developer toolkit.** The OpenAPI contract under [`api/`](./api) and the npm packages built from this tree: `@cueframe/api-contract`, `@cueframe/sdk`, `@cueframe/skills` and the `cueframe` CLI.
3. **The registry files.** `server.json` for the MCP registry, `glama.json`, and the stdio discovery shim in [`glama/`](./glama).

Documentation: https://docs.cueframe.ai · OpenAPI: https://api.cueframe.ai/v1/openapi.json

## Install the plugin

Claude Code (skills, the session router and the MCP server in one plugin):

```
claude plugin marketplace add cueframe-ai/cueframe-mcp
claude plugin install cueframe@cueframe
```

Codex:

```
codex plugin marketplace add cueframe-ai/cueframe-mcp
codex plugin add cueframe@cueframe
```

Gemini CLI:

```
gemini extensions install https://github.com/cueframe-ai/cueframe-mcp
```

Any of the 70+ clients that support Agent Skills (reads `skills/` and `skills.sh.json` directly):

```
npx skills add cueframe-ai/cueframe-mcp
```

Any MCP client, server only (then install the skills with one of the lines above or the CLI below). The browser opens to sign in on the first call; headless clients send `Authorization: Bearer cf_live_…` instead:

```
claude mcp add --transport http cueframe https://api.cueframe.ai/v1/mcp
```

Cursor and VS Code: use the one-click install links on https://docs.cueframe.ai/docs/setup (the same page lists every other client's config block, since the key names differ per client).

Hermes:

```yaml
mcp_servers:
  cueframe:
    url: https://api.cueframe.ai/v1/mcp
    auth: oauth
```

OpenClaw:

```
openclaw mcp add cueframe --url https://api.cueframe.ai/v1/mcp --transport streamable-http --auth oauth
```

The CueFrame CLI, which wires the server into every agent on your machine and writes the skills into the current project:

```
npx -y cueframe@0.8 install
```

Or let your agent do it. Paste this into the agent:

> Install the CueFrame plugin from https://github.com/cueframe-ai/cueframe-mcp, connect the CueFrame MCP server at https://api.cueframe.ai/v1/mcp, run get_account to confirm it works, then ask me for my footage or the video I want to make.

Connecting and authenticating step by step, including the desktop app's local server: [llms-install.md](./llms-install.md). Per-client examples live in [`examples/`](./examples): Claude Code, Cursor, Codex, Hermes, OpenClaw, and an SDK script that renders a clip end to end.

### The skills

| Skill | What it does |
| --- | --- |
| `add-music-bed` | Retrofits a music bed (and ambience or SFX) onto an existing composition — license-aware search, correct mix hierarchy, ducking under speech, cuts moved onto the beat. Triggers on "add music to this", "this video feels dead", "put a bed under it", "it needs sound", "add background music", "make the cuts hit the beat", "add some sfx", "the audio is just silence". |
| `brand-reel` | Produces a 12–20 second 9:16 brand-identity reel — three-beat arc, bespoke cards in the brand's own type and palette, footage graded into the palette. Triggers on "brand video", "identity reel", "make our brand a video", "turn our brand into a reel", "a video that feels like us", "showcase our brand", "anthem video for our launch". |
| `clip-a-talking-head` | Cuts a podcast, talk, or interview into shorts that open on the strongest sentence, reframe to the active speaker, and carry transcript-timed captions. Triggers on "clip this podcast", "pull the best moments out of this talk", "make shorts from this interview", "cut this down for social", "find the viral moment", "turn this recording into clips", "the good part is buried". |
| `composing-video` | Use when an agent is asked to make ANY video with CueFrame — a product launch, announcement, promo, teaser, social clip, reel, short, explainer, animated explainer, concept video, product/dev-tool demo, walkthrough, or founder/talking-head piece. Triggers on "make a video", "launch video", "promo", "teaser", "reel", "short", "explainer", "animated explainer", "demo video", "talking-head", or turning long-form footage into clips. |
| `cueframe-brand-demo` | Use when turning a local app into a brand-consistent product demo with CueFrame — extract the brand straight from the repo (colors/fonts/logo/motion), capture a Playwright walkthrough of the running app, and author a branded, auto-zoomed demo whose intro/outro/logo/colors/fonts/motion are frozen by CueFrame's engine — e.g. "make an on-brand demo of my app", "record my localhost and produce a branded launch video". This is the end-to-end brand pipeline over the CueFrame curated tools. |
| `cueframe-cli` | Use when editing, clipping, or rendering video via the CueFrame CLI — e.g. "make a 9:16 short from this podcast", "pull the best moments out of this MP4", "render a clip", or any task that calls the `cueframe` binary. Also use when comparing CueFrame against direct-ffmpeg approaches. |
| `cueframe-component-authoring` | Use when authoring, forking, or customizing a CueFrame motion-graphics component/primitive/graphic — e.g. "customize the cinematic-title primitive", "make my own animated lower-third", "fork a CueFrame template and edit it", "author a custom graphic and render it". Covers cloud MCP, local desktop, and CLI project paths through the same component-v2 contract. Use BEFORE hand-writing a component from scratch — forking a built-in is usually the faster start. |
| `cueframe-compose-loop` | Use when an AI agent should DRIVE CueFrame to a high-quality clip itself — author a composition, look at rendered frames, score it with CueFrame's judge, fix the weakest thing, and repeat until it's good — e.g. "turn this source into a polished 9:16 clip", "compose and self-correct until it scores well". This is the agent-driven convergence loop over the CueFrame primitives in the `cueframe-cli` skill. |
| `cueframe-connect` | Use when CueFrame is not connected yet, the user asks how to connect or authenticate CueFrame, or another CueFrame skill is about to call a tool and needs the one-time setup path for Claude Code, Claude, ChatGPT, Cursor, Codex, VS Code, Windsurf, Zed, Antigravity CLI, Copilot CLI, or an x402 wallet. |
| `cueframe-product-video` | Use when turning a screen recording (with cursor/click events) into a polished, auto-zooming product video or demo reel via CueFrame — e.g. "make a product demo from this Browserbase capture", "auto-zoom this screen recording to where the user clicked", "turn this walkthrough into a social demo". This is a USE-CASE recipe over the CueFrame primitives in the `cueframe-cli` skill. |
| `cueframe-scene-shot` | Author a CueFrame 3D world-object shot as canonical SceneShotSpecV2 JSON. Use for slabs, pages, phones, laptops, captured component or video surfaces, world text, camera motion, studio lighting, focus, and product-shot recipes. |
| `cueframe-storyboard` | Use BEFORE composing when starting a NEW video from scratch and you need to plan its structure — turning a rough ask ("make a launch video", "30s promo", "an explainer for our API") into a concrete beat flow. Owns the intake + storyboard step: interview the user for the brief, resolve the format from the platform, and lay out the hook→body→cta beats that drive the compose workflow. Triggers on "plan a video", "storyboard", "structure this video", "outline the video", "where do I start", or any new-video ask that has no structure yet. Hand off to composing-video for per-beat craft. |
| `every-format-from-one-edit` | Derives content-aware 9:16, 1:1, and 4:5 siblings from one finished composition — same edit, every platform, no re-editing. Triggers on "make this vertical too", "I need this for TikTok and LinkedIn", "every aspect ratio", "square version of this", "resize for Reels", "one video, all platforms", "port this edit to Shorts". |
| `extracting-brand-kits` | Use when the user says "make my video look like THIS" with a reference video, screenshots, or a moodboard — build a CueFrame brand kit FROM that inspiration so every subsequent compose speaks its visual language. Owns the extraction step: sample the reference's graphics-bearing frames, upload them as exemplars, reproduce each recurring motif as an authored graphic verified against the reference, and upsert the kit with the full language payload. Triggers on "match this style", "like this reference", "use this video as inspiration", "extract a brand kit", "moodboard". Hand off to cueframe-storyboard/composing-video once the kit is bound. |
| `launch-video` | Turns screen recordings and product footage into a 30–90 second 16:9 launch film — payoff-first hook, real product surface punched in, a building bed or narration, one CTA end card. Triggers on "make a launch video", "announcement video for this feature", "turn this screen recording into a demo film", "product video from these captures", "we're shipping Friday and need a video", "feature announcement". |
| `make-a-social-reel` | Turns footage into a finished 9:16 social reel — hook inside 2 seconds, poster-grade type, a decided music bed, one final render. Triggers on "make me a reel from this", "turn this into a short", "cut a clip for TikTok / Reels / Shorts", "make this vertical", "make a social clip from this video", "the opening is boring", "can you make this pop for Instagram". |
| `rebrand-a-video` | Swaps the brand kit under an existing video and re-renders — tokens, bumpers, logo, captions, and motion re-theme automatically; hardcoded card values get surgical edits. Triggers on "rebrand this video", "swap the brand", "we changed our colors", "new logo, same video", "make this video match the new brand", "re-theme our launch video", "white-label this for a client". |
| `video-craft-standards` | The definition of DONE for every video made with CueFrame — per-artifact checklists (social reel, launch film, brand reel, talking-head clip) with kill criteria. Read this BEFORE composing and score your work against it BEFORE rendering. Other skills quote this document; when a skill and this document disagree, this document wins. Triggers on "is this good enough", "quality bar", "what should a finished reel have", "review my video", or any request to make a video when no other skill has stated the bar. |

Skills name each other, so a session starts with the router (`hooks/session-inject.md`, the same text Cursor reads from `rules/cueframe.mdc`) choosing the entry point: `cueframe-storyboard` then `composing-video` for a new video, `clip-a-talking-head` for footage, `cueframe-connect` when the server is not connected yet.

## Build on the API

| Package | Purpose | npm |
| --- | --- | --- |
| [`@cueframe/api-contract`](./packages/api-contract) | The public OpenAPI document, its reviewed operation inventory and a content-addressed manifest: the only input the generated clients read. | [![npm](https://img.shields.io/npm/v/@cueframe/api-contract)](https://www.npmjs.com/package/@cueframe/api-contract) |
| [`@cueframe/sdk`](./packages/sdk) | Typed fetch-based TypeScript client with zod request schemas and SSE helpers for render and compose progress. | [![npm](https://img.shields.io/npm/v/@cueframe/sdk)](https://www.npmjs.com/package/@cueframe/sdk) |
| [`cueframe`](./packages/cli) | The CLI: login, projects, media, compositions, renders, exports and `install`, every command with `--json`. | [![npm](https://img.shields.io/npm/v/cueframe)](https://www.npmjs.com/package/cueframe) |
| [`@cueframe/skills`](./packages/skills) | The `skills/` tree as an npm package (`SKILLS_DIR` from `@cueframe/skills/dir`), for programs that copy or embed the skills. | [![npm](https://img.shields.io/npm/v/@cueframe/skills)](https://www.npmjs.com/package/@cueframe/skills) |

The MCP server itself (`@cueframe/mcp`) is a private package maintained in the application repository; this repository ships the contract it is generated from, the clients, the plugin, the registry entry (`server.json`) and a discovery shim, not the server.

### How the contract flows

```
private API ──sync──▶ api/openapi.json (+ scene-schema.json, scene-examples.json, contract-manifest.json)
                          │
                          ├──▶ packages/api-contract/dist  ──publish──▶  @cueframe/api-contract@x.y.z ──▶ the MCP server's generators, third parties
                          └──▶ packages/sdk/src/generated        (Orval: operations, models, zod)
```

The private API publishes its OpenAPI projection into `api/`; `pnpm generate:api-consumers` vendors the scene schema into the contract and regenerates the SDK from it. This is the one copy of the contract: the MCP server's generators in the application repository and every other consumer read it from the `@cueframe/api-contract` npm package, whose version moves with the contract (`pnpm check:contract-version` fails an `api/*.json` change without a bump), so the tool surface and the SDK always describe one contract. Nothing under `api/` or a `generated/` directory is hand-edited: `pnpm check:api-inputs` proves the three `api/*.json` inputs came from one sync, and `pnpm check:api-consumer-drift` proves the generated trees match them byte for byte.

### How the skills flow

Root `skills/` is the single source: the plugin hosts read it from this repository, and `pnpm build` copies it into `packages/skills/dist` (published as `@cueframe/skills`) and from there into the CLI's `dist/skills` for `cueframe install`. `pnpm check:plugin` validates every skill and manifest; `agents/openai.yaml` and `assets/icon.svg` beside each skill are generated.

## Registry files

- [`server.json`](./server.json): the MCP registry entry for the hosted server (`ai.cueframe/cueframe`, remotes only). `pnpm check:server-json` validates it against the vendored registry schema; the `registry` job of the publish workflow publishes it.
- [`glama.json`](./glama.json): the Glama listing's maintainer file.
- [`glama/`](./glama) and the [`Dockerfile`](./Dockerfile): a stdio discovery shim that replays a snapshot of the hosted server's tool list and instructions for registries that introspect over stdio. It is not a server (see below).

## Hosted, desktop-local, and the discovery shim

Three different things answer to "the CueFrame MCP server"; keep them apart.

- **The hosted server** at `https://api.cueframe.ai/v1/mcp` is the product. Every install line above talks to it; it authenticates with OAuth or an API key and does the composing and rendering. Its package, `@cueframe/mcp`, is private.
- **The CueFrame desktop app ships its own local MCP server** for the project you have open. It needs no account and is connected through the connection file the app publishes; the app's Agents settings show the exact command, and https://docs.cueframe.ai explains it. Its bundled binary is called `cueframe-mcp`; it lives inside the app bundle.
- **This repository's discovery shim** ([`glama/server.mjs`](./glama/server.mjs), built by the [`Dockerfile`](./Dockerfile)) is not a server. It replays a snapshot of the hosted server's tool list and instructions over stdio so registries that build an image can list the tools without an account; every `tools/call` answers with a pointer to the hosted server. [`glama/refresh-snapshot.md`](./glama/refresh-snapshot.md) says where the snapshot comes from.

## Repository layout

- `skills/<name>/SKILL.md`: the skill. `agents/openai.yaml` and `assets/icon.svg` beside it are generated (`pnpm build:plugin`).
- `.claude-plugin/`, `hooks/`, `.mcp.json`: Claude Code plugin, session router and server.
- `.codex-plugin/`, `.agents/plugins/`, `mcp.json`: Codex and ChatGPT plugin and marketplace.
- `.cursor-plugin/`, `rules/`: Cursor plugin and the always-on rule.
- `gemini-extension.json`, `skills.sh.json`, `plugin.json`: Gemini CLI, skills.sh, the portable manifest (agent-plugins.org).
- `api/`, `packages/`, `tools/`, `scripts/`: the contract, the four npm packages, their generators and checks (`scripts/plugin/` holds the plugin's).
- `server.json`, `glama.json`, `glama/`, `Dockerfile`: the registry files.
- `examples/`, `llms-install.md`: per-client setup and the agent-readable install guide.

## Development

```
pnpm install
pnpm check      # input provenance, the contract version rule, the public-contract gate, server.json, the plugin, and tsc --noEmit in sdk and cli
pnpm build      # stamps the plugin manifests and skill cards, then tsup in every package; the CLI packages the skills
pnpm test
```

Node 24 or newer and pnpm (see `.nvmrc` and `packageManager`). [CONTRIBUTING.md](./CONTRIBUTING.md) explains which paths are generated, the skill contract and how a change travels; [AGENTS.md](./AGENTS.md) is the same for an agent working in this tree; [llms-install.md](./llms-install.md) connects a client step by step.

## License

Apache-2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
