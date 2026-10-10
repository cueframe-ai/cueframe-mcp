#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkApiInputs } from "../../../tools/check-api-inputs.mjs";
import { checkPublicOpenAPI } from "../../../tools/check-openapi-public.mjs";
import { isVendoredSceneSpec } from "../../../tools/vendor-scene-schema.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = join(packageRoot, "..", "..");
const inputCheck = checkApiInputs(repositoryRoot);
if (!inputCheck.ok) throw new Error(inputCheck.problems.join("\n"));
const api = (name) => readFileSync(join(repositoryRoot, "api", name));
const { version: contractVersion } = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
const specBytes = api("openapi.json");
const surfaceBytes = api("public-surface.json");
// The scene schema, the scene examples and the sync manifest travel with the contract: the private
// contract sync writes all three beside openapi.json from one kernel, and the manifest records which.
const sceneSchemaBytes = api("scene-schema.json");
const sceneExamplesBytes = api("scene-examples.json");
const sync = JSON.parse(api("contract-manifest.json"));
const spec = JSON.parse(specBytes);
const surface = JSON.parse(surfaceBytes);

// Consumers get the VENDORED document: the sync's form carries SceneShotSpecV2 with $refs to recursion
// carriers it deleted, which orval (and any other resolver) cannot follow. generate:api-consumers
// vendors api/openapi.json in place; a tree where the sync ran but the generators did not must not ship.
if (!isVendoredSceneSpec(spec)) {
  throw new Error(
    "api/openapi.json is the sync's un-vendored form; run `pnpm generate:api-consumers` before building the contract package.",
  );
}
// The package version IS the contract version. The private sync may stamp the version it was run against
// into the manifest (one contract chain, 2026-10-07); when it does, the two must agree.
if (sync.contractVersion !== undefined && sync.contractVersion !== contractVersion) {
  throw new Error(
    `api/contract-manifest.json records contractVersion ${sync.contractVersion} but packages/api-contract/package.json is ${contractVersion}; ` +
      "bump the package (a contract change needs a new version) or re-run the sync against this checkout.",
  );
}

const result = checkPublicOpenAPI(spec, surface);
const sha256 = createHash("sha256").update(specBytes).digest("hex");
const syncedFiles = Object.fromEntries(
  ["openapi.json", "scene-schema.json", "scene-examples.json"].map((name) => [name, sync.files[name]]),
);
const manifest = {
  schemaVersion: 1,
  contractVersion,
  sha256,
  operationCount: result.operationCount,
  pathCount: result.pathCount,
  componentCount: result.componentCount,
  kernelVersion: sync.kernelVersion,
  privateCommit: sync.privateCommit,
  ...(sync.privateSource ? { privateSource: sync.privateSource } : {}),
  ...(sync.kernelArtifact ? { kernelArtifact: sync.kernelArtifact } : {}),
  // As the sync recorded them: openapi.json BEFORE the toolkit vendored the scene schema into it.
  syncedFiles,
};
// The sync manifest as written, plus the version this package publishes it under.
const contractManifest = { ...sync, contractVersion };

const literal = (value) => JSON.stringify(value, null, 2);
// Every field of manifest.json that a consumer may want without parsing JSON, as literal types.
const exported = [
  ["contractVersion", JSON.stringify(contractVersion)],
  ["openApiSha256", JSON.stringify(sha256)],
  ["operationCount", String(result.operationCount)],
  ["pathCount", String(result.pathCount)],
  ["componentCount", String(result.componentCount)],
  ["kernelVersion", JSON.stringify(sync.kernelVersion)],
  ["privateCommit", JSON.stringify(sync.privateCommit)],
  ["syncedFiles", literal(syncedFiles)],
];
const indexJs = exported.map(([name, value]) => `export const ${name} = ${value};\n`).join("");
const indexDts = exported.map(([name, value]) => `export declare const ${name}: ${value};\n`).join("");

const outputs = new Map([
  ["openapi.json", specBytes],
  ["public-surface.json", surfaceBytes],
  ["scene-schema.json", sceneSchemaBytes],
  ["scene-examples.json", sceneExamplesBytes],
  ["contract-manifest.json", Buffer.from(`${literal(contractManifest)}\n`)],
  ["manifest.json", Buffer.from(`${literal(manifest)}\n`)],
  ["index.js", Buffer.from(indexJs)],
  ["index.d.ts", Buffer.from(indexDts)],
]);

const dist = join(packageRoot, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const [name, bytes] of outputs) writeFileSync(join(dist, name), bytes);
console.log(
  `Built @cueframe/api-contract ${contractVersion}: sha256:${sha256} (kernel ${sync.kernelVersion}, private ${sync.privateCommit.slice(0, 9)})`,
);
