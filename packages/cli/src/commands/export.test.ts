import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportCommand } from './export';
import { exports as exportsSdk } from '@cueframe/sdk';
import * as sdkClient from '../remote/sdkClient.js';

function setupSpies() {
  vi.spyOn(sdkClient, 'initSdk').mockImplementation(() => {});
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('__exit__');
  }) as any);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const stderrChunks: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((s: any) => {
    stderrChunks.push(typeof s === 'string' ? s : String(s));
    return true;
  }) as any);
  return { exitSpy, stderrChunks };
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

describe('cueframe export', () => {
  let spies: ReturnType<typeof setupSpies>;
  beforeEach(() => {
    spies = setupSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fires createFcpxmlExport with the right body and prints the export id', async () => {
    const create = vi
      .spyOn(exportsSdk, 'createFcpxmlExport')
      .mockResolvedValue({
        id: 'exp_abc',
        format: 'fcpxml',
        status: 'queued',
        progress: 0,
        outputUrl: null,
        outputExpiresAt: null,
        outputSizeBytes: null,
        outputDurationSec: null,
        error: null,
        trimCacheHit: null,
        clipSuggestionId: 'sug_xyz',
        createdAt: '2026-05-16T00:00:00Z',
        updatedAt: '2026-05-16T00:00:00Z',
      } as any);

    const code = await run(
      () =>
        exportCommand('fcpxml', {
          target: 'prod',
          projectId: 'proj_123',
          suggestionId: 'sug_xyz',
        }),
      spies.exitSpy,
    );
    expect(code).toBe(0);
    expect(create).toHaveBeenCalledWith('proj_123', { clipSuggestionId: 'sug_xyz' });
  });

  it('rejects identifiers with control chars (exit 2)', async () => {
    const code = await run(
      () =>
        exportCommand('fcpxml', {
          target: 'prod',
          projectId: 'proj_\n123',
          suggestionId: 'sug_xyz',
        }),
      spies.exitSpy,
    );
    expect(code).toBe(2);
  });

  it('routes to createPremiereExport when format is premiere', async () => {
    const create = vi
      .spyOn(exportsSdk, 'createPremiereExport')
      .mockResolvedValue({
        id: 'exp_pp',
        format: 'premiere',
        status: 'queued',
        progress: 0,
        outputUrl: null,
        outputExpiresAt: null,
        outputSizeBytes: null,
        outputDurationSec: null,
        error: null,
        trimCacheHit: null,
        clipSuggestionId: 'sug_xyz',
        createdAt: '2026-05-16T00:00:00Z',
        updatedAt: '2026-05-16T00:00:00Z',
      } as any);

    const code = await run(
      () =>
        exportCommand('premiere', {
          target: 'prod',
          projectId: 'proj_123',
          suggestionId: 'sug_xyz',
        }),
      spies.exitSpy,
    );
    expect(code).toBe(0);
    expect(create).toHaveBeenCalledWith('proj_123', { clipSuggestionId: 'sug_xyz' });
  });

  it('--wait polls until complete and stops on terminal status', async () => {
    vi.spyOn(exportsSdk, 'createFcpxmlExport').mockResolvedValue({
      id: 'exp_abc',
      format: 'fcpxml',
      status: 'queued',
      progress: 0,
      outputUrl: null,
      outputExpiresAt: null,
      outputSizeBytes: null,
      outputDurationSec: null,
      error: null,
      trimCacheHit: null,
      clipSuggestionId: 'sug_xyz',
      createdAt: '2026-05-16T00:00:00Z',
      updatedAt: '2026-05-16T00:00:00Z',
    } as any);

    const getCalls = [
      { status: 'trimming', progress: 0.2 },
      { status: 'building', progress: 0.6 },
      {
        status: 'complete',
        progress: 1,
        outputUrl: null,
        outputSizeBytes: 1024 * 1024,
        outputExpiresAt: '2026-05-23T00:00:00Z',
        trimCacheHit: false,
      },
    ];
    let i = 0;
    vi.spyOn(exportsSdk, 'getExport').mockImplementation(async () => {
      const next = getCalls[Math.min(i++, getCalls.length - 1)];
      return {
        id: 'exp_abc',
        format: 'fcpxml',
        status: next.status,
        progress: next.progress,
        outputUrl: 'outputUrl' in next ? next.outputUrl : null,
        outputExpiresAt: 'outputExpiresAt' in next ? next.outputExpiresAt : null,
        outputSizeBytes: 'outputSizeBytes' in next ? next.outputSizeBytes : null,
        outputDurationSec: null,
        error: null,
        trimCacheHit: 'trimCacheHit' in next ? next.trimCacheHit : null,
        clipSuggestionId: 'sug_xyz',
        createdAt: '2026-05-16T00:00:00Z',
        updatedAt: '2026-05-16T00:00:00Z',
      } as any;
    });

    const code = await run(
      () =>
        exportCommand('fcpxml', {
          target: 'prod',
          projectId: 'proj_123',
          suggestionId: 'sug_xyz',
          wait: true,
          pollIntervalMs: 1,
        }),
      spies.exitSpy,
    );
    expect(code).toBe(4);
    expect(i).toBeGreaterThanOrEqual(3);
  });

  it('--wait surfaces export error with retryable flag and exits with ApiServerError', async () => {
    vi.spyOn(exportsSdk, 'createFcpxmlExport').mockResolvedValue({
      id: 'exp_abc',
      format: 'fcpxml',
      status: 'queued',
      progress: 0,
      outputUrl: null,
      outputExpiresAt: null,
      outputSizeBytes: null,
      outputDurationSec: null,
      error: null,
      trimCacheHit: null,
      clipSuggestionId: 'sug_xyz',
      createdAt: '2026-05-16T00:00:00Z',
      updatedAt: '2026-05-16T00:00:00Z',
    } as any);
    vi.spyOn(exportsSdk, 'getExport').mockResolvedValue({
      id: 'exp_abc',
      format: 'fcpxml',
      status: 'error',
      progress: 0.3,
      outputUrl: null,
      outputExpiresAt: null,
      outputSizeBytes: null,
      outputDurationSec: null,
      error: { phase: 'trim', message: 'Source missing', retryable: false },
      trimCacheHit: null,
      clipSuggestionId: 'sug_xyz',
      createdAt: '2026-05-16T00:00:00Z',
      updatedAt: '2026-05-16T00:00:00Z',
    } as any);

    const code = await run(
      () =>
        exportCommand('fcpxml', {
          target: 'prod',
          projectId: 'proj_123',
          suggestionId: 'sug_xyz',
          wait: true,
          pollIntervalMs: 1,
        }),
      spies.exitSpy,
    );
    expect(code).toBe(4);
  });
});
