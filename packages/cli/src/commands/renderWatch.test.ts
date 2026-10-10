import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@cueframe/sdk';
import { watchRender } from './renderWatch';


interface FakeFetchOpts {
  sseFrames?: string[][];
  sseStatus?: (callIdx: number) => number;
  poll?: () => unknown;
  pollStatus?: number;
}

function setupFakeFetch(opts: FakeFetchOpts) {
  let sseCalls = 0;
  let pollCalls = 0;
  const fetchFn: typeof fetch = (async (url: string | URL | Request) => {
    const u = typeof url === 'string' ? url : url.toString();
    if (u.includes('/stream')) {
      const idx = sseCalls++;
      const status = opts.sseStatus ? opts.sseStatus(idx) : 200;
      if (status >= 400) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'no render' } }),
          { status, headers: { 'content-type': 'application/json' } },
        );
      }
      const frames = opts.sseFrames?.[idx] ?? [];
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const enc = new TextEncoder();
          for (const f of frames) controller.enqueue(enc.encode(f));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }
    pollCalls++;
    return new Response(JSON.stringify(opts.poll?.() ?? {}), {
      status: opts.pollStatus ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fetchFn, getCalls: () => ({ sse: sseCalls, poll: pollCalls }) };
}

describe('watchRender', () => {
  beforeEach(() => {
    createClient({ baseUrl: 'https://api.test', apiKey: 'cf_test_x' });
  });

  it('returns complete payload when SSE emits a complete frame', async () => {
    const { fetchFn } = setupFakeFetch({
      sseFrames: [
        [
          'event: progress\ndata: {"phase":"queued","percent":0}\n\n',
          'event: progress\ndata: {"phase":"encoding","percent":0.5}\n\n',
          'event: complete\ndata: {"outputUrl":"https://r2/x.mp4","outputExpiresAt":"2099","duration":12.5}\n\n',
        ],
      ],
    });
    createClient({ baseUrl: 'https://api.test', apiKey: 'cf_test_x', fetch: fetchFn });

    const r = await watchRender('proj', 'ren', { timeoutMs: 5_000 });
    expect(r).toEqual({
      kind: 'complete',
      outputUrl: 'https://r2/x.mp4',
      outputExpiresAt: '2099',
      duration: 12.5,
    });
  });

  it('returns failed payload on SSE error frame', async () => {
    const { fetchFn } = setupFakeFetch({
      sseFrames: [
        [
          'event: error\ndata: {"message":"render driver crashed"}\n\n',
        ],
      ],
    });
    createClient({ baseUrl: 'https://api.test', apiKey: 'cf_test_x', fetch: fetchFn });

    const r = await watchRender('proj', 'ren', { timeoutMs: 5_000 });
    expect(r).toEqual({ kind: 'failed', message: 'render driver crashed' });
  });

  it('falls back to GET polling when SSE returns an ApiError', async () => {
    const { fetchFn, getCalls } = setupFakeFetch({
      sseStatus: () => 404,
      poll: () => ({
        id: 'ren',
        status: 'complete',
        outputUrl: 'https://r2/poll.mp4',
      }),
    });
    createClient({ baseUrl: 'https://api.test', apiKey: 'cf_test_x', fetch: fetchFn });

    const r = await watchRender('proj', 'ren', { timeoutMs: 10_000 });
    expect(r.kind).toBe('complete');
    expect((r as { outputUrl: string }).outputUrl).toBe('https://r2/poll.mp4');
    const calls = getCalls();
    expect(calls.sse).toBeGreaterThanOrEqual(1);
    expect(calls.poll).toBeGreaterThanOrEqual(1);
  });

  it('reconnects when SSE closes without a terminal frame', async () => {
    const { fetchFn, getCalls } = setupFakeFetch({
      sseFrames: [
        ['event: progress\ndata: {"phase":"encoding","percent":0.6}\n\n'],
        ['event: complete\ndata: {"outputUrl":"u","outputExpiresAt":null,"duration":null}\n\n'],
      ],
    });
    createClient({ baseUrl: 'https://api.test', apiKey: 'cf_test_x', fetch: fetchFn });

    const r = await watchRender('proj', 'ren', { timeoutMs: 10_000 });
    expect(r.kind).toBe('complete');
    expect(getCalls().sse).toBe(2);
  });

  it('gives up after 5 consecutive transport failures instead of hanging to the deadline', async () => {
    let attempts = 0;
    const fetchFn = (async () => {
      attempts++;
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    createClient({ baseUrl: 'https://api.test', apiKey: 'cf_test_x', fetch: fetchFn });

    await expect(
      watchRender('proj', 'ren', { timeoutMs: 30 * 60 * 1000, reconnectBackoffMs: 0 }),
    ).rejects.toThrow(/5 consecutive transport failures.*ECONNREFUSED/s);
    expect(attempts).toBe(5);
  });

  it('a delivered frame resets the transport-failure counter', async () => {
    let attempts = 0;
    const fetchFn = (async () => {
      attempts++;
      if (attempts === 5) {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'event: complete\ndata: {"outputUrl":"u","outputExpiresAt":null,"duration":null}\n\n',
              ),
            );
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    createClient({ baseUrl: 'https://api.test', apiKey: 'cf_test_x', fetch: fetchFn });

    const r = await watchRender('proj', 'ren', { timeoutMs: 60_000, reconnectBackoffMs: 0 });
    expect(r.kind).toBe('complete');
  });

  it('times out when no terminal state is reached before deadline', async () => {
    const { fetchFn } = setupFakeFetch({
      sseFrames: [],
      sseStatus: () => 200,
    });
    createClient({ baseUrl: 'https://api.test', apiKey: 'cf_test_x', fetch: fetchFn });

    const start = Date.now();
    const r = await watchRender('proj', 'ren', { timeoutMs: 1_500 });
    const elapsed = Date.now() - start;
    expect(r.kind).toBe('failed');
    expect((r as { message: string }).message).toMatch(/Timed out/);
    expect(elapsed).toBeGreaterThanOrEqual(1_500);
  });
});
