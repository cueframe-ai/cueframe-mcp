import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  compositionGetCommand,
  compositionPutCommand,
  compositionFromSuggestionCommand,
  compositionValidateCommand,
} from './composition';
import * as sdk from '@cueframe/sdk';
import type { RawResponse } from '@cueframe/sdk';
import * as sdkClient from '../remote/sdkClient.js';

type Captured = { url: string; init: RequestInit };

function setupSpies() {
  const captured: Captured[] = [];
  vi.spyOn(sdkClient, 'initSdk').mockImplementation(() => {});

  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('__exit__');
  }) as any);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  vi.spyOn(process.stdout, 'write').mockImplementation(((s: any) => {
    stdoutChunks.push(typeof s === 'string' ? s : String(s));
    return true;
  }) as any);
  vi.spyOn(process.stderr, 'write').mockImplementation(((s: any) => {
    stderrChunks.push(typeof s === 'string' ? s : String(s));
    return true;
  }) as any);

  return { captured, exitSpy, logSpy, errSpy, stdoutChunks, stderrChunks };
}

function run(fn: () => Promise<unknown>, exitSpy: ReturnType<typeof vi.spyOn>): Promise<number> {
  return fn()
    .catch((e: any) => {
      if (e?.message !== '__exit__') throw e;
    })
    .then(() => {
      const last = exitSpy.mock.calls.at(-1);
      return last === undefined ? 0 : (last[0] as number);
    });
}

describe('compositionGetCommand', () => {
  let spies: ReturnType<typeof setupSpies>;
  beforeEach(() => {
    spies = setupSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints body and ETag on 200', async () => {
    vi.spyOn(sdk, 'requestRaw').mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: { etag: '"abc"', 'content-type': 'application/json' },
      body: { tracks: [] },
    });

    const code = await run(
      () => compositionGetCommand('proj_123', { target: 'prod' }),
      spies.exitSpy,
    );
    expect(code).toBe(0);
    const joined = spies.logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(joined).toMatch(/# ETag: "abc"/);
    expect(joined).toMatch(/"tracks":/);
  });

  it('--json emits the {etag, composition} structured event', async () => {
    vi.spyOn(sdk, 'requestRaw').mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: { etag: '"xyz"' },
      body: { tracks: [{ kind: 'video' }] },
    });
    const code = await run(
      () => compositionGetCommand('proj_123', { target: 'prod', json: true }),
      spies.exitSpy,
    );
    expect(code).toBe(0);
    const stdout = spies.logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(stdout).toMatch(/"etag":\s*"\\"xyz\\""/);
    expect(stdout).toMatch(/"composition":/);
  });

  it('maps 404 → ApiClientError (3) with the advice line on stderr', async () => {
    vi.spyOn(sdk, 'requestRaw').mockResolvedValueOnce({
      status: 404,
      statusText: 'Not Found',
      headers: {},
      body: { error: { code: 'not_found', message: 'Composition not found' } },
    });
    const code = await run(
      () => compositionGetCommand('proj_123', { target: 'prod' }),
      spies.exitSpy,
    );
    expect(code).toBe(3);
    const stderr = spies.stderrChunks.join('');
    expect(stderr).toMatch(/Composition not found/);
    expect(stderr).toMatch(/enumerate with the matching list command/i);
  });

  it('rejects identifiers with control chars (exit 2)', async () => {
    const code = await run(
      () => compositionGetCommand('proj_\n123', { target: 'prod' }),
      spies.exitSpy,
    );
    expect(code).toBe(2);
  });
});

describe('compositionValidateCommand', () => {
  let spies: ReturnType<typeof setupSpies>;
  beforeEach(() => {
    spies = setupSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const VALID = JSON.stringify({
    v: 1,
    format: { aspectRatio: '9:16' },
    tracks: [{ id: 'v', kind: 'video', contents: [] }],
  });

  it('POSTs the body to /v1/composition/validate (project-less) and reports valid on 200', async () => {
    const reqs: Captured[] = [];
    vi.spyOn(sdk, 'requestRaw').mockImplementation(async (url: string, init?: RequestInit) => {
      reqs.push({ url, init: init ?? {} });
      return { status: 200, statusText: 'OK', headers: {}, body: { valid: true } } as RawResponse;
    });

    const code = await run(
      () => compositionValidateCommand({ target: 'prod', body: VALID }),
      spies.exitSpy,
    );
    expect(code).toBe(0);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].url).toBe('/v1/composition/validate');
    expect(reqs[0].init.method).toBe('POST');
    const out = spies.logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toMatch(/valid/i);
  });

  it('surfaces a 400 validation_error on stderr and exits 3 — no render needed', async () => {
    vi.spyOn(sdk, 'requestRaw').mockResolvedValueOnce({
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      body: { error: { code: 'validation_error', message: 'tracks: Required' } },
    } as RawResponse);

    const code = await run(
      () => compositionValidateCommand({ target: 'prod', body: '{}' }),
      spies.exitSpy,
    );
    expect(code).toBe(3);
    expect(spies.stderrChunks.join('')).toMatch(/validation_error|tracks/);
  });

  it('exits 2 (UserError) when --body is missing', async () => {
    const code = await run(
      () => compositionValidateCommand({ target: 'prod', body: '' }),
      spies.exitSpy,
    );
    expect(code).toBe(2);
  });
});

