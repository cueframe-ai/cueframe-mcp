#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "options", "head", "trace"];
const ALLOWED_EXTENSIONS = new Set(["x-payment-info", "x-permissions", "x-x402"]);
const ALLOWED_SERVERS = new Set(["https://api.cueframe.ai"]);
const FORBIDDEN_STRUCTURAL_KEYS = [
  /^(?:r2|s3)(?:key|keys)$/i,
  /^(?:output|still)(?:r2|s3)(?:key|keys)$/i,
  /^(?:storage|object)(?:key|keys|id)$/i,
  /^(?:temporal)(?:workflow|run)id$/i,
  /^(?:import)?workflowid$/i,
  /^producerid$/i,
  /^gateway$/i,
  /^(?:eval|evaluation|provider|model|compute)(?:cost|cogs)usd$/i,
  /^(?:sourceRepository|sourcePath|sourceCommit|sourceDirty)$/,
];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function decodePointerToken(token) {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveLocalRef(document, ref) {
  if (!ref.startsWith("#/")) throw new Error(`External $ref is not allowed: ${ref}`);
  let cursor = document;
  for (const token of ref.slice(2).split("/")) {
    if (!isObject(cursor)) return undefined;
    cursor = cursor[decodePointerToken(token)];
  }
  return cursor;
}

function collectRefs(value, into) {
  if (Array.isArray(value)) return value.forEach((child) => collectRefs(child, into));
  if (!isObject(value)) return;
  if (typeof value.$ref === "string") into.add(value.$ref);
  Object.values(value).forEach((child) => collectRefs(child, into));
}

function collectSecurityNames(value, into) {
  if (Array.isArray(value)) return value.forEach((child) => collectSecurityNames(child, into));
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "security" && Array.isArray(child)) {
      for (const requirement of child) {
        if (isObject(requirement)) Object.keys(requirement).forEach((name) => into.add(name));
      }
    }
    collectSecurityNames(child, into);
  }
}

function expectedReachableComponents(document) {
  const root = { ...document };
  delete root.components;
  const pending = new Set();
  const reachable = new Set();
  collectRefs(root, pending);
  while (pending.size) {
    const [ref] = pending;
    pending.delete(ref);
    if (reachable.has(ref)) continue;
    const target = resolveLocalRef(document, ref);
    if (target === undefined) throw new Error(`Dangling $ref: ${ref}`);
    reachable.add(ref);
    const nested = new Set();
    collectRefs(target, nested);
    nested.forEach((child) => {
      if (!reachable.has(child)) pending.add(child);
    });
  }
  return reachable;
}

function assertNoUnusedComponents(document) {
  const reachable = expectedReachableComponents(document);
  const securityNames = new Set();
  const root = { ...document };
  delete root.components;
  collectSecurityNames(root, securityNames);
  for (const [groupName, group] of Object.entries(document.components ?? {})) {
    if (!isObject(group)) continue;
    for (const name of Object.keys(group)) {
      const prefix = `#/components/${groupName}/${name}`;
      const used = [...reachable].some((ref) => ref === prefix || ref.startsWith(`${prefix}/`));
      const securityUsed = groupName === "securitySchemes" && securityNames.has(name);
      if (!used && !securityUsed) throw new Error(`Unused public component: ${prefix}`);
    }
  }
}

function actualOperations(document) {
  const operations = [];
  const operationIds = new Set();
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    if (!isObject(item)) continue;
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (!isObject(operation)) continue;
      if (typeof operation.operationId !== "string" || !operation.operationId) {
        throw new Error(`Missing operationId: ${method.toUpperCase()} ${path}`);
      }
      if (operationIds.has(operation.operationId)) {
        throw new Error(`Duplicate operationId: ${operation.operationId}`);
      }
      operationIds.add(operation.operationId);
      if (!Array.isArray(operation.security)) {
        throw new Error(`Operation lacks explicit security: ${operation.operationId}`);
      }
      if (operation.security.some((entry) => isObject(entry) && Object.keys(entry).length === 0)) {
        throw new Error(`Operation makes authentication optional: ${operation.operationId}`);
      }
      operations.push(`${method.toUpperCase()} ${path} ${operation.operationId}`);
    }
  }
  return operations.sort();
}

