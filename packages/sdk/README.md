# @cueframe/sdk

Typed TypeScript SDK for the CueFrame REST API.

**Generated.** Every file under `src/generated/` is emitted by Orval from the
OpenAPI contract (`api/openapi.json` in this repository) and checked for drift
during release. Do not hand-edit. The
hand-written surface is `client.ts` (fetch mutator), `errors.ts`, and `sse.ts`
(streaming helpers).

## Design

- **Fetch-based, no framework binding.** Runs in Node 24+, Deno, edge
  runtimes, and the browser.
- **Zod request schemas.** `bodySchemas` exports one `<operationId>Body`
  schema per bodied operation, derived from the same contract — validate a
  payload before you send it (the MCP tool layer binds these). Responses are
  typed via the generated models; they are not runtime-parsed.
- **Error envelope typed end-to-end.** Non-2xx throws `ApiError` with
  `{status, code, details, requestId}` matching the server's `ErrorEnvelope`;
  `adviseError` maps known codes to next-step guidance.

## Usage

```ts
import { createClient, projects, iterRenderEvents } from "@cueframe/sdk";

// Module-level config — call once at startup. baseUrl is the bare host:
// the generated operation paths already carry the /v1 prefix.
createClient({
  baseUrl: "https://api.cueframe.ai",
  apiKey: process.env.CUEFRAME_API_KEY,
});

const project = await projects.createProject({ name: "launch-video" });

// ... apply a composition, then create a render and stream its progress:
for await (const ev of iterRenderEvents(project.id, renderId)) {
  if (ev.event === "complete") console.log(ev.data.outputUrl);
}
```

Operations are grouped by OpenAPI tag — one namespace export per tag from the
package root (`projects`, `media`, `compositions`, `renders`, `jobs`,
`account`, `brandKits`, …). Low-level access: `request<T>(path, init)` for
typed calls; `requestRaw(path, init)` when you need status and headers (e.g.
reading an `ETag` to thread into a subsequent `If-Match`).
