# Codex

For the plugin (skills and hosted server together):

```sh
codex plugin marketplace add cueframe-ai/cueframe-mcp
codex plugin add cueframe@cueframe
```

For manual server-only setup, use the native CLI instead:

```sh
codex mcp add cueframe --url https://api.cueframe.ai/v1/mcp
codex mcp login cueframe
```

Or merge this TOML into `~/.codex/config.toml` (project scope: `.codex/config.toml` in a trusted project):

```toml
[mcp_servers.cueframe]
url = "https://api.cueframe.ai/v1/mcp"
```

The repository's portable plugin `mcp.json` is a packaging artifact. Codex native settings use TOML; do not copy Cursor JSON into them. Choose plugin installation or manual registration to avoid duplicate connections.

Run `codex mcp list`, restart the session, then use `/mcp` to check the active CueFrame tools. Complete OAuth in the browser. Confirm `get_account` is available; optionally call it before any metered operation. For unattended API keys, see [headless setup](../../llms-install.md#headless-authentication).

Source: [official Codex MCP documentation](https://developers.openai.com/codex/mcp) and [OpenAI Docs MCP setup](https://developers.openai.com/learn/docs-mcp).
