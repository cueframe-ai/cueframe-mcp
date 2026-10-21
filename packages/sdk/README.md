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
- **Zod request schemas.** `@cueframe/sdk/zod` exports one `<operationId>Body`
  schema per bodied operation, derived from the same contract — validate a
  payload before you send it (the MCP tool layer binds these). Responses are
  typed via the generated models; they are not runtime-parsed.
- **Error envelope typed end-to-end.** Non-2xx throws `ApiError` with
  `{status, code, details, requestId}` matching the server's `ErrorEnvelope`;
  `adviseError` maps known codes to next-step guidance.

## Install and authenticate

Requires Node.js 24 or newer. Install the public package:

```bash
npm install @cueframe/sdk
```

Create an API key in [your CueFrame account](https://app.cueframe.ai) and set `CUEFRAME_API_KEY` in your server environment. Keep it out of browser bundles.

Save this as `account.mjs` and run `node account.mjs`:

```js
import { account, createClient } from "@cueframe/sdk";

if (!process.env.CUEFRAME_API_KEY) throw new Error("Set CUEFRAME_API_KEY");
createClient({
  baseUrl: "https://api.cueframe.ai",
  apiKey: process.env.CUEFRAME_API_KEY,
});

const result = await account.getAccount();
console.log(result.plan, result.entitlements);
```

The base URL is the bare host; generated paths already include `/v1`. This read-only call checks authentication and account entitlements before paid work. Rendering and cloud processing consume credits; see [cloud rates](https://cueframe.ai/pricing).

## Create a project

```js
import { projects } from "@cueframe/sdk";

// After createClient above:
const project = await projects.createProject({
  name: "launch-video",
  format: { aspectRatio: "16:9", fps: 30, resolution: "hd" },
});
console.log(project.id);
```

For import → composition → render, see the [complete render example](../../examples/render-a-clip). For a REST workflow with downloadable source and rendered output, see the [API walkthrough](https://cueframe.ai/api). The [API reference](https://docs.cueframe.ai/docs/api) documents request fields and job states; the [public contract package](../api-contract) supplies OpenAPI for other languages.

Operations are grouped by OpenAPI tag — one namespace export per tag from the
package root (`projects`, `media`, `compositions`, `renders`, `jobs`,
`account`, `brandKits`, …). Low-level access: `request<T>(path, init)` for
typed calls; `requestRaw(path, init)` when you need status and headers (e.g.
reading an `ETag` to thread into a subsequent `If-Match`).

### Composition revisions

Every committing composition write names the revision it edits, or the server answers
`428 precondition_required`. Read it first:

```ts
import { compositions, readCompositionRevision } from "@cueframe/sdk";

const current = await readCompositionRevision(projectId); // null when the project has none yet
await compositions.applyComposition(projectId, { if_match: current!.etag, ops });
await compositions.putComposition(projectId, body, { headers: current ? { "If-Match": current.etag } : { "If-None-Match": "*" } });
```

A `409 stale_etag` means someone saved since your read: read again and redo the edit.
