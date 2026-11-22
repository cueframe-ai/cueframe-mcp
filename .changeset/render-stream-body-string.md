---
"@cueframe/api-contract": major
"@cueframe/sdk": minor
"cueframe": patch
---

Describe the render status stream body as the raw `text/event-stream` string again (sync with private 885f60b6e). The per-event `progress`, `complete` and `error` schema moves to the `x-sse-events` extension on that response. `renders.streamRender()` returns `Promise<string>` again, and the `StreamRender200` type is removed. For parsed events, use `iterRenderEvents()`.

The same sync removes `getReviewPacket` (`GET /v1/review/{id}`) and `recordReviewDecision` (`POST /v1/review/{id}/decision`), with their `ReviewPacketResponse` and `ReviewDecisionResponse` types. A signed-in organization member now decides a hosted review gate on the console review page; API credentials cannot answer one.
