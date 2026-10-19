import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sdk from '@cueframe/sdk';
import type { RawResponse } from '@cueframe/sdk';
import * as sdkClient from '../remote/sdkClient.js';

vi.mock('./renderWatch.js', () => ({
  watchRender: vi.fn(async () => ({ kind: 'complete', outputUrl: 'https://r2/x.mp4', outputExpiresAt: '2099', duration: 1 })),
  downloadOutput: vi.fn(async (_url: string, out: string) => out),
}));

import { renderCommand } from './render';

type Opts = Parameters<typeof renderCommand>[1];
type Call = { url: string; init: RequestInit };

function fakeApi(etagResponse: Partial<RawResponse> | Error = { status: 200, headers: { etag: '"comp-v1"' } }) {
  const calls: Call[] = [];
  vi.spyOn(sdk, 'requestRaw').mockImplementation(async (url: string, init?: RequestInit): Promise<RawResponse> => {
    calls.push({ url, init: init ?? {} });
    if ((init?.method ?? 'GET') === 'GET') {
      if (etagResponse instanceof Error) throw etagResponse;
      return { status: 200, statusText: 'OK', headers: {}, body: {}, ...etagResponse } as RawResponse;
    }
    return { status: 202, statusText: 'Accepted', headers: {}, body: { id: 'rnd_12345678', status: 'queued' } };
  });
  return calls;
}

const posts = (calls: Call[]) => calls.filter((c) => c.init.method === 'POST');
const keyOf = (call: Call) => new Headers(call.init.headers as HeadersInit).get('idempotency-key');

async function run(opts: Partial<Opts>): Promise<number> {
  try {
    await renderCommand('proj_123', { target: 'prod', out: '/dev/null', ...opts });
  } catch (e) {
    if ((e as Error).message !== '__exit__') throw e;
  }
  const last = vi.mocked(process.exit).mock.calls.at(-1);
  return last === undefined ? 0 : (last[0] as number);
}

describe('renderCommand idempotency key and request body', () => {
  let stderr: string[];
  beforeEach(() => {
    stderr = [];
    vi.spyOn(sdkClient, 'initSdk').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('__exit__');
    }) as never);
    vi.spyOn(console, 'error').mockImplementation((s: unknown) => void stderr.push(String(s)));
    vi.spyOn(process.stderr, 'write').mockImplementation(((s: unknown) => {
      stderr.push(String(s));
      return true;
    }) as never);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a different aspect on the same composition derives a different key', async () => {
    const calls = fakeApi();
    expect(await run({ aspect: '9:16' })).toBe(0);
    expect(await run({ aspect: '16:9' })).toBe(0);
    const [a, b] = posts(calls).map(keyOf);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).not.toBe(a);
  });

  it('resolution, priority and intent each change the key', async () => {
    const calls = fakeApi();
    await run({ aspect: '9:16', resolution: 'fhd' });
    await run({ aspect: '9:16', resolution: '4k' });
    await run({ aspect: '9:16', resolution: 'fhd', priority: 'background' });
    await run({ aspect: '9:16', resolution: 'fhd', intent: 'preview' });
    expect(new Set(posts(calls).map(keyOf)).size).toBe(4);
  });

  it('the same request on the same composition derives the same key', async () => {
    const calls = fakeApi();
    await run({ aspect: '9:16', resolution: '4k', intent: 'final' });
    await run({ intent: 'final', resolution: '4k', aspect: '9:16' });
    const [a, b] = posts(calls).map(keyOf);
    expect(b).toBe(a);
  });

  it('a failed ETag read stops the render instead of keying on a constant', async () => {
    const calls = fakeApi({ status: 500, statusText: 'Internal Server Error', body: { error: { code: 'internal', message: 'boom' } } });
    const code = await run({ aspect: '9:16' });
    expect(code).not.toBe(0);
    expect(posts(calls)).toHaveLength(0);
    expect(stderr.join('')).toMatch(/ETag/);
  });

  it('a network failure on the ETag read stops the render', async () => {
    const calls = fakeApi(new TypeError('fetch failed'));
    expect(await run({})).not.toBe(0);
    expect(posts(calls)).toHaveLength(0);
  });

  it('an explicit --idempotency-key skips the ETag read', async () => {
    const calls = fakeApi(new TypeError('fetch failed'));
    expect(await run({ idempotencyKey: 'my-key' })).toBe(0);
    expect(calls).toHaveLength(1);
    expect(keyOf(posts(calls)[0])).toBe('my-key');
  });

  it('sends only the format fields the user passed', async () => {
    const calls = fakeApi();
    await run({ aspect: '4:5' });
    await run({});
    const [withAspect, bare] = posts(calls).map((c) => JSON.parse(c.init.body as string));
    expect(withAspect).toEqual({ format: { aspectRatio: '4:5' } });
    expect(bare).toEqual({});
  });

  it('--resolution or --fps without --aspect is a usage error', async () => {
    const calls = fakeApi();
    expect(await run({ resolution: '4k' })).toBe(2);
    expect(await run({ fps: 60 })).toBe(2);
    expect(calls).toHaveLength(0);
  });
});
