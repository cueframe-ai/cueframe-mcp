# OpenClaw

Use native MCP registration for the hosted server. Stop the local Gateway first if it is running (`openclaw gateway stop`); saved-server mutations require it to be stopped:

```sh
openclaw mcp add cueframe --url https://api.cueframe.ai/v1/mcp --transport streamable-http --auth oauth
```

This manages OpenClaw's `mcp.servers` configuration, rather than a portable plugin `mcp.json`. Start the Gateway again (`openclaw gateway start`). In the Control UI, open Settings → MCP and select Sign in for CueFrame to complete browser OAuth. Inspect the connected tool list there; `openclaw mcp status --verbose` shows configuration and `openclaw mcp probe cueframe` checks live capabilities while the Gateway is stopped. For setup while the Gateway is running, use Settings → MCP to add the server and sign in directly. Reload or restart the runtime that owns the active session after changes.

Confirm `get_account` is available; optionally call it before any metered operation. No project creation or render is needed to verify discovery.

Source: [official OpenClaw MCP documentation](https://docs.openclaw.ai/tools/mcp) and [saved-server CLI reference](https://docs.openclaw.ai/cli/mcp/registry).
