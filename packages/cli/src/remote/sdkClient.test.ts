import { afterEach, describe, it, expect, vi } from "vitest";
import { ApiError, requestRaw } from "@cueframe/sdk";
import { CLIENT_HEADER, osFromNodePlatform, parseClientHeader } from "@cueframe/sdk/client-identity";
import { formatError, initSdk } from "./sdkClient";

declare const __CLI_VERSION__: string;

describe("the CLI names itself on every request", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CUEFRAME_API_KEY;
    delete process.env.CUEFRAME_API_URL;
  });

  it("sends surface, version and OS alongside the key", async () => {
    process.env.CUEFRAME_API_KEY = "cf_test_abcdefgh";
    process.env.CUEFRAME_API_URL = "https://api.example";
    let sent: Headers | null = null;
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      sent = new Headers(init.headers);
      return new Response("{}", { headers: { "content-type": "application/json" } });
    });

    initSdk("prod");
    await requestRaw("/v1/profile", { method: "GET" });

    expect(parseClientHeader(sent!.get(CLIENT_HEADER))).toEqual({
      surface: "cli",
      version: __CLI_VERSION__,
      os: osFromNodePlatform(process.platform),
    });
  });
});

describe("formatError", () => {
  it("formats ApiError as `<message> (<code>, <status>)`", () => {
    const err = new ApiError(404, { code: "not_found", message: "no such project" });
    expect(formatError(err)).toBe(
      "no such project (not_found, 404)\n  → No such resource in this org (cross-org access also reads as 404). Check the id, or enumerate with the matching list command/tool.",
    );
  });

  it("appends actionable advice on a known error code", () => {
    const err = new ApiError(422, {
      code: "media_not_ready",
      message: "Media item is still processing",
    });
    const out = formatError(err);
    expect(out).toMatch(/Media item is still processing \(media_not_ready, 422\)/);
    expect(out).toMatch(/\n  → /);
    expect(out).toMatch(/processing/);
  });

  it("does not append advice for unknown codes", () => {
    const err = new ApiError(422, { code: "some_future_code", message: "bad" });
    expect(formatError(err)).toBe("bad (some_future_code, 422)");
  });

  it("formats a plain Error without advice", () => {
    expect(formatError(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-Error values", () => {
    expect(formatError("plain string")).toBe("plain string");
    expect(formatError(42)).toBe("42");
  });
});
