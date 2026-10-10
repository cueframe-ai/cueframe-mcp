#!/usr/bin/env node
// server.json is the MCP registry entry for the hosted server (registry name ai.cueframe/cueframe).
// It lists the remote only: the server package is private, so there is no npm package entry and
// no version to keep in step with. This asserts the name, the remote URL, and that the document
// validates against the registry schema it declares.
//
// The schema is vendored next to this script so `pnpm check` runs offline; the CI hygiene job
// downloads the live schema and fails when the vendored copy differs from it.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

export const SERVER_NAME = "ai.cueframe/cueframe";
export const REMOTE_URL = "https://api.cueframe.ai/v1/mcp";
export const SCHEMA_URL = "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";
export const VENDORED_SCHEMA = "scripts/server.schema.2025-12-11.json";

const root = new URL("../", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));

/** Returns the list of problems with `server`; empty means it passes. */
export function checkServerJson(server, schema) {
  const problems = [];
  if (server.$schema !== SCHEMA_URL) {
    problems.push(`server.json $schema must be ${SCHEMA_URL} (got "${server.$schema}"); update ${VENDORED_SCHEMA} with it`);
  }
  if (server.name !== SERVER_NAME) problems.push(`server.json name must be "${SERVER_NAME}" (got "${server.name}")`);
  const remotes = Array.isArray(server.remotes) ? server.remotes : [];
  if (remotes.length !== 1 || remotes[0].type !== "streamable-http" || remotes[0].url !== REMOTE_URL) {
    problems.push(`server.json remotes must be exactly [{ type: "streamable-http", url: "${REMOTE_URL}" }]`);
  }
  if ("packages" in server) {
    problems.push("server.json must not list npm packages: the server package is private; the registry entry is the remote");
  }
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(server)) {
    for (const error of validate.errors ?? []) {
      problems.push(`server.json${error.instancePath || "/"}: ${error.message}${error.params?.additionalProperty ? ` (${error.params.additionalProperty})` : ""}`);
    }
  }
  return problems;
}

if (process.argv[1] && basename(process.argv[1]) === "check-server-json.mjs") {
  const server = read("server.json");
  const schema = read(VENDORED_SCHEMA);
  const problems = checkServerJson(server, schema);
  if (problems.length) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(`server.json ok: ${server.name} ${server.version}, remote ${server.remotes[0].url}, valid against ${SCHEMA_URL}`);
}
