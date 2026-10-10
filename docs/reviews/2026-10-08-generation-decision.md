# Generation decision — 2026-10-08

Technical recommendation: retain the existing hosted MCP runtime and its operation-registry generator for this release. Continue using Orval 8.33.0 for the public SDK's fetch client and Zod schemas. Do not add an Orval MCP server target to this repository.

## Public release boundary

This repository publishes the plugin, skills, registry files and four toolkit packages: `@cueframe/api-contract`, `@cueframe/sdk`, `@cueframe/skills` and `cueframe`. The MCP runtime is maintained in the application repository and is not distributed here. The product connection is `https://api.cueframe.ai/v1/mcp`; `glama/` is an introspection-only discovery shim that executes no tools.

The public generation chain already removes duplicated client and schema maintenance. `generate:api-consumers` verifies input provenance, vendors the scene schema and builds the contract package before running Orval. `orval.config.ts` reads that freshly built contract package, generates fetch clients through the hand-written request mutator, and generates strict-body Zod schemas. Contract versions and generated drift have separate checks. No public MCP implementation would be removed by enabling a third Orval target.

## Why retain

The September 30 comparison recorded in CUE-657 successfully generated an Orval MCP candidate, but did not establish behavioral compatibility. It found differences in tool names, argument nesting, optional query inputs, path escaping, annotations, response shaping and MCP SDK imports. The existing curated tools, resources, prompts and executor integration would still need to be retained or adapted. There is no measured net reduction in maintained code after those adapters.

The [official Orval MCP guide](https://orval.dev/docs/guides/mcp/), reviewed October 8, describes generation of an HTTP client, handlers, server and tool schemas in single mode. It offers custom handler/server hooks and forwards cancellation. Those features make a future integration possible; they do not prove compatibility with CueFrame's supported tool surface. The guide is current documentation, not a new runtime test of the pinned 8.33.0 candidate.

Adoption evidence remains insufficient: the earlier candidate had syntax and focused schema/URL probes, but no full typecheck, equivalent in-process compatibility suite or authenticated end-to-end run. This decision requires none of those migration experiments because it retains the supported implementation and adds no candidate runtime.

## Runtime follow-up and release gating

CUE-657 also identifies required-body validation and cancellation propagation defects in the application runtime. Read-only inspection during this review reconfirmed both findings in the available application checkout; it did not establish the state of the deployed hosted service. Fixing them belongs to that runtime, with tests for required versus optional bodies, cancellation reaching network execution and aborts avoiding retries. Retaining the generator does not resolve those defects or close CUE-657's implementation acceptance criteria.

This document records the technical adopt-or-retain recommendation for the public repository. The two runtime fixes remain tracked independently: CUE-657 explicitly states that they do not block plugin distribution generation. CUE-217 also names a generation review before publication; the release issue must record how this recommendation resolves that gate. This review does not authorize publication or certify unrelated release gates, npm availability, registry verification or hosted runtime behavior.

## Evidence and validation limits

Public baseline reviewed: `f682b0cd2c229beb414ce8eb2a7634055904539b`. The current OpenAPI document has 136 operations and the contract package is version 2.1.0; the earlier 122-operation candidate is historical evidence, not proof of current coverage. `createProject` still declares a required request body in this contract. Evidence includes `package.json`, `pnpm-workspace.yaml`, `orval.config.ts`, the contract package build script, `README.md` and the discovery shim. No runtime implementation was copied into this repository, and no migration was made.

Release validation must run `pnpm check`, `pnpm build` and `pnpm test` in that order, plus generated-consumer drift verification. The release review records those results separately; this document is an architectural decision, not a replacement for the checks.
