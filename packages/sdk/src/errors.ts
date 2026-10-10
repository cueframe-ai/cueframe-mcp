
import { ApiError } from "./client";

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "precondition_required"
  | "stale_etag"
  | "media_not_ready"
  | "suggestions_already_complete"
  | "media_in_use"
  | "session_in_use"
  | "render_not_cancellable"
  | "invalid_composition"
  | "clip_not_found"
  | "service_unavailable"
  | "payment_required"
  | "rate_limited";

const ERROR_ADVICE: Partial<Record<ApiErrorCode, string>> = {
  // These two are read by MCP agents as often as by CLI users (the MCP
  // server appends them verbatim), so they name the remedy, not one
  // transport's spelling of it — a CLI command handed to an agent that has no
  // shell is a dead end, and routing an MCP caller back to the CLI contradicts
  // the MCP-first surface (CUE-15 P0).
  unauthorized:
    "The credential is invalid or expired for this target, or it belongs to a different environment. Re-authenticate the way you connected: reconnect the MCP server, run `cueframe login` in a terminal, or supply a current API key.",
  forbidden:
    "The credential's permissions don't cover this operation. The server message above names the exact missing ones and the `permissions` body that grants them; a key's permissions are fixed at creation, so this needs a NEW key, not a change to this one.",
  not_found:
    "No such resource in this org (cross-org access also reads as 404). Check the id, or enumerate with the matching list command/tool.",
  media_not_ready:
    "Media is still processing. Wait for the `media.transcribed` webhook or retry after ~30s.",
  suggestions_already_complete:
    "Suggestions already exist for this media item. To re-run, call DELETE /v1/media/:id/suggestions first to reset state.",
  precondition_required:
    "Fetch the resource with GET first to obtain its ETag, then resend the write with `If-Match: <etag>`. `cueframe composition get` returns one for you.",
  stale_etag:
    "Resource was modified since your last GET — `details.currentEtag` is the value to thread next. Re-GET (or run `cueframe composition get`) and rebase your edits before retrying.",
  conflict:
    "ETag mismatch — the resource was modified since your last GET. Re-fetch and merge before retrying.",
  media_in_use:
    "Media is referenced by other resources. See `details.projectIds` and `details.sessionIds` — remove those references before deleting.",
  session_in_use:
    "Session is referenced by a composition. See `details.projectIds` — remove those references before deleting.",
  render_not_cancellable:
    "Render is already in a terminal state (complete / error / cancelled) and cannot be cancelled.",
  rate_limited:
    "Rate limit exceeded. Back off using the `retry-after` response header.",
  invalid_composition:
    "Composition violates an invariant (see `details`). Common ones: clip_source_track_kind_mismatch, track_clips_overlap, transition_no_predecessor.",
  clip_not_found:
    "The clip suggestion publicId doesn't exist in this org. Run `cueframe clips <mediaItemId>` to enumerate valid sug_* ids.",
  service_unavailable:
    "The processing pipeline is temporarily unavailable. Retry shortly; if it persists, contact support@cueframe.ai with the requestId.",
  payment_required:
    "The request exceeds a billing limit. For generation, the estimated cost is over the per-call ceiling (see `details.estimateUsd` / `details.ceilingUsd`) — lower the requested duration or raise the ceiling.",
};

export function adviseError(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  return ERROR_ADVICE[err.code as ApiErrorCode] ?? null;
}
