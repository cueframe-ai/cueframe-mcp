
import { ApiError, getClientConfig } from "./client";

export type RenderEventName = "progress" | "complete" | "error";

export interface ProgressFrame {
  phase: string;
  percent: number;
  scenesTotal?: number;
  scenesCompleted?: number;
}

export interface CompleteFrame {
  outputUrl: string | null;
  outputExpiresAt: string | null;
  duration: number | null;
}

export interface ErrorFrame {
  message: string;
}

export type RenderEvent =
  | { event: "progress"; data: ProgressFrame }
  | { event: "complete"; data: CompleteFrame }
  | { event: "error"; data: ErrorFrame };

export type ComposeEventName =
  | "job_started"
  | "candidate_phase_started"
  | "winner_selected"
  | "job_completed"
  | "job_failed";

export type ComposeEvent = {
  event: ComposeEventName;
  data: Record<string, unknown>;
  timestamp: number;
};

interface IterOptions {
  signal?: AbortSignal;
}

interface RawFrame {
  event: string | null;
  data: string | null;
}

async function* iterSseFrames(
  path: string,
  callerName: string,
  options: IterOptions,
): AsyncGenerator<RawFrame, void, void> {
  const cfg = getClientConfig();
  if (!cfg?.baseUrl) {
    throw new Error(
      `@cueframe/sdk: createClient({baseUrl}) must be called before ${callerName}.`,
    );
  }
  const url = cfg.baseUrl.replace(/\/$/, "") + path;

  const headers = new Headers({
    accept: "text/event-stream",
    ...(cfg.headers ?? {}),
  });
  if (cfg.apiKey && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${cfg.apiKey}`);
  }

  const doFetch = cfg.fetch ?? fetch;
  const res = await doFetch(url, {
    method: "GET",
    headers,
    signal: options.signal,
  });

  if (!res.ok) {
    let body: { code: string; message: string };
    try {
      const json = (await res.json()) as { error?: typeof body };
      body = json.error ?? { code: "unknown", message: res.statusText };
    } catch {
      body = { code: "unknown", message: res.statusText };
    }
    throw new ApiError(res.status, body, res.headers.get("x-request-id") ?? undefined);
  }

  if (!res.body) {
    throw new Error("SSE response has no body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const frame = splitFrame(raw);
        if (frame) yield frame;
        sep = buffer.indexOf("\n\n");
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
    }
  }
}

function splitFrame(raw: string): RawFrame | null {
  if (!raw.trim()) return null;

  let event: string | null = null;
  const dataLines: string[] = [];

  for (const line of raw.split("\n")) {
    if (!line || line.startsWith(":")) continue; // comment / keep-alive
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const field = line.slice(0, colon);
    const value = line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") dataLines.push(value);
  }

  if (!event || dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

export async function* iterRenderEvents(
  projectId: string,
  renderId: string,
  options: IterOptions = {},
): AsyncGenerator<RenderEvent, void, void> {
  const path = `/v1/projects/${encodeURIComponent(projectId)}/renders/${encodeURIComponent(renderId)}/stream`;
  for await (const frame of iterSseFrames(path, "iterRenderEvents", options)) {
    const parsed = parseRenderFrame(frame);
    if (parsed) yield parsed;
  }
}

function parseRenderFrame(frame: RawFrame): RenderEvent | null {
  const { event, data } = frame;
  if (data === null) return null;
  if (event !== "progress" && event !== "complete" && event !== "error") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  return { event, data: parsed } as RenderEvent;
}

const COMPOSE_EVENT_NAMES: ReadonlySet<string> = new Set<ComposeEventName>([
  "job_started",
  "candidate_phase_started",
  "winner_selected",
  "job_completed",
  "job_failed",
]);

export async function* iterComposeEvents(
  projectId: string,
  composeJobId: string,
  options: IterOptions = {},
): AsyncGenerator<ComposeEvent, void, void> {
  const path = `/v1/projects/${encodeURIComponent(projectId)}/compose/jobs/${encodeURIComponent(composeJobId)}/stream`;
  for await (const frame of iterSseFrames(path, "iterComposeEvents", options)) {
    const parsed = parseComposeFrame(frame);
    if (parsed) yield parsed;
  }
}

function parseComposeFrame(frame: RawFrame): ComposeEvent | null {
  if (frame.event !== "compose_event" || frame.data === null) return null;

  let inner: unknown;
  try {
    inner = JSON.parse(frame.data);
  } catch {
    return null;
  }

  if (typeof inner !== "object" || inner === null) return null;
  const obj = inner as { event?: unknown; data?: unknown; timestamp?: unknown };
  if (typeof obj.event !== "string" || !COMPOSE_EVENT_NAMES.has(obj.event)) return null;

  return {
    event: obj.event as ComposeEventName,
    data: (typeof obj.data === "object" && obj.data !== null
      ? (obj.data as Record<string, unknown>)
      : {}),
    timestamp: typeof obj.timestamp === "number" ? obj.timestamp : 0,
  };
}
