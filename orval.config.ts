import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "orval";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OPENAPI = join(ROOT, "packages", "api-contract", "dist", "openapi.json");
const SDK_GENERATED = join(ROOT, "packages", "sdk", "src", "generated");

export default defineConfig({
  cueframe: {
    input: { target: OPENAPI },
    output: {
      mode: "tags-split",
      target: join(SDK_GENERATED, "index.ts"),
      tsconfig: join(ROOT, "packages", "sdk", "tsconfig.json"),
      schemas: join(SDK_GENERATED, "models"),
      packageJson: join(ROOT, "packages", "sdk", "package.json"),
      client: "fetch",
      httpClient: "fetch",
      baseUrl: "",
      override: {
        mutator: {
          path: join(ROOT, "packages", "sdk", "src", "client.ts"),
          name: "request",
        },
        fetch: { includeHttpResponseReturnType: false },
      },
      clean: true,
      prettier: false,
      indexFiles: true,
    },
  },
  cueframeZod: {
    input: { target: OPENAPI },
    output: {
      mode: "tags-split",
      target: join(SDK_GENERATED, "zod", "index.ts"),
      tsconfig: join(ROOT, "packages", "sdk", "tsconfig.json"),
      schemas: join(SDK_GENERATED, "zod", "models"),
      packageJson: join(ROOT, "packages", "sdk", "package.json"),
      client: "zod",
      override: { zod: { version: 4, generateReusableSchemas: true, strict: { body: true } } },
      clean: true,
      prettier: false,
      indexFiles: true,
    },
  },
});
