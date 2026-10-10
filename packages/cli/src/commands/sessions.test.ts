import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sessionsListCommand,
  sessionsGetCommand,
  sessionsCreateCommand,
  sessionsDeleteCommand,
} from './sessions';
import { sessions as sessionsSdk } from '@cueframe/sdk';
import * as sdkClient from '../remote/sdkClient.js';

function setupSpies() {
  vi.spyOn(sdkClient, 'initSdk').mockImplementation(() => {});
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('__exit__');
  }) as any);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const stderrChunks: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((s: unknown) => {
    stderrChunks.push(typeof s === 'string' ? s : String(s));
    return true;
  }) as any);
  return { exitSpy, logSpy, errSpy, stderrChunks };
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

describe('sessionsListCommand', () => {
  let spies: ReturnType<typeof setupSpies>;
  beforeEach(() => {
    spies = setupSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints session summaries on stdout', async () => {
    vi.spyOn(sessionsSdk, 'listSessions').mockResolvedValue({
      data: [
        { id: 'sess_1', name: 'Pod episode', fileCount: 3, muxStatus: 'complete', createdAt: '2026-05-16T00:00:00Z' },
        { id: 'sess_2', name: 'Interview B', fileCount: 2, muxStatus: null, createdAt: '2026-05-15T00:00:00Z' },
      ],
      pagination: { hasMore: false, nextCursor: null, prevCursor: null },
    } as any);
    const code = await run(() => sessionsListCommand({ target: 'prod' }), spies.exitSpy);
    expect(code).toBe(0);
    const out = spies.logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toMatch(/sess_1\t3 files\tmux:complete\tPod episode/);
    expect(out).toMatch(/sess_2\t2 files\tmux:pending\tInterview B/);
  });

  it('--json emits the raw envelope', async () => {
    vi.spyOn(sessionsSdk, 'listSessions').mockResolvedValue({
      data: [],
      pagination: { hasMore: false, nextCursor: null, prevCursor: null },
    } as any);
    const code = await run(
      () => sessionsListCommand({ target: 'prod', json: true }),
      spies.exitSpy,
    );
    expect(code).toBe(0);
    const out = spies.logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toMatch(/"data": \[\]/);
    expect(out).toMatch(/"pagination":/);
  });

  it('surfaces SDK errors and exits with mapped code', async () => {
    const { ApiError } = await import('@cueframe/sdk');
    vi.spyOn(sessionsSdk, 'listSessions').mockRejectedValue(
      new ApiError(429, { code: 'rate_limited', message: 'too many' }),
    );
    const code = await run(() => sessionsListCommand({ target: 'prod' }), spies.exitSpy);
    expect(code).toBe(3);
  });
});

describe('sessionsGetCommand', () => {
  let spies: ReturnType<typeof setupSpies>;
  beforeEach(() => {
    spies = setupSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints the session row', async () => {
    vi.spyOn(sessionsSdk, 'getSession').mockResolvedValue({
      id: 'sess_1',
      name: 'Pod episode',
      files: [],
      mux: { status: null, jobId: null, muxedItems: null, error: null, startedAt: null, completedAt: null },
      createdAt: '2026-05-16T00:00:00Z',
    } as any);
    const code = await run(() => sessionsGetCommand('sess_1', { target: 'prod' }), spies.exitSpy);
    expect(code).toBe(0);
    const out = spies.logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toMatch(/"id": "sess_1"/);
  });

  it('rejects control chars (exit 2)', async () => {
    const code = await run(
      () => sessionsGetCommand('sess_\n1', { target: 'prod' }),
      spies.exitSpy,
    );
    expect(code).toBe(2);
  });
});

describe('sessionsCreateCommand', () => {
  let spies: ReturnType<typeof setupSpies>;
  beforeEach(() => {
    spies = setupSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses --file mediaId:role pairs and posts the right body', async () => {
    const create = vi.spyOn(sessionsSdk, 'createSession').mockResolvedValue({
      id: 'sess_new',
      name: 'New',
      files: [],
      mux: { status: null, jobId: null, muxedItems: null, error: null, startedAt: null, completedAt: null },
      createdAt: '2026-05-16T00:00:00Z',
    } as any);
    const code = await run(
      () =>
        sessionsCreateCommand({
          target: 'prod',
          name: 'New',
          files: ['med_a:camera-a', 'med_b:screen'],
        }),
      spies.exitSpy,
    );
    expect(code).toBe(0);
    expect(create).toHaveBeenCalledWith({
      name: 'New',
      files: [
        { mediaId: 'med_a', role: 'camera-a' },
        { mediaId: 'med_b', role: 'screen' },
      ],
    });
  });

  it('rejects --file entries missing a colon (exit 2)', async () => {
    const code = await run(
      () =>
        sessionsCreateCommand({
          target: 'prod',
          name: 'New',
          files: ['no-colon-here'],
        }),
      spies.exitSpy,
    );
    expect(code).toBe(2);
  });

  it('--name empty exits with UserError (2)', async () => {
    const code = await run(
      () => sessionsCreateCommand({ target: 'prod', name: '', files: ['m:r'] }),
      spies.exitSpy,
    );
    expect(code).toBe(2);
  });
});

describe('sessionsDeleteCommand', () => {
  let spies: ReturnType<typeof setupSpies>;
  beforeEach(() => {
    spies = setupSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('204 → ok message', async () => {
    vi.spyOn(sessionsSdk, 'deleteSession').mockResolvedValue(undefined as any);
    const code = await run(
      () => sessionsDeleteCommand('sess_1', { target: 'prod' }),
      spies.exitSpy,
    );
    expect(code).toBe(0);
    expect(spies.logSpy.mock.calls.map((c) => c[0]).join('\n')).toMatch(/deleted/);
  });

  it('422 session_in_use surfaces the SDK advice line', async () => {
    const { ApiError } = await import('@cueframe/sdk');
    vi.spyOn(sessionsSdk, 'deleteSession').mockRejectedValue(
      new ApiError(422, {
        code: 'session_in_use',
        message: 'Session referenced',
        details: { projectIds: ['proj_a'] },
      }),
    );
    const code = await run(
      () => sessionsDeleteCommand('sess_1', { target: 'prod' }),
      spies.exitSpy,
    );
    expect(code).toBe(3);
    const errCalls = spies.stderrChunks.join('');
    expect(errCalls).toMatch(/Session referenced/);
    expect(errCalls).toMatch(/projectIds/);
    expect(errCalls.match(/✖ sessions_delete:/g)).toHaveLength(1);
    expect(spies.errSpy).not.toHaveBeenCalled();
  });
});
