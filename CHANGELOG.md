# Changelog

One entry per package per release. Versions follow each package's `package.json`.

## @cueframe/api-contract 4.0.0

Breaking schema release, synced from private 0a430db with kernel 0.6.0. The contract now embeds the kernel's own OpenAPI components verbatim, and the build ships `openapi.json` exactly as synced. The toolkit's scene-schema vendoring step is retired.

- `Composition` is the full kernel shape and is strict: unknown top-level keys are refused. `ownerOrgId`, `acl`, `licenseVerification` and `sourceSuggestionId` are `readOnly`. Only the server sets them.
- `FormatSpec` is renamed `Format`. The `SceneFormat` and `TransitionSpec` components are removed, and every format references `Format`.
- Kernel-owned components, now published as the kernel defines them: `CompositionOp` (with `clip.setKeyframes`; `applyMotionPreset` is retired), `TimelineClip` (a track entry is a `TimelineClip` or a gap), `ComponentExecutionRef` (execution versions 3 and 4), `ComponentParameterValue`, `CompositionConcurrency` and `ErrorEnvelope`.
- `SceneShotSpecV2` is the kernel's recursive schema with `SceneShotSpecV2Schema0`/`SceneShotSpecV2Schema1`. The depth-capped `SceneShotSpecV2LayerDepth0`–`4` and `SceneShotSpecV2JsonValue` are removed. The API still enforces the group-depth limit of 4.
- Component create, update and patch take native (version 4) sources only: `{version: 4, componentId, template, manifest, definition}`. Version-3 TSX sources can no longer be written. Component source reads (snapshots) still return version 3 or version 4.
- A component clip source may be retired: `execution` and `placement` are optional there, and an open `retired` record marks a clip from before the native cutover, with its props kept. Saves and renders refuse such clips with `component_source_retired`.
- The composition read (`getComposition`) answers `needsUpgrade: CompositionUpgradeNeed[]` (`{clipId, kind: 'unpinned-component' | 'v3-component' | 'retired-primitive', componentId?, sourceVersionId?, primitiveId?, successorComponentId?, successorSourceVersionId?}`) only when such clips remain.
- New operation `repinComponent` (`POST /v1/projects/{id}/components/native-upgrade`) moves retired TSX component clips to their native successors.
- `POST /v1/projects/{id}/composition/from-suggestion` (`composeFromSuggestion`) documents its 200 body as the new `CompositionFromSuggestionResponse`. Its `notes` (`BriefNote[]`) name what the brief asked for that the composition does not carry.

## @cueframe/sdk 0.7.0

Generated from contract 4.0.0. Breaking:

- `FormatSpec`, `FormatSpecFps` and `FormatSpecResolution` are removed with no alias: use `Format`, `FormatFps` and `FormatResolution`. The `SceneFormat*`, `CompositionFormat*`, `TransitionSpec*`, `SceneShotSpecV2LayerDepth*` and `SceneShotSpecV2JsonValue` models are removed. The new models include `TimelineClip*`, `ComponentExecutionRef`, `ComponentManifestV4*`, `SceneShotSpecV2Schema0/1` and `NativeUpgrade*`.
- Component create, update and patch source types and validators are native (version 4) only. Source read models remain a version-3 | version-4 union.
- `@cueframe/sdk/zod` no longer exports response validators. All 274 response exports are gone: every `<OperationId>Response`/`<operationId>Response`, their `*ResponseItem` companions, and the `consult`/`deriveComposition`/`health`/`whoami` `*ResponseSchema` aliases. The 56 `<operationId>Body` schemas are unchanged. Importing the module now retains about 10.5 MiB instead of 15.5 MiB. The TypeScript response types are unchanged.
- The scene body schema now accepts any group nesting depth on the client. The API refuses nesting deeper than 4.
- New `components.repinComponent` client function.
- `clips.composeFromSuggestion` resolves to the new `CompositionFromSuggestionResponse` (with `BriefNote` notes) instead of `void`.

## cueframe 0.8.2

- `cueframe new component` scaffolds a native (version 4) source: `template.html` and `definition.json`, with a version-4 manifest in `cueframe.json`. It no longer writes `index.tsx` and `config.ts`.
- `cueframe push` and `cueframe sync` send that native source, checked against the contract's source schema. A workspace component that still has only a version-3 `index.tsx` is refused as `component_source_retired` before any API call. The server already refuses version-3 authoring.
- Builds against `@cueframe/sdk` 0.7.0, with `FormatFps`/`FormatResolution` replacing the removed `FormatSpec*` types.

## @cueframe/skills 0.3.0

The skills now match contract 4.0.0. The plugin manifests carry the same version.

- The retired `applyMotionPreset` op is gone from every skill. Cards animate in their CSS (`--cf-enter`/`--cf-exit`) or with `clip.setKeyframes`, and anything beyond one channel is a native component (`create_component`). A policy test fails any skill that names an op missing from the contract's `CompositionOp`.
- `cueframe-component-authoring` and `cueframe-cli` teach native (version 4) component sources: a template, a definition and a version-4 manifest. Version-3 TSX sources are retired.
- `cueframe-component-authoring` gains "Upgrading an old project": read `get_composition`'s `needsUpgrade`, repin entries that have a successor with `repin_component`, and re-author the rest in place.

## @cueframe/api-contract 3.0.1

- Regenerated against kernel 0.5.2 (private 670cac8). `TemplateMediaValue`'s URL arm declares `format: "uri"` instead of the invalid `starts_with`. Operations are unchanged.

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
