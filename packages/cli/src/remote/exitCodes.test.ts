import { describe, it, expect } from "vitest";
import { ApiError } from "@cueframe/sdk";
import { ExitCode, exitCodeForError } from "./exitCodes";

function apiError(status: number, code = "boom") {
  return new ApiError(status, { code, message: "x" });
}

describe("exitCodeForError", () => {
  it("returns NetworkError for non-API exceptions", () => {
    expect(exitCodeForError(new Error("ECONNREFUSED"))).toBe(ExitCode.NetworkError);
    expect(exitCodeForError("oops")).toBe(ExitCode.NetworkError);
    expect(exitCodeForError(undefined)).toBe(ExitCode.NetworkError);
  });

  it("returns PaymentRequired for HTTP 402", () => {
    expect(exitCodeForError(apiError(402, "payment_required"))).toBe(
      ExitCode.PaymentRequired,
    );
  });

  it("returns ApiClientError for other 4xx (401, 403, 404, 409, 422, 428, 429)", () => {
    for (const status of [400, 401, 403, 404, 409, 422, 428, 429, 499]) {
      expect(exitCodeForError(apiError(status))).toBe(ExitCode.ApiClientError);
    }
  });

  it("returns ApiServerError for 5xx", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(exitCodeForError(apiError(status))).toBe(ExitCode.ApiServerError);
    }
  });

  it("exposes a stable numeric code map", () => {
    expect(ExitCode.Success).toBe(0);
    expect(ExitCode.UserError).toBe(2);
    expect(ExitCode.ApiClientError).toBe(3);
    expect(ExitCode.ApiServerError).toBe(4);
    expect(ExitCode.NetworkError).toBe(5);
    expect(ExitCode.PaymentRequired).toBe(6);
  });
});
