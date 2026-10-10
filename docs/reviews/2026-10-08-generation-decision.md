# Generation decision — 2026-10-08

Technical recommendation: retain the existing hosted MCP runtime and its operation-registry generator for this release. Continue using Orval 8.33.0 for the public SDK's fetch client and Zod schemas. Do not add an Orval MCP server target to this repository.

## Public release boundary

This repository publishes the plugin, skills, registry files and four toolkit packages: `@cueframe/api-contract`, `@cueframe/sdk`, `@cueframe/skills` and `cueframe`. The MCP runtime is maintained in the application repository and is not distributed here. The product connection is `https://api.cueframe.ai/v1/mcp`; `glama/` is an introspection-only discovery shim that executes no tools.

The public generation chain already removes duplicated client and schema maintenance. `generate:api-consumers` verifies input provenance, vendors the scene schema and builds the contract package before running Orval. `orval.config.ts` reads that freshly built contract package, generates fetch clients through the hand-written request mutator, and generates strict-body Zod schemas. Contract versions and generated drift have separate checks. No public MCP implementation would be removed by enabling a third Orval target.

## Why retain

The September 30 generation comparison successfully generated an Orval MCP candidate, but did not establish behavioral compatibility. It found differences in tool names, argument nesting, optional query inputs, path escaping, annotations, response shaping and MCP SDK imports. The existing curated tools, resources, prompts and executor integration would still need to be retained or adapted. There is no measured net reduction in maintained code after those adapters.

The [official Orval MCP guide](https://orval.dev/docs/guides/mcp/), reviewed October 8, describes generation of an HTTP client, handlers, server and tool schemas in single mode. It offers custom handler/server hooks and forwards cancellation. Those features make a future integration possible; they do not prove compatibility with CueFrame's supported tool surface. The guide is current documentation, not a new runtime test of the pinned 8.33.0 candidate.

Adoption evidence remains insufficient: the earlier candidate had syntax and focused schema/URL probes, but no full typecheck, equivalent in-process compatibility suite or authenticated end-to-end run. This decision requires none of those migration experiments because it retains the supported implementation and adds no candidate runtime.

## Evidence and validation limits

This document records the October 8 architectural review. Package versions and contract coverage can change; use the current package manifests and operation inventory. The earlier 122-operation candidate is historical evidence, not proof of current coverage. `createProject` still declares a required request body in this contract. Evidence includes `package.json`, `pnpm-workspace.yaml`, `orval.config.ts`, the contract package build script, `README.md` and the discovery shim. No runtime implementation was copied into this repository, and no migration was made.

Release validation must run `pnpm check`, `pnpm build` and `pnpm test` in that order, plus generated-consumer drift verification. The release review records those results separately; this document is an architectural decision, not a replacement for the checks.
