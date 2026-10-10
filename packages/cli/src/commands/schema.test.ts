import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { schemaCommand } from './schema';
import * as sdk from '@cueframe/sdk';
import type { RawResponse } from '@cueframe/sdk';

function setupSpies() {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('__exit__');
  }) as any);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const stderrChunks: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((s: any) => {
    stderrChunks.push(typeof s === 'string' ? s : String(s));
    return true;
  }) as any);
  return { exitSpy, logSpy, stderrChunks };
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

const OPENAPI = {
  paths: {
    '/v1/projects/{id}/composition': {
      put: {
        operationId: 'putComposition',
        requestBody: {
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Composition' } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Composition: {
        type: 'object',
        properties: { format: { $ref: '#/components/schemas/FormatSpec' } },
      },
      FormatSpec: { type: 'object', properties: { aspectRatio: { type: 'string' } } },
      Unused: { type: 'object' },
    },
  },
};

describe('schemaCommand', () => {
  let spies: ReturnType<typeof setupSpies>;
  beforeEach(() => {
    spies = setupSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GETs /v1/openapi.json and prints the putComposition body component + transitive refs', async () => {
    const reqs: string[] = [];
    vi.spyOn(sdk, 'requestRaw').mockImplementation(async (url: string) => {
      reqs.push(url);
      return { status: 200, statusText: 'OK', headers: {}, body: OPENAPI } as RawResponse;
    });

    const code = await run(() => schemaCommand('composition', { target: 'prod' }), spies.exitSpy);
    expect(code).toBe(0);
    expect(reqs).toEqual(['/v1/openapi.json']);

    const out = spies.logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toMatch(/Composition/);
    expect(out).toMatch(/FormatSpec/); // transitively referenced — included
    expect(out).not.toMatch(/Unused/); // unreachable — excluded
  });

  it('exits non-zero when openapi.json cannot be fetched', async () => {
    vi.spyOn(sdk, 'requestRaw').mockResolvedValueOnce({
      status: 500,
      statusText: 'Server Error',
      headers: {},
      body: null,
    } as RawResponse);
    const code = await run(() => schemaCommand('composition', { target: 'prod' }), spies.exitSpy);
    expect(code).not.toBe(0);
  });
});
