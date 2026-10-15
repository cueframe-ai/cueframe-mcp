import { afterEach, describe, expect, it, vi } from 'vitest';
import { media } from '@cueframe/sdk';
import * as sdkClient from '../remote/sdkClient.js';
import { mediaDownloadUrlCommand } from './media.js';

describe('mediaDownloadUrlCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks the API for the item\'s download URL and emits it with its expiry', async () => {
    vi.spyOn(sdkClient, 'initSdk').mockImplementation(() => {});
    const logged: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => {
      logged.push(line);
    });
    vi.spyOn(process.stdout, 'write').mockImplementation((() => true) as never);
    const read = vi.spyOn(media, 'getMediaDownloadUrl').mockResolvedValue({
      url: 'https://r2.test/source.mp4?sig=abc',
      expiresAt: '2026-10-14T13:00:00.000Z',
    });

    await mediaDownloadUrlCommand('abcdefghij1234567890abcdef123456', { target: 'prod', json: true });

    expect(read).toHaveBeenCalledWith('abcdefghij1234567890abcdef123456');
    expect(logged).toHaveLength(1);
    expect(JSON.parse(logged[0]!)).toEqual({
      ok: true,
      mediaId: 'abcdefghij1234567890abcdef123456',
      url: 'https://r2.test/source.mp4?sig=abc',
      expiresAt: '2026-10-14T13:00:00.000Z',
    });
  });

  it('prints only the URL in human mode, so it pipes into curl', async () => {
    vi.spyOn(sdkClient, 'initSdk').mockImplementation(() => {});
    const logged: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => {
      logged.push(line);
    });
    vi.spyOn(media, 'getMediaDownloadUrl').mockResolvedValue({
      url: 'https://r2.test/source.mp4?sig=abc',
      expiresAt: '2026-10-14T13:00:00.000Z',
    });

    await mediaDownloadUrlCommand('abcdefghij1234567890abcdef123456', { target: 'prod' });

    expect(logged).toEqual(['https://r2.test/source.mp4?sig=abc']);
  });
});
