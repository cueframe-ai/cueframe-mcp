import { describe, it, expect } from "vitest";
import { ApiError } from "./client";
import { adviseError } from "./errors";

function apiError(code: string, status = 422, message = "boom") {
  return new ApiError(status, { code, message });
}

describe("adviseError", () => {
  it("returns null for non-error values", () => {
    expect(adviseError(undefined)).toBeNull();
    expect(adviseError(null)).toBeNull();
    expect(adviseError("string")).toBeNull();
    expect(adviseError(42)).toBeNull();
  });

  it("returns null for plain Error (not an ApiError)", () => {
    expect(adviseError(new Error("network blew up"))).toBeNull();
  });

  it("returns null for unknown ApiError codes", () => {
    expect(adviseError(apiError("some_future_code"))).toBeNull();
  });

  it("advises on stale_etag pointing at details.currentEtag and the rebase flow", () => {
    const advice = adviseError(apiError("stale_etag", 409));
    expect(advice).toMatch(/currentEtag/);
    expect(advice).toMatch(/rebase|composition get/i);
  });

  it("advises on invalid_composition with invariant-name hints", () => {
    const advice = adviseError(apiError("invalid_composition", 422));
    expect(advice).toMatch(/invariant/);
    expect(advice).toMatch(/track_clips_overlap|clip_source_track_kind_mismatch/);
  });

  it("advises on clip_not_found pointing at `cueframe clips`", () => {
    const advice = adviseError(apiError("clip_not_found", 422));
    expect(advice).toMatch(/cueframe clips/);
  });

  it("advises on service_unavailable about retrying", () => {
    const advice = adviseError(apiError("service_unavailable", 503));
    expect(advice?.toLowerCase()).toMatch(/retry/);
  });

  it("advises on media_not_ready with retry guidance", () => {
    const advice = adviseError(apiError("media_not_ready", 422));
    expect(advice).toMatch(/processing/);
    expect(advice).toMatch(/transcribed|retry/);
  });

  it("advises on suggestions_already_complete with reset path", () => {
    const advice = adviseError(apiError("suggestions_already_complete", 409));
    expect(advice).toMatch(/DELETE.*\/v1\/media\/:id\/suggestions/);
  });

  it("advises on precondition_required with ETag fetch flow", () => {
    const advice = adviseError(apiError("precondition_required", 428));
    expect(advice).toMatch(/ETag/);
    expect(advice).toMatch(/If-Match/);
  });

  it("advises on conflict (ETag mismatch)", () => {
    const advice = adviseError(apiError("conflict", 409));
    expect(advice).toMatch(/ETag/);
  });

  it("advises on media_in_use pointing at projectIds / sessionIds", () => {
    const advice = adviseError(apiError("media_in_use", 422));
    expect(advice).toMatch(/projectIds/);
    expect(advice).toMatch(/sessionIds/);
  });

  it("advises on session_in_use pointing at projectIds", () => {
    const advice = adviseError(apiError("session_in_use", 422));
    expect(advice).toMatch(/projectIds/);
  });

  it("advises on render_not_cancellable about terminal state", () => {
    const advice = adviseError(apiError("render_not_cancellable", 422));
    expect(advice).toMatch(/terminal/);
  });

  it("advises on rate_limited about retry-after header", () => {
    const advice = adviseError(apiError("rate_limited", 429));
    expect(advice?.toLowerCase()).toMatch(/retry-after/);
  });
});
