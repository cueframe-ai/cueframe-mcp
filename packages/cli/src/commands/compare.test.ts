import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as sdk from '@cueframe/sdk';
import * as sdkClient from '../remote/sdkClient.js';
import * as output from '../remote/output.js';
import { compareCommand } from './compare.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=', 'base64');
const image = {
  view: 'overlay', width: 1, height: 1, byteLength: png.length,
  artifactSha256: `sha256:${createHash('sha256').update(png).digest('hex')}`, pngBase64: png.toString('base64'),
};
const response = {
  reference: { mediaItemId: 'media1', frame: 117 }, candidate: { jobId: 'job1', artifactId: 'frame-0' },
  comparison: { width: 1, height: 1, alignment: 'none', images: [image] },
};
const options = {
  target: 'prod', json: true, referenceMedia: 'media1', referenceRepresentation: `sha256:${'a'.repeat(64)}`,
  referenceFrame: '117', candidateJob: 'job1', candidateArtifact: 'frame-0',
};

async function run(overrides: Partial<typeof options> & { crop?: string; views?: string; out?: string } = {}) {
  try { await compareCommand('project1', { ...options, ...overrides }); }
  catch (error) { if ((error as Error).message !== '__exit__') throw error; }
  return vi.mocked(process.exit).mock.calls.at(-1)?.[0] ?? 0;
}

describe('compareCommand', () => {
  const directories: string[] = [];
  beforeEach(() => {
    vi.spyOn(sdkClient, 'initSdk').mockImplementation(() => {});
    vi.spyOn(output, 'emitEvent').mockImplementation(() => {});
    vi.spyOn(output, 'emitError').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('__exit__'); }) as never);
    vi.spyOn(sdk, 'requestRaw').mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: response });
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
  });

  it('compares existing identities in one request and emits metadata without image bytes', async () => {
    expect(await run()).toBe(0);
    expect(sdk.requestRaw).toHaveBeenCalledTimes(1);
    expect(sdkClient.initSdk).toHaveBeenCalledWith('prod', { timeoutMs: 100_000 });
    const [path, init] = vi.mocked(sdk.requestRaw).mock.calls[0];
    expect(path).toBe('/v1/projects/project1/compare-frames');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      reference: { mediaItemId: 'media1', representationIdentity: options.referenceRepresentation, frame: 117 },
      candidate: { jobId: 'job1', artifactId: 'frame-0' },
    });
    const receipt = vi.mocked(output.emitEvent).mock.calls.find(([, event]) => event === 'compare_complete')?.[2];
    expect(receipt).toMatchObject({ comparison: { alignment: 'none', images: [{ delivery: 'metadata_only', artifactSha256: image.artifactSha256 }] } });
    expect(JSON.stringify(receipt)).not.toContain(image.pngBase64);
  });

  it('forwards a shared-coordinate crop and exact requested views', async () => {
    expect(await run({ crop: '12,24,200,100', views: 'overlay,difference' })).toBe(0);
    expect(JSON.parse(vi.mocked(sdk.requestRaw).mock.calls[0][1]?.body as string)).toMatchObject({
      crop: { x: 12, y: 24, width: 200, height: 100 }, views: ['overlay', 'difference'],
    });
  });

  it.each([
    { referenceFrame: '3.91' }, { referenceFrame: '-1' }, { referenceRepresentation: 'unknown' }, { crop: '0,0,0,10' },
    { crop: '0,0,10' }, { views: 'overlay,overlay' }, { views: 'auto_align' },
  ])('refuses invalid comparison selectors before an API request: %j', async (overrides) => {
    expect(await run(overrides)).toBe(2);
    expect(sdk.requestRaw).not.toHaveBeenCalled();
  });

  it('saves verified PNGs and safely reuses an identical existing file', async () => {
    const out = await mkdtemp(join(tmpdir(), 'cueframe-compare-test-')); directories.push(out);
    expect(await run({ out })).toBe(0);
    expect(await run({ out })).toBe(0);
    const receipt = vi.mocked(output.emitEvent).mock.calls.find(([, event]) => event === 'compare_complete')?.[2] as { comparison: { images: { path: string }[] } };
    expect(await readFile(receipt.comparison.images[0].path)).toEqual(png);
    expect(JSON.stringify(receipt)).not.toContain('pngBase64');
  });

  it('refuses image bytes that do not match their receipt', async () => {
    vi.mocked(sdk.requestRaw).mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: {
      ...response, comparison: { ...response.comparison, images: [{ ...image, artifactSha256: `sha256:${'b'.repeat(64)}` }] },
    } });
    expect(await run()).not.toBe(0);
    expect(vi.mocked(output.emitEvent).mock.calls.some(([, event]) => event === 'compare_complete')).toBe(false);
  });

  it('preserves API refusal codes and does not retry or render', async () => {
    vi.mocked(sdk.requestRaw).mockResolvedValue({ status: 403, statusText: 'Forbidden', headers: {}, body: {
      error: { code: 'forbidden', message: 'Preview belongs to another project.' },
    } });
    expect(await run()).toBe(3);
    expect(sdk.requestRaw).toHaveBeenCalledTimes(1);
    expect(output.emitError).toHaveBeenCalledWith(expect.anything(), 'compare', expect.objectContaining({ code: 'forbidden', status: 403 }), 3);
  });
});
