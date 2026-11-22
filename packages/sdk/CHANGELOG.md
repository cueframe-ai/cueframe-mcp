# @cueframe/sdk

## 0.17.4

### Patch Changes

- 22df810: Document the 409 conflict response on DELETE /v1/briefs/{id} (sync with private main).

## 0.17.3

### Patch Changes

- ab47317: Sync the public OpenAPI projection with private main (ccd3894df): API boundary error shapes and validation details.

  This release also changed generated types. Migrate as follows:

  - `BrandKitResponseExtraColorsItem`: `name` is now `label` and `value` is now `hex`, with an optional `usage`. The API has returned `hex`/`label` since before this release; the earlier types were wrong.
  - `ComposeSessionOpenRequest.seedComposition` must be a JSON object. The type and the Zod validator no longer accept any other value.
  - `renders.streamRender()` was declared as `Promise<StreamRender200>`, one parsed `{event, data}` object, but it has always resolved to the raw `text/event-stream` text. Treat the result as a string, or use `iterRenderEvents()` for parsed events. A later release restores the `Promise<string>` type.

## 0.17.2

### Patch Changes

- 7c78ca9: Refresh compatible CLI dependencies and SDK generation, and correct hosted skill guidance to use the served tool catalog.
