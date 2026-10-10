# Changelog

One entry per package per release. Versions follow each package's `package.json`.

## @cueframe/api-contract 2.0.1

- Preserve the current hosted API's payment metadata and 402 responses on the four template-job operations while retaining the reviewed component V3 schemas and full operation inventory. Regenerate from the reviewed canonical private source with clean commit provenance.

## @cueframe/sdk 0.4.1

- Regenerate from the corrected 2.0.1 contract. Client identity and transport configuration are unchanged.

## @cueframe/api-contract 2.0.0

- Breaking schema release: component and seeded-graphics unions admit explicit V3 executions and placement instead of assuming every item carries `primitiveId` or the older component source fields. Component list/source responses and template documents now expose the canonical versioned shapes; callers must branch on their explicit protocol/version/kind and use the generated 0.4 SDK validators. Existing REST operation names are preserved.
- Publish component V3 definitions, typed execution parameters, the `component.repin-v3` composition operation, concurrency and dependency-read metadata, library presentation, and version 2 template visual-media inputs from the canonical private API projection. Preserve `ErrorEnvelope.error.contractVersion` and the existing reviewed route inventory.
- Contract manifest schema version 2 records a recoverable private source snapshot for a working-tree projection, including base commit, source inventory, patch, untracked source, and lockfile digests. Contract builds verify input hashes before packaging and preserve this provenance in the published manifests.

## @cueframe/sdk 0.4.0

- Regenerate TypeScript models and Zod schemas from the 2.0.0 contract, including component V3 repinning and exact execution/library response shapes.

## @cueframe/skills 0.1.1

- The skills and the plugin move into this repository from `cueframe-ai/cueframe-skills`, which is archived: one public repository now holds the plugin, the toolkit and the registry files. Root `skills/` is the single source; this package is a build-time copy of it (`packages/skills/dist/skills`), so `SKILLS_DIR` now resolves inside `dist/`. Skill content is identical to 0.1.0.
- The tarball ships `dist/skills`, `skills-dir.js`, `skills-dir.d.ts`, README, LICENSE and NOTICE only. The plugin manifests, hooks, rules and assets that 0.1.0 packed are read by hosts from the repository, not from npm, and are no longer in the package.
- Install lines become `claude plugin marketplace add cueframe-ai/cueframe-mcp` / `codex plugin marketplace add cueframe-ai/cueframe-mcp` / `npx skills add cueframe-ai/cueframe-mcp`; the plugin manifests carry this package's version.

## @cueframe/api-contract 1.1.0

- Error envelopes carry `contractVersion`: `ErrorEnvelope.error` gains a required string naming the published `@cueframe/api-contract` version the server implements, beside the existing `contract` (the kernel version). A client compares it with the `contractVersion` of the package it was generated from; a higher value means the server has moved ahead of the client's document. Additive for every existing client: `oasdiff breaking` from the 1.0.0 document reports none (889 informational `response-required-property-added`). No operation added or removed.
- Synced from private commit `3cc1faae5`; `openapi.json` sha256 `78eef676…`. The private sync now stamps `contractVersion` into `contract-manifest.json` (the last key, so `dist/contract-manifest.json` is byte-identical to `api/contract-manifest.json`) and leaves the manifest untouched when the content hashes equal the committed ones, so a resync with unchanged content no longer forces a version.

## @cueframe/sdk 0.3.1

- Regenerated from the 1.1.0 contract: the `ErrorEnvelopeError` type and the `ErrorEnvelope` zod schema gain the required `contractVersion` field. No hand-written code changed.

## @cueframe/api-contract 1.0.0

- First publish. The public OpenAPI document, the reviewed operation inventory (`public-surface.json`), the scene schema and examples, and a content-addressed manifest that records the kernel version and the private sync's commit.
- This package is the one contract chain: private API → the `api/` directory of this repository → this package on npm → every consumer (the application repository's MCP generators and tests, third parties). Nothing reads `api/` from a second repository.
- `contractVersion` (equal to the package version) is stamped into `contract-manifest.json`, `manifest.json` and exported from the index; the version moves whenever any of the five shipped `api/*.json` files changes (`pnpm check:contract-version` enforces it). The build ships the vendored `openapi.json` and refuses the sync's un-vendored form.
- License: Apache-2.0.

## @cueframe/sdk 0.3.0

- New `@cueframe/sdk/client-identity` export: the client identity header the CLI and MCP server send.
- License changed to Apache-2.0.

## cueframe 0.5.0

- `cueframe install` writes the agent skills from the `@cueframe/skills` package; the skills are maintained in `cueframe-ai/cueframe-skills` and copied at build time.
- `--target` accepts `prod` (default) and `local`; `CUEFRAME_API_URL` overrides the host.
- License changed to Apache-2.0.
