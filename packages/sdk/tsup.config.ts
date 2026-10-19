import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/zod.ts', 'src/clientIdentity.ts'],
  format: ['esm'],
  sourcemap: true,
  outDir: 'dist',
  dts: {
    // tsup 8 injects baseUrl even without paths. Its API-based declaration
    // bundler uses the maintained TypeScript 6 compatibility package; native
    // TypeScript 7 still performs the separate, unchanged tsc --noEmit check.
    compilerOptions: { ignoreDeprecations: '6.0' },
  },
});
