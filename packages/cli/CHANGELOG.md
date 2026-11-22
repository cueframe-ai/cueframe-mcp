# cueframe

## 0.12.4

### Patch Changes

- 351ba96: Describe the render status stream body as the raw `text/event-stream` string again (sync with private 885f60b6e). The per-event `progress`, `complete` and `error` schema moves to the `x-sse-events` extension on that response. `renders.streamRender()` returns `Promise<string>` again, and the `StreamRender200` type is removed. For parsed events, use `iterRenderEvents()`.

  The same sync removes `getReviewPacket` (`GET /v1/review/{id}`) and `recordReviewDecision` (`POST /v1/review/{id}/decision`), with their `ReviewPacketResponse` and `ReviewDecisionResponse` types. A signed-in organization member now decides a hosted review gate on the console review page; API credentials cannot answer one.

## 0.12.3

### Patch Changes

- 22df810: Document the 409 conflict response on DELETE /v1/briefs/{id} (sync with private main).

## 0.12.2

### Patch Changes

- ab47317: Sync the public OpenAPI projection with private main (ccd3894df): API boundary error shapes and validation details.

## 0.12.1

### Patch Changes

- 7c78ca9: Refresh compatible CLI dependencies and SDK generation, and correct hosted skill guidance to use the served tool catalog.
