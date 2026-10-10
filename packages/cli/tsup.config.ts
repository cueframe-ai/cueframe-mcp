import { defineConfig } from 'tsup';
import { createRequire } from 'node:module';

const { version } = createRequire(import.meta.url)('./package.json') as { version: string };

export default defineConfig({
  entry: { cueframe: 'src/bin.ts', supportedAgents: 'src/supportedAgents.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  bundle: true,
  // Only the SDK and zod are inlined. The CLI carries no kernel code; validation and binding run on the server.
  noExternal: ['@cueframe/sdk', 'zod'],
  external: ['typescript'],
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
  dts: false,
  shims: false,
  minify: true,
  define: {
    __CLI_VERSION__: JSON.stringify(version),
  },
});
