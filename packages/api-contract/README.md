# @cueframe/api-contract

The sanitized, versioned OpenAPI contract for CueFrame's public API. It is the
only supported input for generated SDK, CLI, and MCP clients, and the only copy
of the contract any consumer should read.

The package contains the public OpenAPI document, its reviewed operation
inventory, the scene-shot JSON Schema with its examples, and two manifests. It
intentionally excludes backend source provenance, storage identifiers, provider
names, and internal cost data.

```js
import { contractVersion, openApiSha256, operationCount } from "@cueframe/api-contract";
import openApi from "@cueframe/api-contract/openapi.json" with { type: "json" };
```

## One contract chain

```
private CueFrame API ──sync──▶ cueframe-ai/cueframe-mcp: api/*.json ──build──▶ @cueframe/api-contract@x.y.z ──▶ consumers
```

1. The private API projects its public surface and writes `api/openapi.json`,
   `api/scene-schema.json`, `api/scene-examples.json` and
   `api/contract-manifest.json` into this repository, from one kernel build.
   The manifest records the kernel version, the private commit and the sha256
   of each file as written.
2. This repository vendors the scene schema into `openapi.json` as named,
   depth-capped components (the sync's form carries `$ref`s a resolver cannot
   follow), regenerates the SDK from the result, and commits all of it.
   `api/public-surface.json`, the reviewed operation inventory, is maintained
   here.
3. `pnpm --filter @cueframe/api-contract build` copies the five `api/*.json`
   files into `dist/` as they are committed (so the vendored document; the
   build refuses the un-vendored form) and writes `manifest.json`, `index.js`
   and `index.d.ts`.
4. Everything else reads the npm package: the application repository's MCP
   tool, composition-op and scene-contract generators and their tests, and any
   third party. Nothing reads `api/` out of a second checkout.

## Contents and exports

| Subpath | File | What it is |
| --- | --- | --- |
| `.` | `dist/index.js`, `dist/index.d.ts` | Literal exports: `contractVersion`, `openApiSha256`, `operationCount`, `pathCount`, `componentCount`, `kernelVersion`, `privateCommit`, `syncedFiles`. |
| `./openapi.json` | `dist/openapi.json` | The public OpenAPI 3.1 document, scene schema vendored. |
| `./public-surface.json` | `dist/public-surface.json` | The reviewed operation inventory; the build fails when the document adds or removes an operation the inventory does not list. |
| `./scene-schema.json` | `dist/scene-schema.json` | The canonical scene-shot JSON Schema (`SceneShotSpecV2`), as the kernel generates it. |
| `./scene-examples.json` | `dist/scene-examples.json` | Worked scene-shot examples that validate against the schema. |
| `./contract-manifest.json` | `dist/contract-manifest.json` | The sync manifest as the private API wrote it (`kernelVersion`, `privateCommit`, per-file sha256 of the un-vendored inputs) plus `contractVersion`. |
| `./manifest.json` | `dist/manifest.json` | The build's manifest: `contractVersion`, the sha256 of the shipped `openapi.json`, operation/path/component counts, and the sync's fields. |
| `./package.json` | `package.json` | The package manifest; resolve it (`require.resolve("@cueframe/api-contract/package.json")`) to locate the installed package and read its version. |

`contractVersion` is the package version. Two installs that report the same
`contractVersion` carry the same bytes; a consumer that records it alongside
`privateCommit` in the headers of what it generates (the application
repository's MCP generators will, once they read this package instead of a
local copy) can tell a bumped pin from a regenerated tree.

## Version policy

- **The version moves with the contract.** Any byte change to one of the five
  shipped `api/*.json` files is a new version of this package, because every
  consumer reads the contract from npm and an npm version is immutable.
  `pnpm check:contract-version` (part of `pnpm check` and CI) fails a commit,
  pull request or working tree where `api/*.json` changed against the baseline
  and `packages/api-contract/package.json` did not: on `main` the baseline is
  the previous commit (`HEAD`, when the change is still uncommitted); on a
  branch it is the merge-base with `origin/main`; CI passes the pull request's
  base or the push's `before` commit.
- **Semver by consumer impact.** Patch: descriptions, examples, the inventory,
  additive non-breaking schema detail. Minor: new operations, new optional
  fields, new schema components. Major: an operation or field removed or
  renamed, a type narrowed, a required field added, or the scene schema changed
  incompatibly. The reviewed inventory (`public-surface.json`) is the
  checklist: an operation added or removed there is at least a minor.
- **A resync with unchanged content does not move the version.**
  `contract-manifest.json` carries `privateCommit`, but the private sync
  compares the three content files, their hashes, `kernelVersion` and
  `contractVersion` against the committed target and writes nothing when they
  are equal, so a sync run from a new private commit with identical content
  leaves the manifest (and its `privateCommit`) untouched. Only a contract
  change moves the version; when it does, the sync rewrites the manifest with
  the new stamp and the rule above applies.
- **The private sync may stamp the version.** When
  `api/contract-manifest.json` carries `contractVersion`, it names the package
  version the sync was run against; the check and the build both fail when it
  differs from `package.json`, so a stale sync cannot publish.
- Changes are recorded in the repository's `CHANGELOG.md` under
  `@cueframe/api-contract <version>`.

## License

Apache-2.0. The document is what the hosted API already serves to every caller.
