
export type ClientConfig = {
  baseUrl: string;
  apiKey?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

type ApiErrorShape = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;

  constructor(status: number, body: ApiErrorShape, requestId?: string) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.requestId = requestId;
  }
}

export class TimeoutError extends Error {
  readonly url: string;
  readonly timeoutMs: number;

  constructor(url: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms: ${url}`);
    this.name = "TimeoutError";
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

export class NetworkError extends Error {
  readonly url: string;

  constructor(url: string, cause: unknown) {
    super(`Request failed before a response: ${url}`, { cause });
    this.name = "NetworkError";
    this.url = url;
  }
}

let clientConfig: ClientConfig = { baseUrl: "" };

export function createClient(cfg: ClientConfig): ClientConfig {
  clientConfig = { timeoutMs: 30_000, ...cfg };
  return clientConfig;
}

export function getClientConfig(): ClientConfig {
  return clientConfig;
}

function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return base.replace(/\/$/, "") + (path.startsWith("/") ? path : `/${path}`);
}

export type RawResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  requestId?: string;
};

export async function requestRaw(
  url: string,
  init: RequestInit = {},
): Promise<RawResponse> {
  if (!clientConfig.baseUrl) {
    throw new Error(
      "@cueframe/sdk: createClient({baseUrl}) must be called before issuing requests.",
    );
  }
  const doFetch = clientConfig.fetch ?? fetch;
  const finalUrl = joinUrl(clientConfig.baseUrl, url);

  const merged = new Headers({ accept: "application/json" });
  for (const [k, v] of Object.entries(clientConfig.headers ?? {})) merged.set(k, v);
  if (init.headers) new Headers(init.headers).forEach((v, k) => merged.set(k, v));
  if (clientConfig.apiKey && !merged.has("authorization")) {
    merged.set("authorization", `Bearer ${clientConfig.apiKey}`);
  }

  const timeoutMs = clientConfig.timeoutMs ?? 30_000;
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, ac.signal]) : ac.signal;

  try {
    const res = await doFetch(finalUrl, { ...init, headers: merged, signal });

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    let body: unknown = null;
    if (res.status !== 204) {
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        try {
          body = await res.json();
        } catch {
          body = null;
        }
      } else {
        body = await res.text();
      }
    }

    return {
      status: res.status,
      statusText: res.statusText,
      headers,
      body,
      requestId: headers["x-request-id"],
    };
  } catch (e) {
    if (init.signal?.aborted) throw e;
    if (ac.signal.aborted) throw new TimeoutError(finalUrl, timeoutMs);
    throw new NetworkError(finalUrl, e);
  } finally {
    clearTimeout(timeout);
  }
}

export async function request<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const raw = await requestRaw(url, init);

  if (raw.status >= 400) {
    let errBody: ApiErrorShape;
    if (raw.body && typeof raw.body === "object" && "error" in raw.body) {
      const wrapper = raw.body as { error?: ApiErrorShape };
      errBody = wrapper.error ?? { code: "unknown", message: raw.statusText };
    } else {
      errBody = { code: "unknown", message: raw.statusText };
    }
    throw new ApiError(raw.status, errBody, raw.requestId);
  }

  if (raw.status === 204) return undefined as T;
  return raw.body as T;
}
