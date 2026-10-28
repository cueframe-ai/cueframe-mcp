# Refreshing the discovery snapshot

`tools.json` and `instructions.txt` replay the hosted CueFrame MCP server's tool
catalog and instructions for registries that introspect over stdio. Tool calls
execute only on `https://api.cueframe.ai/v1/mcp`; the shim executes nothing.

Export both files from a clean, reviewed release of the application repository,
[`cueframe-ai/cueframe`](https://github.com/cueframe-ai/cueframe), which owns
`@cueframe/mcp`:

```bash
pnpm --filter @cueframe/mcp build
node packages/mcp/scripts/export-introspection-snapshot.mjs /path/to/cueframe-mcp/glama
```

The exporter launches the built server in `CUEFRAME_MCP_INTROSPECT=1` mode and
reads `initialize` and `tools/list` over stdio. It sorts the tools by name and
writes the instructions with a trailing newline. The snapshot's `source` records
the package version and application commit; commit both exported files together.
Anonymous discovery is also available on the hosted endpoint, but the release
export records which source produced the snapshot.

From this repository, check the exported snapshot through the shim's actual SDK:

```bash
cd glama
npm ci --omit=dev --no-audit --no-fund
node --test server.test.mjs
```

The test verifies that discovery preserves the snapshot, the response stays below
640 KiB, and tool execution returns an error directing the caller to the hosted
server. CI runs it from the shim's own lockfile. `docker build -t cueframe-mcp-shim .`
from the repository root builds the discovery shim used by registries.
