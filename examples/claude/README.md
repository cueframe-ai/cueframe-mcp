# Claude Code

Register the hosted server at project scope:

```sh
claude mcp add --scope project --transport http cueframe https://api.cueframe.ai/v1/mcp
```

This writes project `.mcp.json`. Equivalent native JSON:

```json
{ "mcpServers": { "cueframe": { "type": "http", "url": "https://api.cueframe.ai/v1/mcp" } } }
```

Use `--scope user` for all projects (stored in `~/.claude.json`). Start Claude Code, approve the project server if prompted, and use `/mcp` to complete browser OAuth and inspect its tools. `claude mcp get cueframe` checks connection status. Confirm `get_account` is available; optionally call it before any metered operation.

For the skills too, install the plugin (`claude plugin marketplace add cueframe-ai/cueframe-mcp && claude plugin install cueframe@cueframe`) or run `npx -y cueframe@0.11 install`. Plugin installation supplies its own server definition; choose that or manual registration.

Source: [official Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).
