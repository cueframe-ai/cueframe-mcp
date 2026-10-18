import { createServer, type Server, type RequestListener } from 'node:http';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { media } from '@cueframe/sdk';
import * as sdkClient from '../remote/sdkClient.js';
import * as exits from '../remote/exitCodes.js';
import { uploadCommand } from './upload.js';

describe('bounded file upload', () => {
  let directory: string;
  let server: Server | undefined;
  afterEach(async () => {
    vi.restoreAllMocks();
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  async function fixture(size: number) {
    directory = await mkdtemp(join(tmpdir(), 'cueframe-upload-'));
    const path = join(directory, 'sample.mp4');
    const file = await open(path, 'w');
    await file.truncate(size); // Sparse: even a limit test consumes no 5 GiB fixture.
    await file.close();
    vi.spyOn(sdkClient, 'initSdk').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation((() => true) as never);
    vi.spyOn(exits, 'exitWith').mockImplementation((code) => { throw new Error(`exit:${code}`); });
    return path;
  }

  async function listen(handler: RequestListener) {
    server = createServer(handler);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing test port');
    return `http://127.0.0.1:${address.port}/upload`;
  }

  it('streams a file-backed Blob with a known length and finalizes only after all bytes arrive', async () => {
    const size = 16 * 1024 * 1024;
    const path = await fixture(size);
    let received = 0;
    const digest = createHash('sha256');
    const url = await listen((request, response) => {
      expect(request.headers['content-length']).toBe(String(size));
      request.on('data', (chunk: Buffer) => { received += chunk.length; digest.update(chunk); });
      request.on('end', () => response.end());
    });
    vi.spyOn(media, 'createMediaUpload').mockResolvedValue({ id: 'test-media', uploadUrl: url, expiresAt: '2099-01-01T00:00:00Z' });
    const finalize = vi.spyOn(media, 'finalizeMedia').mockImplementation(async () => {
      expect(received).toBe(size);
      return {} as never;
    });
    vi.spyOn(media, 'getMedia').mockResolvedValue({ processingStatus: { phase: 'complete' } } as never);
    const realFetch = globalThis.fetch;
    const put = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      expect(init?.body).toBeInstanceOf(Blob);
      expect((init?.body as Blob).size).toBe(size);
      return realFetch(input, init);
    });
    await uploadCommand(path, { target: 'local', analyze: false, json: true });
    expect(put).toHaveBeenCalledOnce();
    expect(finalize).toHaveBeenCalledOnce();
    const expected = createHash('sha256');
    for (let i = 0; i < 256; i++) expected.update(Buffer.alloc(64 * 1024));
    expect(digest.digest('hex')).toBe(expected.digest('hex'));
  }, 15_000);

  it('does not finalize after transport interruption during the body', async () => {
    const path = await fixture(16 * 1024 * 1024);
    let received = 0;
    const url = await listen((request) => {
      request.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received >= 128 * 1024) request.socket.destroy();
      });
    });
    vi.spyOn(media, 'createMediaUpload').mockResolvedValue({ id: 'test-media', uploadUrl: url, expiresAt: '2099-01-01T00:00:00Z' });
    const finalize = vi.spyOn(media, 'finalizeMedia');
    await expect(uploadCommand(path, { target: 'local', analyze: false, json: true })).rejects.toThrow('exit:5');
    expect(received).toBeGreaterThan(0);
    expect(received).toBeLessThan(16 * 1024 * 1024);
    expect(finalize).not.toHaveBeenCalled();
  });

  it('rejects a file above the generated direct-upload limit before reserving media', async () => {
    const path = await fixture(5 * 1024 ** 3 + 1);
    const reserve = vi.spyOn(media, 'createMediaUpload');
    await expect(uploadCommand(path, { target: 'local', analyze: false, json: true })).rejects.toThrow('exit:2');
    expect(reserve).not.toHaveBeenCalled();
  });
});
