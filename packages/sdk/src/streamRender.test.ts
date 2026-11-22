import { describe, expect, expectTypeOf, it } from "vitest";
import { createClient, renders } from "./index";

// The stream response schema describes the whole body, so a per-event schema there would type this as one parsed event.
describe("renders.streamRender", () => {
  it("is typed and returned as the raw text/event-stream body", async () => {
    const body = 'event: progress\ndata: {"phase":"encoding","percent":0.5}\n\nevent: complete\ndata: {"outputUrl":null,"outputExpiresAt":null,"duration":null}\n\n';
    createClient({
      baseUrl: "https://api.example/v1",
      fetch: (() => Promise.resolve(new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }))) as typeof fetch,
    });

    const result = await renders.streamRender("prj_1", "rnd_1");

    expectTypeOf(renders.streamRender).returns.resolves.toEqualTypeOf<string>();
    expect(result).toBe(body);
  });
});
