import { media as mediaSdk } from '@cueframe/sdk';
import { initSdk } from '../remote/sdkClient.js';
import { exitCodeForError, exitWith } from '../remote/exitCodes.js';
import { emitEvent, emitError, emitResult } from '../remote/output.js';
import { assertCleanIdentifier } from '../remote/validate.js';

interface CommonOpts {
  target: string;
  json?: boolean;
}

/**
 * A presigned download URL for a media item's stored source file (GET /v1/media/{id}/download-url). Human
 * output is the bare URL so it pipes into curl; JSON carries `url` and `expiresAt` (about an hour out).
 */
export async function mediaDownloadUrlCommand(mediaId: string, opts: CommonOpts) {
  assertCleanIdentifier(mediaId, 'mediaId', opts);
  initSdk(opts.target);
  emitEvent(opts, 'media_download_url_prepare', { mediaId });
  try {
    const { url, expiresAt } = await mediaSdk.getMediaDownloadUrl(mediaId);
    emitEvent(opts, 'media_download_url_complete', { mediaId, expiresAt });
    emitResult(opts, { ok: true, mediaId, url, expiresAt }, () => {
      console.log(url);
    });
  } catch (err) {
    emitError(opts, 'media_download_url', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }
}
