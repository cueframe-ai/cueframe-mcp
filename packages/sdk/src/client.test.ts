import { describe, expect, it } from "vitest";
import { ApiError, NetworkError, TimeoutError, createClient, request, requestRaw } from "./client";

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  return ((url: string, init: RequestInit = {}) =>
    Promise.resolve(handler(url, init))) as typeof fetch;
}

describe("requestRaw", () => {
  it("returns status, statusText, headers (lower-cased), and parsed body", async () => {
    createClient({
      baseUrl: "https://api.example/v1",
      fetch: mockFetch((url) => {
        expect(url).toBe("https://api.example/v1/things");
        return new Response(JSON.stringify({ hello: "world" }), {
          status: 200,
          statusText: "OK",
          headers: {
            "content-type": "application/json",
            ETag: '"abc"',
            "x-request-id": "req_1",
          },
        });
      }),
    });

    const raw = await requestRaw("/things");
    expect(raw.status).toBe(200);
    expect(raw.statusText).toBe("OK");
    expect(raw.headers["etag"]).toBe('"abc"');
    expect(raw.headers["x-request-id"]).toBe("req_1");
    expect(raw.body).toEqual({ hello: "world" });
    expect(raw.requestId).toBe("req_1");
  });

  it("returns null body and 204 status without throwing", async () => {
    createClient({
      baseUrl: "https://api.example/v1",
      fetch: mockFetch(() => new Response(null, { status: 204 })),
    });
    const raw = await requestRaw("/things/1", { method: "DELETE" });
    expect(raw.status).toBe(204);
    expect(raw.body).toBeNull();
  });

  it("returns the structured error envelope WITHOUT throwing on 4xx", async () => {
    createClient({
      baseUrl: "https://api.example/v1",
      fetch: mockFetch(
        () =>
          new Response(
            JSON.stringify({ error: { code: "stale_etag", message: "ETag mismatch" } }),
            {
              status: 409,
              statusText: "Conflict",
              headers: { "content-type": "application/json", ETag: '"newer"' },
            },
          ),
      ),
    });
    const raw = await requestRaw("/composition", { method: "PUT" });
    expect(raw.status).toBe(409);
    expect(raw.headers["etag"]).toBe('"newer"');
    expect(raw.body).toEqual({ error: { code: "stale_etag", message: "ETag mismatch" } });
  });

  it("returns raw text for non-JSON content types", async () => {
    createClient({
      baseUrl: "https://api.example/v1",
      fetch: mockFetch(
        () =>
          new Response("not json", {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      ),
    });
    const raw = await requestRaw("/text");
    expect(raw.body).toBe("not json");
  });

  it("attaches Bearer auth from clientConfig.apiKey", async () => {
    let captured = "";
    createClient({
      baseUrl: "https://api.example/v1",
      apiKey: "cf_test_xyz",
      fetch: mockFetch((_url, init) => {
        const h = new Headers(init.headers);
        captured = h.get("authorization") ?? "";
        return new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    });
    await requestRaw("/whoami");
    expect(captured).toBe("Bearer cf_test_xyz");
  });
});

describe("request (typed wrapper) preserves prior contract", () => {
  it("throws ApiError on 4xx with structured envelope", async () => {
    createClient({
      baseUrl: "https://api.example/v1",
      fetch: mockFetch(
        () =>
          new Response(
            JSON.stringify({ error: { code: "stale_etag", message: "ETag mismatch" } }),
            {
              status: 409,
              statusText: "Conflict",
              headers: { "content-type": "application/json", "x-request-id": "req_42" },
            },
          ),
      ),
    });
    await expect(request("/composition", { method: "PUT" })).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      code: "stale_etag",
      requestId: "req_42",
    });
  });

  it("returns undefined for 204", async () => {
    createClient({
      baseUrl: "https://api.example/v1",
      fetch: mockFetch(() => new Response(null, { status: 204 })),
    });
    const out = await request("/things/1", { method: "DELETE" });
    expect(out).toBeUndefined();
  });

  it("returns parsed JSON for 2xx", async () => {
    createClient({
      baseUrl: "https://api.example/v1",
      fetch: mockFetch(
        () =>
          new Response(JSON.stringify({ a: 1 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    });
    const out = await request<{ a: number }>("/things");
    expect(out).toEqual({ a: 1 });
  });

  it("falls back to a generic ApiError shape on unparseable error bodies", async () => {
    createClient({
      baseUrl: "https://api.example/v1",
      fetch: mockFetch(
        () =>
          new Response("oops not json", {
            status: 500,
            statusText: "Internal Server Error",
            headers: { "content-type": "text/plain" },
          }),
      ),
    });
    await expect(request("/x")).rejects.toMatchObject({
      status: 500,
      code: "unknown",
    });
  });
});

describe("ApiError shape", () => {
  it("carries status, code, details, requestId", () => {
    const e = new ApiError(422, { code: "x", message: "y", details: { z: 1 } }, "req");
    expect(e.status).toBe(422);
    expect(e.code).toBe("x");
    expect(e.message).toBe("y");
    expect(e.details).toEqual({ z: 1 });
    expect(e.requestId).toBe("req");
  });
});

describe("transport failure typing (the boundary the CLI renders)", () => {
  it("wraps a fetch rejection in NetworkError carrying url + cause", async () => {
    const boom = new TypeError("fetch failed");
    createClient({
      baseUrl: "https://api.test",
      fetch: (() => Promise.reject(boom)) as typeof fetch,
    });
    const err = await requestRaw("/v1/projects").catch((e) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.message).toContain("https://api.test/v1/projects");
    expect(err.cause).toBe(boom);
  });

  it("the SDK timeout fires as TimeoutError and covers the BODY read, not just headers", async () => {
    createClient({
      baseUrl: "https://api.test",
      timeoutMs: 30,
      fetch: (((_url: string, init: RequestInit) =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                init.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
              },
            }),
            { status: 200, headers: { "content-type": "text/plain" } },
          ),
        )) as unknown) as typeof fetch,
    });
    const err = await requestRaw("/v1/slow").catch((e) => e);
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.timeoutMs).toBe(30);
  });

  it("a caller-supplied abort re-throws untouched (their AbortError semantics survive)", async () => {
    const callerAbort = new AbortController();
    createClient({
      baseUrl: "https://api.test",
      fetch: (((_url: string, init: RequestInit) =>
        new Promise((_res, rej) => {
          init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
        })) as unknown) as typeof fetch,
    });
    const p = requestRaw("/v1/x", { signal: callerAbort.signal }).catch((e) => e);
    callerAbort.abort();
    const err = await p;
    expect(err).not.toBeInstanceOf(NetworkError);
    expect(err).not.toBeInstanceOf(TimeoutError);
    expect(err.name).toBe("AbortError");
  });
});
