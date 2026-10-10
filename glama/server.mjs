#!/usr/bin/env node
// CueFrame: a local stdio introspection shim for MCP registries (Glama and others that
// build a Dockerfile and list tools over stdio).
//
// The real CueFrame MCP server is hosted at https://api.cueframe.ai/v1/mcp (Streamable
// HTTP; OAuth in the browser or `Authorization: Bearer cf_live_…`). Its `initialize`
// answers 401 to an anonymous client, and a registry's headless scanner cannot sign in,
// so this shim advertises the SAME tool surface and the SAME server instructions a
// signed-in client receives, replayed from glama/tools.json and glama/instructions.txt.
//
// It is discovery only. `tools/call` executes nothing: a CueFrame call needs an account
// and spends credits, so calling a tool here returns a pointer to the hosted server.
//
// The snapshot is exported by the server package's introspection mode; glama/refresh-snapshot.md
// says how to refresh it. The `source` header in tools.json records which version it came from.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const HOSTED_URL = 'https://api.cueframe.ai/v1/mcp';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), 'utf8');
const { version } = JSON.parse(read('package.json'));
const { tools } = JSON.parse(read('tools.json'));
const instructions = read('instructions.txt').trim();

const server = new Server(
  { name: 'cueframe', version },
  { capabilities: { tools: {} }, instructions },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => ({
  content: [
    {
      type: 'text',
      text:
        `This is a discovery-only listing of the CueFrame MCP server; "${request.params.name}" was not executed. ` +
        `The tools run on the hosted server at ${HOSTED_URL}: connect your client to that URL and sign in in the browser. ` +
        'For headless use, run `npx -y cueframe@0.8 login` and then `npx -y cueframe@0.8 keys create --name <name>` to mint an API key, ' +
        'and send it as `Authorization: Bearer <that key>`.',
    },
  ],
}));

async function main() {
  await server.connect(new StdioServerTransport());
  // The stdio server runs until the transport closes.
}

main().catch((error) => {
  process.stderr.write(`cueframe introspection shim failed: ${error?.stack || error}\n`);
  process.exit(1);
});
