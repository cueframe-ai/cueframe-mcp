import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiCommand, parseHeaders } from './api';
import * as sdk from '@cueframe/sdk';
import * as sdkClient from '../remote/sdkClient.js';

describe('parseHeaders', () => {
  it('parses a single Header: value pair', () => {
    const h = parseHeaders(['Content-Type: application/json']);
    expect(h.get('content-type')).toBe('application/json');
  });

  it('parses multiple repeats and strips whitespace around the colon', () => {
    const h = parseHeaders(['If-Match:   "abc"', 'X-Foo: bar']);
    expect(h.get('if-match')).toBe('"abc"');
    expect(h.get('x-foo')).toBe('bar');
  });

  it('preserves colons within the value (e.g., URLs)', () => {
    const h = parseHeaders(['X-Forwarded-For: 10.0.0.1: scrubbed']);
    expect(h.get('x-forwarded-for')).toBe('10.0.0.1: scrubbed');
  });

  it('exits with UserError when the entry has no colon', () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      parseHeaders(['Malformed-no-colon']);
      expect(exitSpy).toHaveBeenCalledWith(2);
      expect(errSpy).toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});

describe('apiCommand output modes', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutChunks: string[];
  let stderrChunks: string[];

  beforeEach(() => {
    vi.spyOn(sdkClient, 'initSdk').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('__exit__');
    }) as any);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stdoutChunks = [];
    stderrChunks = [];
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((s: any) => {
      stdoutChunks.push(typeof s === 'string' ? s : String(s));
      return true;
    }) as any);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((s: any) => {
      stderrChunks.push(typeof s === 'string' ? s : String(s));
      return true;
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function run(method: string, path: string, opts: any): Promise<number> {
    process.exitCode = undefined;
    try {
      await apiCommand(method, path, opts);
    } catch (e: any) {
      if (e?.message !== '__exit__') throw e;
    }
    const exited = exitSpy.mock.calls.at(-1)?.[0] as number | undefined;
    const code = exited ?? (process.exitCode as number | undefined) ?? 0;
    process.exitCode = undefined;
    return code;
  }

  it('preserves exact builtin identity and insertion body on the CLI REST lane', async () => {
    const request = vi.spyOn(sdk, 'requestRaw').mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: { ok: true } });
    const path = '/v1/components/builtin/resolve?collection=curated-looks&id=builtin%3Areference-component-wheel-full&revision=observed-revision';
    expect(await run('GET', path, { target: 'dev', json: true })).toBe(0);
    expect(request.mock.calls[0][0]).toBe(path);
    const body = JSON.stringify({ projectId: 'project-1', documentSha256: 'a'.repeat(64), insert: { startTime: 7, idPrefix: 'wheel-1' }, expectedRevision: 4, commandId: 'insert-1', values: {}, media: {} });
    expect(await run('POST', '/v1/templates/builtin%3Areference-component-wheel-full/apply', { target: 'dev', json: true, body })).toBe(0);
    expect(request.mock.calls[1][1]?.body).toBe(body);
  });

  it('--json emits {status,statusText,headers,body} as one object on stdout', async () => {
    vi.spyOn(sdk, 'requestRaw').mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { etag: '"abc"', 'content-type': 'application/json' },
      body: { tracks: [] },
    });
    const code = await run('GET', '/v1/projects/p1/composition', {
      target: 'prod',
      json: true,
    });
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const out = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(out).toEqual({
      status: 200,
      statusText: 'OK',
      headers: { etag: '"abc"', 'content-type': 'application/json' },
      body: { tracks: [] },
    });
  });

  it('--json emits the structured response even on 4xx and still uses the differentiated exit code', async () => {
    vi.spyOn(sdk, 'requestRaw').mockResolvedValue({
      status: 409,
      statusText: 'Conflict',
      headers: { etag: '"newer"' },
      body: { error: { code: 'stale_etag', message: 'ETag mismatch' } },
    });
    const code = await run('PUT', '/v1/projects/p1/composition', {
      target: 'prod',
      json: true,
      body: '{}',
    });
    expect(code).toBe(3);
    const out = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(out.status).toBe(409);
    expect(out.headers.etag).toBe('"newer"');
    expect(out.body.error.code).toBe('stale_etag');
  });

  it('-i / --include prints status line + headers + blank line + body to stdout', async () => {
    vi.spyOn(sdk, 'requestRaw').mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { etag: '"abc"', 'content-type': 'application/json' },
      body: { tracks: [] },
    });
    const code = await run('GET', '/v1/projects/p1/composition', {
      target: 'prod',
      include: true,
    });
    expect(code).toBe(0);
    const joined = stdoutChunks.join('');
    expect(joined).toMatch(/^HTTP\/1\.1 200 OK\n/);
    expect(joined).toMatch(/etag: "abc"\n/);
    expect(joined).toMatch(/content-type: application\/json\n/);
    expect(joined).toMatch(/\n\n\{\s*"tracks":/);
  });

  it('default mode prints only the body on stdout', async () => {
    vi.spyOn(sdk, 'requestRaw').mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: { hi: 'there' },
    });
    const code = await run('GET', '/v1/whoami', { target: 'prod' });
    expect(code).toBe(0);
    const joined = stdoutChunks.join('');
    expect(joined).toMatch(/"hi": "there"/);
    expect(joined).not.toMatch(/^HTTP/);
  });

  it('default mode 4xx writes body to stderr and exits with ApiClientError (3)', async () => {
    vi.spyOn(sdk, 'requestRaw').mockResolvedValue({
      status: 428,
      statusText: 'Precondition Required',
      headers: {},
      body: { error: { code: 'precondition_required', message: 'If-Match required' } },
    });
    const code = await run('PUT', '/v1/projects/p1/composition', {
      target: 'prod',
      body: '{}',
    });
    expect(code).toBe(3);
    const joinedErr = stderrChunks.join('');
    expect(joinedErr).toMatch(/precondition_required/);
  });

  it('402 maps to PaymentRequired exit code (6)', async () => {
    vi.spyOn(sdk, 'requestRaw').mockResolvedValue({
      status: 402,
      statusText: 'Payment Required',
      headers: {},
      body: { error: { code: 'payment_required', message: 'pay up' } },
    });
    const code = await run('POST', '/v1/things', { target: 'prod', body: '{}' });
    expect(code).toBe(6);
  });

  it('5xx maps to ApiServerError exit code (4)', async () => {
    vi.spyOn(sdk, 'requestRaw').mockResolvedValue({
      status: 503,
      statusText: 'Service Unavailable',
      headers: {},
      body: { error: { code: 'service_unavailable', message: 'try later' } },
    });
    const code = await run('GET', '/v1/things', { target: 'prod' });
    expect(code).toBe(4);
  });

  it('network error maps to NetworkError exit code (5)', async () => {
    vi.spyOn(sdk, 'requestRaw').mockRejectedValue(new Error('ECONNREFUSED'));
    const code = await run('GET', '/v1/things', { target: 'prod' });
    expect(code).toBe(5);
    expect(stderrChunks.join('')).toMatch(/ECONNREFUSED/);
  });

  it('routes a non-2xx through emitError so the failure gets one summary line', async () => {
    vi.spyOn(sdk, 'requestRaw').mockResolvedValue({
      status: 404,
      statusText: 'Not Found',
      headers: {},
      body: { error: { code: 'not_found', message: 'nope' } },
    });
    const code = await run('GET', '/v1/things/x', { target: 'prod' });
    expect(code).toBe(3);
    const joinedErr = stderrChunks.join('');
    expect(joinedErr.match(/✖ api:/g)).toHaveLength(1);
    expect(joinedErr).toMatch(/GET \/v1\/things\/x → 404 Not Found/);
  });

  it('a malformed method never reaches the network and exits 2 with one line', async () => {
    const spy = vi.spyOn(sdk, 'requestRaw');
    const code = await run('BREW', '/v1/things', { target: 'prod' });
    expect(code).toBe(2);
    expect(spy).not.toHaveBeenCalled();
    expect(stderrChunks.join('').match(/✖ api:/g)).toHaveLength(1);
  });

  it('unsupported method exits with UserError (2)', async () => {
    const code = await run('BREW', '/v1/things', { target: 'prod' });
    expect(code).toBe(2);
  });

  it('path without leading slash exits with UserError (2)', async () => {
    const code = await run('GET', 'v1/things', { target: 'prod' });
    expect(code).toBe(2);
  });
});
