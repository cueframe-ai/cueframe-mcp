# Discover and insert an exact builtin

Use the hosted MCP tools in this order. The CLI reaches the same REST operations
through `cueframe api ... --json`; read `cueframe describe --json` for its current
request options. Use the selected environment consistently.

1. Call `list_catalog` with `projection: "component-library"`, `origin: "builtin"`,
   `limit: 10` and a search term. Follow the returned cursor for more results.
2. Preserve the selected card's complete identity, including collection, id and
   revision. Call `resolve_builtin_component` with that exact identity. For a
   preset or recipe, retain the returned `documentSha256` and canonical document.
   A definition is source material, not a whole insertable package.
3. Read the target with `get_composition`, negotiating component execution 3 and
   dependencies. Keep its revision and brand identity. Do not recreate the project.
4. Call `apply_template` with `template` equal to the selected builtin id. Put
   projectId, documentSha256, insert, values, media and concurrency witnesses
   inside `body`, following the live tool schema. Use an explicit nonnegative
   `insert.startTime` and a unique `insert.idPrefix`; the package keeps its
   authored placement offsets. Select pinned samples explicitly for every media slot you intend to use:
   `media: { image1: { sample: true }, image2: { sample: true } }` (continue
   for all declared slots), or bind real media IDs. Missing required bindings
   are refused; samples are never selected implicitly.
5. Read back the composition. Check that existing clips remain, every package
   placement exists at its intended offset, and exact source pins are retained.
6. Preview the affected interval, then use `create_render` and wait for the actual
   artifact. Inspect the produced video; a successful request alone is not render
   evidence.

Never replace a selected revision with the latest, switch its scope, refresh a
stale concurrency witness silently, synthesize replacement wrapper source, or
use a thumbnail as the package. A pinned sample failure identifies the slot;
report it or bind an explicit replacement instead of accepting changed bytes.

The executable request examples beside this guide are validated against the
MCP introspection snapshot generated from the server package.

CLI discovery uses the same contract:

```sh
cueframe api GET '/v1/components?projection=component-library&origin=builtin&q=wheel&limit=10' --target dev --json
cueframe api GET '/v1/components/builtin/resolve?collection=curated-looks&id=builtin%3Areference-component-wheel-full&revision=OBSERVED_REVISION' --target dev --json
cueframe api POST '/v1/templates/builtin%3Areference-component-wheel-full/apply' --body @insertion.json --target dev --json
```

Replace `OBSERVED_REVISION` with the returned card revision. `insertion.json`
contains the `body` object from the MCP example with real observed identifiers
and witnesses. The fixture digest identifies the reviewed Wheel document; use the live resolved
digest and observed brand identity instead of copying example witnesses. A 202 means pinned media preparation is pending: repeat the same
insertion command after the response's retry delay, retaining `commandId`.
