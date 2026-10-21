import { ApiError, requestRaw } from "./client";
import { getGetCompositionUrl } from "./generated/compositions/compositions";
import { COMPONENT_EXECUTION_VERSIONS } from "./generated/executionVersions";
import type { CompositionReadResponse, GetCompositionParams } from "./generated/models";

// Composition writes name the revision they were based on: `if_match` in a body, `If-Match` on a header.
// A write with none is refused 428 precondition_required; a stale one 409 stale_etag.

export type CompositionRevision = { composition: CompositionReadResponse; etag: string };

/** The comparable form of an ETag header: weak (`W/`) and compression (`-gzip`) markers removed. */
export function normalizeEtag(etag: string): string {
  return etag.replace(/^W\//, "").replace(/-gzip(?=("?)$)/, "");
}

/**
 * Reads a composition with the ETag every revision-guarded write takes. Returns null when the project
 * has no composition yet: create it with `If-None-Match: *` instead of an `If-Match`.
 */
export async function readCompositionRevision(
  projectId: string,
  params: GetCompositionParams = {},
  init: RequestInit = {},
): Promise<CompositionRevision | null> {
  const accepted = COMPONENT_EXECUTION_VERSIONS.map(String) as GetCompositionParams["componentExecutionVersions"];
  const query: GetCompositionParams = { componentExecutionVersions: accepted, ...params };
  const raw = await requestRaw(getGetCompositionUrl(projectId, query), { ...init, method: "GET" });
  // A named composition or session that is missing is an error, not an empty project.
  const targeted = params.compositionId !== undefined || "session_id" in params;
  if (raw.status === 404 && !targeted) return null;
  if (raw.status >= 400) {
    const wire = (raw.body as { error?: { code: string; message: string; details?: Record<string, unknown> } } | null)?.error;
    throw new ApiError(raw.status, wire ?? { code: "unknown", message: raw.statusText }, raw.requestId);
  }
  const etag = raw.headers["etag"];
  if (!etag) {
    throw new ApiError(502, { code: "etag_missing", message: "The composition read returned no ETag, so no write can name its revision." }, raw.requestId);
  }
  return { composition: raw.body as CompositionReadResponse, etag: normalizeEtag(etag) };
}
