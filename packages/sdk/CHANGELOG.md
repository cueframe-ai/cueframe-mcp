# @cueframe/sdk

## 0.19.0

### Minor Changes

- 957c25c: Sync the contract against released kernel 0.10.0. Each `setCaptionStyle` style field now also accepts `null`, which clears that field. Captions gain `lingerMs`, which sets how long a caption page stays after its last word (0 to 2000 ms). The caption plate and the bounded caption style fields are now documented.

## 0.18.0

### Minor Changes

- 351ba96: Describe the render status stream body as the raw `text/event-stream` string again (sync with private 885f60b6e). The per-event `progress`, `complete` and `error` schema moves to the `x-sse-events` extension on that response. `renders.streamRender()` returns `Promise<string>` again, and the `StreamRender200` type is removed. For parsed events, use `iterRenderEvents()`.

  The same sync removes `getReviewPacket` (`GET /v1/review/{id}`) and `recordReviewDecision` (`POST /v1/review/{id}/decision`), with their `ReviewPacketResponse` and `ReviewDecisionResponse` types. A signed-in organization member now decides a hosted review gate on the console review page; API credentials cannot answer one.

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
