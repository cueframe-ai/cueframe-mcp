# Install CueFrame for your agent

CueFrame is a hosted video compose, edit and render service that agents drive over MCP. You bring footage, a brief or a brand; CueFrame does content-aware reframing, transcript-timed captions, motion graphics as real components, and deterministic renders. This page is for an agent (or a person) connecting a client to CueFrame; the skills in this repository (`skills/`) then teach the agent the workflows.

Reference: https://docs.cueframe.ai · OpenAPI: https://api.cueframe.ai/v1/openapi.json

## Step 1: choose plugin installation or manual MCP setup

The hosted server uses Streamable HTTP at `https://api.cueframe.ai/v1/mcp`. Use OAuth browser sign-in for interactive clients. No API key is needed for that path.

Plugin installation loads the bundled server definition and skills; use the host-specific install commands in [README.md](./README.md). The repository's `mcp.json` is a portable **plugin artifact**, with its own schema. It is not a native settings file to copy into every client. The plugin's `.mcp.json` and `gemini-extension.json` are also host packaging artifacts. Leave these manifests unchanged when configuring your own client.

For manual registration, choose your client's native command and file below. Manual registration connects MCP tools; install the skills separately in Step 3. If the plugin already provides CueFrame, use that connection instead of adding a second registration.

The CueFrame desktop app's local project server is a separate integration; see [desktop documentation](https://docs.cueframe.ai). This guide connects to the hosted service. The `glama/` discovery shim only lists tools for registries and cannot execute them.

## Step 2: use the client's native settings

Merge entries into existing settings; preserve other servers and preferences. Keep the server name `cueframe`. Tool name prefixes vary by client and by plugin installation; look for the CueFrame server and `get_account`, rather than relying on one universal prefix.

### Codex

```sh
codex mcp add cueframe --url https://api.cueframe.ai/v1/mcp
codex mcp login cueframe
```

Native settings are TOML in `~/.codex/config.toml` (or `.codex/config.toml` in a trusted project):

```toml
[mcp_servers.cueframe]
url = "https://api.cueframe.ai/v1/mcp"
```

Check registration with `codex mcp list`, then start a new session and use `/mcp` to inspect active servers. See the [Codex example](./examples/codex/README.md) and [official Codex MCP documentation](https://developers.openai.com/codex/mcp).

### Claude Code

```sh
claude mcp add --scope project --transport http cueframe https://api.cueframe.ai/v1/mcp
```

This writes project `.mcp.json` using JSON with an explicit HTTP transport:

```json
{ "mcpServers": { "cueframe": { "type": "http", "url": "https://api.cueframe.ai/v1/mcp" } } }
```

Start Claude Code, approve the project server if prompted, and use `/mcp` to authenticate and inspect its tools. See the [Claude Code example](./examples/claude/README.md) and [official MCP documentation](https://code.claude.com/docs/en/mcp).

### Cursor

Merge [examples/cursor/mcp.json](./examples/cursor/mcp.json) into project `.cursor/mcp.json` or personal `~/.cursor/mcp.json`. Its native JSON uses `mcpServers.cueframe.url`. Open Cursor's MCP settings, enable CueFrame, complete OAuth sign-in, and inspect the tool list. See [Cursor's official MCP documentation](https://cursor.com/docs/mcp).

### Gemini CLI

```sh
gemini mcp add --scope user --transport http cueframe https://api.cueframe.ai/v1/mcp
```

This writes `~/.gemini/settings.json`; use `--scope project` for `.gemini/settings.json`. The native Streamable HTTP field is `httpUrl`:

```json
{ "mcpServers": { "cueframe": { "httpUrl": "https://api.cueframe.ai/v1/mcp" } } }
```

In Gemini, use `/mcp auth cueframe` to sign in and `/mcp list` to inspect the connection and tools. See [Gemini CLI's official MCP documentation](https://geminicli.com/docs/tools/mcp-server/).

### Hermes and OpenClaw

Hermes uses YAML under `mcp_servers` in `~/.hermes/config.yaml`; merge [examples/hermes/config.yaml](./examples/hermes/config.yaml), then run `hermes mcp login cueframe` and `hermes mcp test cueframe`. Start a new session or use `/reload-mcp`. See [Hermes's official MCP documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp).

OpenClaw manages native `mcp.servers` entries through its CLI or Settings → MCP. Follow the [OpenClaw example](./examples/openclaw/README.md), including OAuth sign-in and tool inspection, and [official OpenClaw documentation](https://docs.openclaw.ai/tools/mcp).

### Headless authentication

For unattended use, create a CueFrame API key with `npx -y cueframe@0.11 login`, then `npx -y cueframe@0.11 keys create --name <name>`. Login alone does not create a key. Keep keys outside committed config.

For Codex, replace the OAuth entry with an environment-backed bearer token:

```toml
[mcp_servers.cueframe]
url = "https://api.cueframe.ai/v1/mcp"
bearer_token_env_var = "CUEFRAME_API_KEY"
```

Set `CUEFRAME_API_KEY` in the launching environment to your key (`cf_live_<YOUR_API_KEY>` is a placeholder). Other clients support an `Authorization: Bearer <YOUR_API_KEY>` header in their native remote-server entry; use their documented secret or environment interpolation syntax. Do not copy Codex TOML into a JSON client or reuse one client's interpolation syntax in another.

## Step 3: install the skills

Either install this plugin through your client's plugin or marketplace command (the install lines are in [README.md](./README.md)), or let the CLI install the skills into `~/.agents/skills` and `~/.claude/skills`:

```
npx -y cueframe@0.11 install
```

Restart your agent session after installation so it can load the server and skills.

## Step 4: verify

First inspect the client tool list as described above: CueFrame should be connected and expose `get_account`. A saved config alone does not prove the tools loaded. After signing in, optionally call `get_account` to check the org, plan, entitlements and credit balance before any metered operation. Tool discovery does not require creating a project or rendering. If the server or tool is missing, load `cueframe-connect` and follow it.

The examples can be checked offline by parsing JSON with `JSON.parse` and TOML with Python 3.11+ `tomllib.loads`. These checks validate syntax; OAuth and live tool availability are confirmed in your client after sign-in. No credentials or paid calls are needed to review the examples.

## From code instead: the SDK

```
npm i @cueframe/sdk
```

```js
import { createClient, account, projects, compositions, renders } from "@cueframe/sdk";
createClient({ baseUrl: "https://api.cueframe.ai", apiKey: process.env.CUEFRAME_API_KEY });
console.log((await account.getAccount()).plan);
const project = await projects.createProject({ name: "first-render", format: { aspectRatio: "16:9" } });
const { etag } = await compositions.newComposition(project.id, { name: "first" });
await compositions.applyComposition(project.id, { if_match: etag, ops: [{ type: "clip.add", newTrack: true, clip: { id: "c1", kind: "video", startTime: 0, duration: 10, source: { kind: "media", mediaId: "<a media id>" } } }] });
console.log((await renders.createRender(project.id, {})).id);
```

[`examples/render-a-clip/run.mjs`](./examples/render-a-clip/run.mjs) is the complete version: it imports a public sample, waits for processing, adds the clip, renders and prints the MP4 URL.
