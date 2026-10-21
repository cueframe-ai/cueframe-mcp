import { describe, expect, it } from "vitest";
import { ApiError, createClient } from "./client";
import { normalizeEtag, readCompositionRevision } from "./revision";

function serve(status: number, headers: Record<string, string>, body: unknown, seen: string[] = []) {
  createClient({
    baseUrl: "https://api.example",
    fetch: ((url: string) => {
      seen.push(url);
      return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } }));
    }) as typeof fetch,
  });
  return seen;
}

describe("readCompositionRevision", () => {
  it("returns the composition with its normalized ETag, accepting every execution version", async () => {
    const seen = serve(200, { etag: 'W/"v7-gzip"' }, { tracks: [] });
    const revision = await readCompositionRevision("proj_1", { compositionId: "c_2" });
    expect(revision).toEqual({ composition: { tracks: [] }, etag: '"v7"' });
    expect(seen[0]).toBe("https://api.example/v1/projects/proj_1/composition?componentExecutionVersions=3&componentExecutionVersions=4&compositionId=c_2");
  });

  it("returns null for a project with no composition, so the caller creates with If-None-Match: *", async () => {
    serve(404, {}, { error: { code: "not_found", message: "no composition" } });
    expect(await readCompositionRevision("proj_1")).toBeNull();
  });

  it("throws when a named composition is missing, or when the read carries no ETag", async () => {
    serve(404, {}, { error: { code: "not_found", message: "no such composition" } });
    await expect(readCompositionRevision("proj_1", { compositionId: "c_9" })).rejects.toMatchObject({ status: 404, code: "not_found" });
    serve(200, {}, { tracks: [] });
    await expect(readCompositionRevision("proj_1")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("normalizeEtag", () => {
  it("drops the weak and compression markers and keeps a strong tag as is", () => {
    expect(normalizeEtag('W/"abc"')).toBe('"abc"');
    expect(normalizeEtag('"abc-gzip"')).toBe('"abc"');
    expect(normalizeEtag('"abc"')).toBe('"abc"');
  });
});
