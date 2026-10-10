import { describe, it, expect, beforeEach } from "vitest";
import { createClient, ApiError } from "./client";
import {
  iterRenderEvents,
  iterComposeEvents,
  type RenderEvent,
  type ComposeEvent,
} from "./sse";

function sseFetch(chunks: string[], status = 200, errorBody?: unknown): typeof fetch {
  return (async () => {
    if (status >= 400) {
      return new Response(JSON.stringify(errorBody ?? { error: { code: "x", message: "y" } }), {
        status,
        headers: { "content-type": "application/json" },
      });
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        for (const c of chunks) controller.enqueue(enc.encode(c));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }) as unknown as typeof fetch;
}

async function collect(iter: AsyncIterable<RenderEvent>): Promise<RenderEvent[]> {
  const out: RenderEvent[] = [];
  for await (const e of iter) out.push(e);
  return out;
}

describe("iterRenderEvents", () => {
  beforeEach(() => {
    createClient({ baseUrl: "https://api.test", apiKey: "cf_test_xyz" });
  });

  it("yields decoded progress / complete frames in order", async () => {
    createClient({
      baseUrl: "https://api.test",
      apiKey: "cf_test_xyz",
      fetch: sseFetch([
        'event: progress\ndata: {"phase":"queued","percent":0}\n\n',
        'event: progress\ndata: {"phase":"encoding","percent":0.5,"scenesTotal":4,"scenesCompleted":2}\n\n',
        'event: complete\ndata: {"outputUrl":"https://r2/x.mp4","outputExpiresAt":"2099","duration":60}\n\n',
      ]),
    });

    const events = await collect(iterRenderEvents("proj_1", "ren_1"));
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ event: "progress", data: { phase: "queued", percent: 0 } });
    expect(events[1].event).toBe("progress");
    expect(events[2]).toEqual({
      event: "complete",
      data: { outputUrl: "https://r2/x.mp4", outputExpiresAt: "2099", duration: 60 },
    });
  });

  it("reassembles frames split across chunk boundaries", async () => {
    createClient({
      baseUrl: "https://api.test",
      fetch: sseFetch([
        'event: progress\nda',
        'ta: {"phase":"encoding"',
        ',"percent":0.7}\n\nevent: comple',
        'te\ndata: {"outputUrl":null,"outputExpiresAt":null,"duration":null}\n\n',
      ]),
    });

    const events = await collect(iterRenderEvents("p", "r"));
    expect(events.map((e) => e.event)).toEqual(["progress", "complete"]);
    expect((events[0] as { data: { percent: number } }).data.percent).toBe(0.7);
  });

  it("yields an `error` frame and stops cleanly", async () => {
    createClient({
      baseUrl: "https://api.test",
      fetch: sseFetch([
        'event: progress\ndata: {"phase":"encoding","percent":0.1}\n\n',
        'event: error\ndata: {"message":"render failed"}\n\n',
      ]),
    });

    const events = await collect(iterRenderEvents("p", "r"));
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual({ event: "error", data: { message: "render failed" } });
  });

  it("ignores keep-alive comments and unknown event names", async () => {
    createClient({
      baseUrl: "https://api.test",
      fetch: sseFetch([
        ': keepalive\n\n',
        'event: ping\ndata: {}\n\n',
        'event: complete\ndata: {"outputUrl":"u","outputExpiresAt":null,"duration":null}\n\n',
      ]),
    });

    const events = await collect(iterRenderEvents("p", "r"));
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("complete");
  });

  it("throws ApiError on non-2xx upstream response", async () => {
    createClient({
      baseUrl: "https://api.test",
      fetch: sseFetch([], 404, { error: { code: "not_found", message: "no render" } }),
    });
    await expect(collect(iterRenderEvents("p", "missing"))).rejects.toBeInstanceOf(ApiError);
  });

  it("forwards Authorization: Bearer when apiKey is configured", async () => {
    let captured: Headers | null = null;
    createClient({
      baseUrl: "https://api.test",
      apiKey: "cf_live_secret",
      fetch: ((url: string, init?: RequestInit) => {
        captured = new Headers(init?.headers);
        return sseFetch(['event: progress\ndata: {"phase":"queued","percent":0}\n\n'])(url, init);
      }) as typeof fetch,
    });
    await collect(iterRenderEvents("p", "r"));
    expect(captured!.get("authorization")).toBe("Bearer cf_live_secret");
    expect(captured!.get("accept")).toBe("text/event-stream");
  });
});

