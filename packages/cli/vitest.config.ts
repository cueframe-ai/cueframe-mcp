import { defineConfig } from "vitest/config";
import { createRequire } from "node:module";

const { version } = createRequire(import.meta.url)("./package.json") as { version: string };

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  // The published binary gets this from tsup; the tests exercise the same seam.
  define: { __CLI_VERSION__: JSON.stringify(version) },
});
