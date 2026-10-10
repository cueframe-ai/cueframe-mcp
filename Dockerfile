# Discovery-only image for MCP registries that build and introspect (Glama and others).
#
# The CueFrame MCP server is hosted at https://api.cueframe.ai/v1/mcp (Streamable HTTP with
# OAuth or an API key). A registry's scanner cannot sign in, so this image runs glama/server.mjs,
# a stdio shim that replays the hosted server's tool list and instructions from a snapshot.
# It lists tools; it does not run them. See glama/refresh-snapshot.md.
FROM node:24-slim

WORKDIR /app

# Only the shim's dependency (the MCP SDK), from its own lockfile; the workspace is not installed.
COPY glama/package.json glama/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY glama/tools.json glama/instructions.txt glama/server.mjs ./

# stdio MCP server: the registry speaks JSON-RPC over stdin/stdout.
ENTRYPOINT ["node", "server.mjs"]