describe('compositionPutCommand — ETag threading', () => {
  let spies: ReturnType<typeof setupSpies>;
  beforeEach(() => {
    spies = setupSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses without --if-match or --force, before any request, naming `composition get`', async () => {
    const spy = vi.spyOn(sdk, 'requestRaw');
    const code = await run(
      () => compositionPutCommand('proj_123', { target: 'prod', body: '{"tracks":[]}' }),
      spies.exitSpy,
    );
    expect(code).toBe(2);
    expect(spy).not.toHaveBeenCalled();
    const stderr = spies.errSpy.mock.calls.map((c) => c[0]).join('\n') + spies.stderrChunks.join('');
    expect(stderr).toMatch(/--if-match/);
    expect(stderr).toMatch(/composition get/);
    expect(stderr).toMatch(/--force/);
  });

  it('refuses --if-match together with --force', async () => {
    const spy = vi.spyOn(sdk, 'requestRaw');
    const code = await run(
      () => compositionPutCommand('proj_123', { target: 'prod', body: '{}', ifMatch: '"v1"', force: true }),
      spies.exitSpy,
    );
    expect(code).toBe(2);
    expect(spy).not.toHaveBeenCalled();
  });

  it('--force uses If-Match: * and skips the GET round-trip', async () => {
    const reqs: Captured[] = [];
    vi.spyOn(sdk, 'requestRaw').mockImplementation(async (url, init): Promise<RawResponse> => {
      reqs.push({ url, init: init ?? {} });
      return {
        status: 200,
        statusText: 'OK',
        headers: { etag: '"new"' },
        body: { compositionId: 'c1', versionId: 'v3', etag: '"new"' },
      };
    });

    const code = await run(
      () =>
        compositionPutCommand('proj_123', {
          target: 'prod',
          body: '{"tracks":[]}',
          force: true,
        }),
      spies.exitSpy,
    );
    expect(code).toBe(0);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].init.method).toBe('PUT');
    const h = new Headers(reqs[0].init.headers as HeadersInit);
    expect(h.get('if-match')).toBe('*');
  });

  it('--if-match <etag> uses that value and skips the GET round-trip', async () => {
    const reqs: Captured[] = [];
    vi.spyOn(sdk, 'requestRaw').mockImplementation(async (url, init): Promise<RawResponse> => {
      reqs.push({ url, init: init ?? {} });
      return {
        status: 200,
        statusText: 'OK',
        headers: { etag: '"v3"' },
        body: {},
      };
    });

    await run(
      () =>
        compositionPutCommand('proj_123', {
          target: 'prod',
          body: '{}',
          ifMatch: '"cached-v2"',
        }),
      spies.exitSpy,
    );
    expect(reqs).toHaveLength(1);
    const h = new Headers(reqs[0].init.headers as HeadersInit);
    expect(h.get('if-match')).toBe('"cached-v2"');
  });

  it('409 stale_etag surfaces the rebase advice', async () => {
    vi.spyOn(sdk, 'requestRaw').mockImplementation(async (_url, init): Promise<RawResponse> => {
      if (init?.method === 'PUT') {
        return {
          status: 409,
          statusText: 'Conflict',
          headers: { etag: '"newer"' },
          body: { error: { code: 'stale_etag', message: 'ETag mismatch' } },
        };
      }
      return { status: 200, statusText: 'OK', headers: { etag: '"v1"' }, body: {} };
    });

    const code = await run(
      () =>
        compositionPutCommand('proj_123', {
          target: 'prod',
          body: '{"tracks":[]}',
          ifMatch: '"v1"',
        }),
      spies.exitSpy,
    );
    expect(code).toBe(3);
    const stderr = spies.stderrChunks.join('');
    expect(stderr).toMatch(/rebase your edits/);
  });

  it('422 invalid_composition exposes the invariant-name hint', async () => {
    vi.spyOn(sdk, 'requestRaw').mockImplementation(async (_url, init): Promise<RawResponse> => {
      if (init?.method === 'PUT') {
        return {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: {},
          body: { error: { code: 'invalid_composition', message: 'overlap', details: { invariant: 'track_clips_overlap' } } },
        };
      }
      return { status: 200, statusText: 'OK', headers: { etag: '"v1"' }, body: {} };
    });
    const code = await run(
      () =>
        compositionPutCommand('proj_123', { target: 'prod', body: '{}', force: true }),
      spies.exitSpy,
    );
    expect(code).toBe(3);
    const stderr = spies.stderrChunks.join('');
    expect(stderr).toMatch(/clip_source_track_kind_mismatch|track_clips_overlap/);
  });

  it('missing --body exits with UserError (2)', async () => {
    const code = await run(
      () => compositionPutCommand('proj_123', { target: 'prod', body: '' }),
      spies.exitSpy,
    );
    expect(code).toBe(2);
  });
});

