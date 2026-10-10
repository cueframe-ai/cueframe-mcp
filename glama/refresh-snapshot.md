# Refreshing the discovery snapshot

`tools.json` and `instructions.txt` are what the hosted CueFrame MCP server (`https://api.cueframe.ai/v1/mcp`) returns to a signed-in client from `tools/list` and `initialize`, as exported by the server package's introspection mode. `server.mjs` replays them so a registry that builds the `Dockerfile` can list the tools without an account. Refresh them whenever the server's tool surface or instructions change; `tools.json`'s `source` header records the `@cueframe/mcp` version and the commit the snapshot came from.

The hosted endpoint itself cannot be the source: it answers 401 to an anonymous `initialize`.

## Intended path

From the private application repository, which owns the `@cueframe/mcp` package:

```
pnpm --filter @cueframe/mcp export:snapshot -- <path to this repository>/glama
```

The exporter runs the server in `CUEFRAME_MCP_INTROSPECT=1` mode, speaks `initialize` (protocol `2025-06-18`) and `tools/list` to it over stdio, sorts the tools by name, and writes:

- `tools.json`: `{ "source": { "package": "@cueframe/mcp", "version": "<package.json version>", "commit": "<HEAD>" }, "tools": [...] }`
- `instructions.txt`: `result.instructions` from `initialize`, trimmed, with a trailing newline.

The exporter is also what makes the bin runnable from the workspace: in the application repository `@cueframe/sdk` resolves to TypeScript source, so `node packages/mcp/dist/bin.js` alone fails to load it; the exporter spawns the bin through the package's SDK dist hooks.

Commit both files here together with the `source` header change. To review a refresh, re-export at the previous `source.commit` and `cmp` the result against the committed files: a clean comparison proves the new diff is the surface change between the two commits and nothing else. `glama/tools.json` is marked `linguist-generated` in `.gitattributes`, so the diff is collapsed by default.

## Checking the result

```
cd glama && npm ci
printf '%s\n%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"check","version":"0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_account","arguments":{}}}' \
  | node server.mjs
```

The first response carries `serverInfo.name: "cueframe"` and the instructions, the second the tool list, the third a text result that points at the hosted server. `docker build -t cueframe-mcp-shim .` from the repository root builds the same thing the registry builds.
