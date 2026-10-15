# Install CueFrame for your agent

CueFrame is a hosted video compose, edit and render service that agents drive over MCP. You bring footage, a brief or a brand; CueFrame does content-aware reframing, transcript-timed captions, motion graphics as real components, and deterministic renders. This page is for an agent (or a person) connecting a client to CueFrame; the skills in this repository (`skills/`) then teach the agent the workflows.

Reference: https://docs.cueframe.ai · OpenAPI: https://api.cueframe.ai/v1/openapi.json

## Step 0: if the CueFrame desktop app is open, use it

The desktop app already runs a local MCP server for the open project, with no account needed. Connect with the bundled binary and its connection file, then skip to Step 4.

macOS:

```
<CueFrame.app>/Contents/MacOS/cueframe-mcp --external --connection-file "~/Library/Application Support/ai.cueframe.studio/mcp-connection.json"
```

The app's Agents settings show the exact command for each platform; copy it from there. That binary lives inside the app bundle; this repository does not publish a server.

## Step 1: connect to the hosted server

The hosted server speaks Streamable HTTP. OAuth opens in the browser on the first call; for headless use send `Authorization: Bearer cf_live_*` instead. To mint a key: `npx -y cueframe@0.9 login`, then `npx -y cueframe@0.9 keys create --name <name>` (`cueframe login` alone signs you in; it does not produce a key).

```json
{ "mcpServers": { "cueframe": { "url": "https://api.cueframe.ai/v1/mcp" } } }
```

Headless, with a key:

```json
{ "mcpServers": { "cueframe": { "url": "https://api.cueframe.ai/v1/mcp", "headers": { "Authorization": "Bearer cf_live_…" } } } }
```

A client that only speaks stdio has two options. With the desktop app installed, use its local server (Step 0). Otherwise bridge to the hosted server with `mcp-remote`, a community stdio-to-Streamable-HTTP proxy (not a CueFrame package). Without `--header` it runs the OAuth flow in the browser:

```json
{ "mcpServers": { "cueframe": { "command": "npx", "args": ["-y", "mcp-remote@0.14", "https://api.cueframe.ai/v1/mcp"] } } }
```

Headless, with an API key (`--header-file` keeps the key out of the process list; see mcp-remote's README):

```json
{ "mcpServers": { "cueframe": { "command": "npx", "args": ["-y", "mcp-remote@0.14", "https://api.cueframe.ai/v1/mcp", "--header", "Authorization: Bearer ${CUEFRAME_API_KEY}"], "env": { "CUEFRAME_API_KEY": "cf_live_…" } } } }
```

<!-- Verified against mcp-remote 0.14.3's documentation (--header, --header-file, OAuth); the end-to-end OAuth run against api.cueframe.ai and the API-key run are pending (no key was available when this was written). Clear this comment once both have been exercised. -->

The `glama/` directory in this repository is a discovery shim for registries: it lists the tools and executes nothing, so it is not a way to connect.

## Step 2: write the config

Put the block from Step 1 in the client's MCP config: `.mcp.json` (Claude Code), `mcp.json` (Codex, Cursor, Gemini CLI), or the client's own settings UI. The server name must be `cueframe`; the skills refer to its tools as `mcp__cueframe__*`. Ready-made blocks for Claude Code, Cursor, Codex, Hermes and OpenClaw are in [`examples/`](./examples).

## Step 3: install the skills

Either install this plugin through your client's plugin or marketplace command (the install lines are in [README.md](./README.md)), or let the CLI install the skills into `~/.agents/skills` and `~/.claude/skills`:

```
npx -y cueframe@0.9 install
```

Restart your agent session after installation so it can load the server and skills.

## Step 4: verify

Call `get_account`. It returns the org, plan, entitlements and credit balance; the skills call it before any metered operation. If the tool list has no `mcp__cueframe__*` entries, load the `cueframe-connect` skill and follow it.

## From code instead: the SDK

```
npm i @cueframe/sdk
```

```js
import { createClient, account, projects, compositions, renders } from "@cueframe/sdk";
createClient({ baseUrl: "https://api.cueframe.ai", apiKey: process.env.CUEFRAME_API_KEY });
console.log((await account.getAccount()).plan);
const project = await projects.createProject({ name: "first-render", format: { aspectRatio: "16:9" } });
await compositions.applyComposition(project.id, { ops: [{ type: "clip.add", newTrack: true, clip: { id: "c1", kind: "video", startTime: 0, duration: 10, source: { kind: "media", mediaId: "<a media id>" } } }] });
console.log((await renders.createRender(project.id, {})).id);
```

[`examples/render-a-clip/run.mjs`](./examples/render-a-clip/run.mjs) is the complete version: it imports a public sample, waits for processing, adds the clip, renders and prints the MP4 URL.