// Public upstream registry selectors are not private build provenance. Keep this list tied
// to reviewed named schema positions; an unrelated sourceCommit or example still refuses.
const PUBLIC_REGISTRY_SNAPSHOT_PROPERTY_PATHS = new Set([
  '$.components.schemas.AcquireRegistryItemRequest.properties.snapshot.properties',
  '$.components.schemas.AcquireRegistryItemResponse.properties.candidate.properties.snapshot.properties',
  '$.components.schemas.ExternalRegistryCandidate.properties.snapshot.properties',
  '$.components.schemas.GetRegistryAcquisitionResponse.properties.candidate.properties.snapshot.properties',
  '$.components.schemas.RefreshRegistrySnapshotRequest.properties.expectedSnapshot.anyOf[0].properties',
  '$.components.schemas.RefreshRegistrySnapshotResponse.properties.snapshot.properties',
  '$.components.schemas.RefreshRegistrySnapshotResponse.properties.previousSnapshot.anyOf[0].properties',
  '$.components.schemas.RegistrySearchResponse.properties.snapshot.properties',
  '$.components.schemas.RegistrySearchResponse.properties.items.items.properties.snapshot.properties',
]);
function isPublicUpstreamCommit(key, schema, siblings, path) {
  if (key !== 'sourceCommit' || !PUBLIC_REGISTRY_SNAPSHOT_PROPERTY_PATHS.has(path)) return false;
  if (!isObject(schema) || schema.type !== 'string' || schema.pattern !== '^[0-9a-f]{40}$') return false;
  if (Object.keys(schema).some(key => !['type', 'pattern'].includes(key))) return false;
  // Require the reviewed selector beside the commit, not a private field merely renamed into its slot.
  if (Object.keys(siblings).sort().join(',') !== 'cliArtifactSha256,inventorySha256,registryOrigin,sourceCommit') return false;
  return siblings.registryOrigin?.type === 'string' && siblings.registryOrigin.minLength === 1 && siblings.registryOrigin.maxLength === 2048 &&
    ['inventorySha256', 'cliArtifactSha256'].every(name => siblings[name]?.type === 'string' && siblings[name].pattern === '^[a-f0-9]{64}$');
}

function assertSafeStructure(value, path = "$") {
  if (Array.isArray(value)) {
    return value.forEach((child, index) => assertSafeStructure(child, `${path}[${index}]`));
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "x-internal") throw new Error(`Internal audience marker survived at ${path}`);
    if (key.startsWith("x-") && !ALLOWED_EXTENSIONS.has(key)) {
      throw new Error(`Unapproved extension at ${path}.${key}`);
    }
    if (FORBIDDEN_STRUCTURAL_KEYS.some((pattern) => pattern.test(key)) && !isPublicUpstreamCommit(key, child, value, path)) {
      throw new Error(`Private structural key at ${path}.${key}`);
    }
    assertSafeStructure(child, `${path}.${key}`);
  }
}

export function checkPublicOpenAPI(document, surface) {
  if (!isObject(document) || typeof document.openapi !== "string") {
    throw new Error("OpenAPI artifact is not a document");
  }
  if (!isObject(surface) || surface.schemaVersion !== 1 || !Array.isArray(surface.operations)) {
    throw new Error("Public surface manifest has an unsupported shape");
  }

  if (document.info?.license?.identifier !== "Apache-2.0") {
    throw new Error(
      "info.license.identifier must be Apache-2.0 (the private API's OpenAPI projection sets it)",
    );
  }

  const serverUrls = (document.servers ?? []).map((server) => server?.url);
  if (
    serverUrls.length !== ALLOWED_SERVERS.size ||
    serverUrls.some((url) => !ALLOWED_SERVERS.has(url))
  ) {
    throw new Error(`Unapproved OpenAPI servers: ${serverUrls.join(", ")}`);
  }

  const actual = actualOperations(document);
  const expected = [...surface.operations].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const actualSet = new Set(actual);
    const expectedSet = new Set(expected);
    const added = actual.filter((entry) => !expectedSet.has(entry));
    const removed = expected.filter((entry) => !actualSet.has(entry));
    throw new Error(
      `Public operation inventory drifted.` +
        `${added.length ? ` Added: ${added.join(", ")}.` : ""}` +
        `${removed.length ? ` Removed: ${removed.join(", ")}.` : ""}`,
    );
  }

  assertSafeStructure(document);
  assertNoUnusedComponents(document);
  return {
    operationCount: actual.length,
    pathCount: Object.keys(document.paths ?? {}).length,
    componentCount: Object.values(document.components ?? {}).reduce(
      (count, group) => count + (isObject(group) ? Object.keys(group).length : 0),
      0,
    ),
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const specPath = resolve(root, process.argv[2] ?? "api/openapi.json");
  const surfacePath = resolve(root, process.argv[3] ?? "api/public-surface.json");
  const legacyProvenance = resolve(root, "api/openapi.provenance.json");
  if (existsSync(legacyProvenance)) {
    throw new Error("Private source provenance must not ship in the public contract repository");
  }
  const result = checkPublicOpenAPI(
    JSON.parse(readFileSync(specPath, "utf8")),
    JSON.parse(readFileSync(surfacePath, "utf8")),
  );
  console.log(
    `Public OpenAPI check passed: ${result.operationCount} operations, ` +
      `${result.pathCount} paths, ${result.componentCount} reachable components.`,
  );
}