describe('compositionFromSuggestionCommand', () => {
  let spies: ReturnType<typeof setupSpies>;
  beforeEach(() => {
    spies = setupSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('threads ETag and posts the suggestionId', async () => {
    const reqs: Captured[] = [];
    vi.spyOn(sdk, 'requestRaw').mockImplementation(async (url, init): Promise<RawResponse> => {
      reqs.push({ url, init: init ?? {} });
      if (init?.method === 'GET' || !init?.method) {
        return { status: 200, statusText: 'OK', headers: { etag: '"v1"' }, body: { tracks: [] } };
      }
      return {
        status: 200,
        statusText: 'OK',
        headers: { etag: '"v2"' },
        body: { compositionId: 'c1', etag: '"v2"', composition: {} },
      };
    });
    const code = await run(
      () =>
        compositionFromSuggestionCommand('proj_123', {
          target: 'prod',
          suggestionId: 'sug_abc',
        }),
      spies.exitSpy,
    );
    expect(code).toBe(0);
    expect(reqs).toHaveLength(2);
    expect(reqs[1].url).toMatch(/\/composition\/from-suggestion$/);
    expect(reqs[1].init.method).toBe('POST');
    const body = JSON.parse(reqs[1].init.body as string);
    expect(body.suggestionId).toBe('sug_abc');
    const h = new Headers(reqs[1].init.headers as HeadersInit);
    expect(h.get('if-match')).toBe('"v1"');
  });

  it('--format JSON is parsed and forwarded', async () => {
    const reqs: Captured[] = [];
    vi.spyOn(sdk, 'requestRaw').mockImplementation(async (url, init): Promise<RawResponse> => {
      reqs.push({ url, init: init ?? {} });
      return { status: 200, statusText: 'OK', headers: { etag: '"x"' }, body: {} };
    });
    await run(
      () =>
        compositionFromSuggestionCommand('proj_123', {
          target: 'prod',
          suggestionId: 'sug_abc',
          force: true,
          format: '{"aspectRatio":"9:16","fps":30,"resolution":"fhd"}',
        }),
      spies.exitSpy,
    );
    const body = JSON.parse(reqs[0].init.body as string);
    expect(body.format).toEqual({ aspectRatio: '9:16', fps: 30, resolution: 'fhd' });
  });

  it('invalid --format JSON exits with UserError (2)', async () => {
    const code = await run(
      () =>
        compositionFromSuggestionCommand('proj_123', {
          target: 'prod',
          suggestionId: 'sug_abc',
          force: true,
          format: 'not-json',
        }),
      spies.exitSpy,
    );
    expect(code).toBe(2);
  });

  it('missing --suggestion exits with UserError (2)', async () => {
    const code = await run(
      () =>
        compositionFromSuggestionCommand('proj_123', {
          target: 'prod',
          suggestionId: '',
        }),
      spies.exitSpy,
    );
    expect(code).toBe(2);
  });

  it('auto-retries on a 409 {error:{code:stale_etag}} envelope by re-fetching ETag', async () => {
    const reqs: Captured[] = [];
    let postAttempts = 0;
    vi.spyOn(sdk, 'requestRaw').mockImplementation(async (url, init): Promise<RawResponse> => {
      reqs.push({ url, init: init ?? {} });
      if (!init?.method || init.method === 'GET') {
        return {
          status: 200,
          statusText: 'OK',
          headers: { etag: postAttempts === 0 ? '"v1"' : '"v2"' },
          body: { tracks: [] },
        };
      }
      postAttempts++;
      if (postAttempts === 1) {
        return {
          status: 409,
          statusText: 'Conflict',
          headers: {},
          body: { error: { code: 'stale_etag', message: 'ETag mismatch' }, currentEtag: '"v2"' },
        };
      }
      return {
        status: 200,
        statusText: 'OK',
        headers: { etag: '"v3"' },
        body: { compositionId: 'c1', etag: '"v3"', composition: {} },
      };
    });
    const code = await run(
      () =>
        compositionFromSuggestionCommand('proj_123', {
          target: 'prod',
          suggestionId: 'sug_abc',
        }),
      spies.exitSpy,
    );
    expect(code).toBe(0);
    expect(reqs).toHaveLength(4);
    expect(reqs[0].init.method ?? 'GET').toMatch(/GET/);
    expect(reqs[1].init.method).toBe('POST');
    expect(reqs[2].init.method ?? 'GET').toMatch(/GET/);
    expect(reqs[3].init.method).toBe('POST');
    const h2 = new Headers(reqs[3].init.headers as HeadersInit);
    expect(h2.get('if-match')).toBe('"v2"');
  });

  it('does not auto-retry on non-409 errors (e.g., 422 invalid suggestion)', async () => {
    const reqs: Captured[] = [];
    vi.spyOn(sdk, 'requestRaw').mockImplementation(async (url, init): Promise<RawResponse> => {
      reqs.push({ url, init: init ?? {} });
      if (!init?.method || init.method === 'GET') {
        return { status: 200, statusText: 'OK', headers: { etag: '"v1"' }, body: {} };
      }
      return {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: {},
        body: { error: { code: 'suggestion_not_found', message: 'No such suggestion' } },
      };
    });
    const code = await run(
      () =>
        compositionFromSuggestionCommand('proj_123', {
          target: 'prod',
          suggestionId: 'sug_missing',
        }),
      spies.exitSpy,
    );
    expect(code).not.toBe(0);
    expect(reqs).toHaveLength(2);
  });

  it('gives up after MAX_ETAG_RETRIES (3) consecutive 409s and surfaces the error', async () => {
    const reqs: Captured[] = [];
    vi.spyOn(sdk, 'requestRaw').mockImplementation(async (url, init): Promise<RawResponse> => {
      reqs.push({ url, init: init ?? {} });
      if (!init?.method || init.method === 'GET') {
        return { status: 200, statusText: 'OK', headers: { etag: '"vX"' }, body: {} };
      }
      return {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        body: { error: { code: 'stale_etag', message: 'ETag mismatch' } },
      };
    });
    const code = await run(
      () =>
        compositionFromSuggestionCommand('proj_123', {
          target: 'prod',
          suggestionId: 'sug_abc',
        }),
      spies.exitSpy,
    );
    expect(code).not.toBe(0);
    const posts = reqs.filter((r) => r.init.method === 'POST').length;
    expect(posts).toBe(4);
  });

  it('a 409 without error.code is not a stale-ETag rebase — one POST, then surface', async () => {
    const reqs: Captured[] = [];
    vi.spyOn(sdk, 'requestRaw').mockImplementation(async (url, init): Promise<RawResponse> => {
      reqs.push({ url, init: init ?? {} });
      if (!init?.method || init.method === 'GET') {
        return { status: 200, statusText: 'OK', headers: { etag: '"v1"' }, body: {} };
      }
      return {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        body: { error: { code: 'conflict', message: 'Another write is in flight' } },
      };
    });
    const code = await run(
      () =>
        compositionFromSuggestionCommand('proj_123', {
          target: 'prod',
          suggestionId: 'sug_abc',
        }),
      spies.exitSpy,
    );
    expect(code).not.toBe(0);
    expect(reqs.filter((r) => r.init.method === 'POST')).toHaveLength(1);
  });
});

describe('composition reads negotiate every component execution version the contract declares', () => {
  let spies: ReturnType<typeof setupSpies>;
  beforeEach(() => {
    spies = setupSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const negotiated = '/v1/projects/proj_123/composition?componentExecutionVersions=3&componentExecutionVersions=4';

  it('composition get asks for versions 3 and 4, so a native placement is readable', async () => {
    const raw = vi.spyOn(sdk, 'requestRaw').mockResolvedValueOnce({ status: 200, statusText: 'OK', headers: { etag: '"a"' }, body: {} });
    expect(await run(() => compositionGetCommand('proj_123', { target: 'prod' }), spies.exitSpy)).toBe(0);
    expect(raw.mock.calls[0][0]).toBe(negotiated);
  });

  it('the automatic ETag fetch of from-suggestion negotiates the same versions', async () => {
    const raw = vi.spyOn(sdk, 'requestRaw')
      .mockResolvedValueOnce({ status: 200, statusText: 'OK', headers: { etag: '"a"' }, body: {} })
      .mockResolvedValueOnce({ status: 200, statusText: 'OK', headers: { etag: '"b"' }, body: {} });
    await run(() => compositionFromSuggestionCommand('proj_123', { target: 'prod', suggestionId: 'sug_1' }), spies.exitSpy);
    expect(raw.mock.calls[0][0]).toBe(negotiated);
    expect(raw.mock.calls[0][1]).toMatchObject({ method: 'GET' });
  });
});