async function collectCompose(iter: AsyncIterable<ComposeEvent>): Promise<ComposeEvent[]> {
  const out: ComposeEvent[] = [];
  for await (const e of iter) out.push(e);
  return out;
}

function composeFrame(inner: { event: string; data: unknown; timestamp: number }): string {
  return `event: compose_event\ndata: ${JSON.stringify(inner)}\n\n`;
}

describe("iterComposeEvents", () => {
  beforeEach(() => {
    createClient({ baseUrl: "https://api.test", apiKey: "cf_test_xyz" });
  });

  it("unwraps compose_event frames and yields the inner events in order", async () => {
    createClient({
      baseUrl: "https://api.test",
      apiKey: "cf_test_xyz",
      fetch: sseFetch([
        composeFrame({ event: "job_started", data: { candidates: 3 }, timestamp: 1 }),
        composeFrame({
          event: "candidate_phase_started",
          data: { phase: "authoring" },
          timestamp: 2,
        }),
        composeFrame({
          event: "winner_selected",
          data: { candidateId: "cand_2", composite: 7.15 },
          timestamp: 3,
        }),
        composeFrame({ event: "job_completed", data: { winnerId: "cand_2" }, timestamp: 4 }),
      ]),
    });

    const events = await collectCompose(iterComposeEvents("proj_1", "cj_1"));
    expect(events.map((e) => e.event)).toEqual([
      "job_started",
      "candidate_phase_started",
      "winner_selected",
      "job_completed",
    ]);
    expect(events[0].timestamp).toBe(1);
    expect((events[2].data as { composite: number }).composite).toBe(7.15);
  });

  it("hits the compose stream path /compose/jobs/<id>/stream", async () => {
    let captured = "";
    createClient({
      baseUrl: "https://api.test",
      apiKey: "cf_test_xyz",
      fetch: ((url: string, init?: RequestInit) => {
        captured = url;
        return sseFetch([composeFrame({ event: "job_completed", data: {}, timestamp: 1 })])(
          url,
          init,
        );
      }) as typeof fetch,
    });
    await collectCompose(iterComposeEvents("proj_1", "cj_1"));
    expect(captured).toContain("/v1/projects/proj_1/compose/jobs/cj_1/stream");
  });

  it("reassembles compose frames split across chunk boundaries", async () => {
    const frame = composeFrame({ event: "job_completed", data: { ok: true }, timestamp: 9 });
    const mid = Math.floor(frame.length / 2);
    createClient({
      baseUrl: "https://api.test",
      fetch: sseFetch([frame.slice(0, mid), frame.slice(mid)]),
    });

    const events = await collectCompose(iterComposeEvents("p", "c"));
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("job_completed");
  });

  it("yields a job_failed terminal frame", async () => {
    createClient({
      baseUrl: "https://api.test",
      fetch: sseFetch([
        composeFrame({ event: "job_started", data: {}, timestamp: 1 }),
        composeFrame({ event: "job_failed", data: { reason: "stream_failed" }, timestamp: 2 }),
      ]),
    });

    const events = await collectCompose(iterComposeEvents("p", "c"));
    expect(events).toHaveLength(2);
    expect(events[1].event).toBe("job_failed");
    expect((events[1].data as { reason: string }).reason).toBe("stream_failed");
  });

  it("ignores keep-alive comments", async () => {
    createClient({
      baseUrl: "https://api.test",
      fetch: sseFetch([
        ": keepalive\n\n",
        composeFrame({ event: "job_completed", data: {}, timestamp: 1 }),
      ]),
    });

    const events = await collectCompose(iterComposeEvents("p", "c"));
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("job_completed");
  });

  it("throws ApiError on non-2xx upstream response", async () => {
    createClient({
      baseUrl: "https://api.test",
      fetch: sseFetch([], 404, { error: { code: "not_found", message: "no job" } }),
    });
    await expect(collectCompose(iterComposeEvents("p", "missing"))).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
