import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, extname } from 'node:path';
import {
  ApiError,
  media,
  type MediaUploadRequestContentType,
  type MediaFinalizeRequestAudioRole,
  type MediaResponse,
} from '@cueframe/sdk';
import { initSdk, formatError } from '../remote/sdkClient.js';
import { ExitCode, exitCodeForError, exitWith } from '../remote/exitCodes.js';
import { emitResult, emitEvent, emitError, emitErrorJson, spinner as oraSpinner, info } from '../remote/output.js';

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_CONSECUTIVE_POLL_FAILURES = 5;

const CONTENT_TYPES: Record<string, MediaUploadRequestContentType> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function contentTypeFor(
  filename: string,
  opts: { json?: boolean },
): MediaUploadRequestContentType {
  const ext = extname(filename).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    const err = new Error(
      `Unsupported file extension "${ext || '(none)'}" for ${filename}. Supported: ${Object.keys(CONTENT_TYPES).join(', ')}.`,
    );
    emitError(opts, 'preflight', err, ExitCode.UserError);
    exitWith(ExitCode.UserError);
  }
  return contentType;
}

const AUDIO_ROLES = ['vo', 'music', 'sfx', 'ambience'] as const;

export async function uploadCommand(
  filePath: string,
  opts: {
    target: string;
    analyze: boolean;
    audioRole?: string;
    json?: boolean;
    dryRun?: boolean;
  },
) {
  if (!existsSync(filePath)) {
    emitError(opts, 'preflight', new Error(`File not found: ${filePath}`), ExitCode.UserError);
    exitWith(ExitCode.UserError);
  }

  const filename = basename(filePath);
  const fileSize = (await stat(filePath)).size;
  const contentType = contentTypeFor(filename, opts);

  if (opts.audioRole && !AUDIO_ROLES.includes(opts.audioRole as any)) {
    const err = new Error(
      `--audio-role must be one of ${AUDIO_ROLES.join('|')} (got "${opts.audioRole}")`,
    );
    emitError(opts, 'preflight', err, ExitCode.UserError);
    exitWith(ExitCode.UserError);
  }
  const audioRole = opts.audioRole as MediaFinalizeRequestAudioRole | undefined;

  if (opts.dryRun) {
    emitEvent(opts, 'upload_dry_run', {
      file: filename,
      sizeBytes: fileSize,
      contentType,
      target: opts.target,
      analyzeAfter: !!opts.analyze,
      wouldCall: 'POST /v1/media → presigned PUT → POST /v1/media/:id/finalize → poll processing',
    });
    if (!opts.json) {
      console.log(
        `[dry-run] Would upload ${filename} ` +
          `(${(fileSize / 1024 / 1024).toFixed(1)} MB, ${contentType}) to ${opts.target}.`,
      );
    }
    return;
  }

  initSdk(opts.target);

  emitEvent(opts, 'upload_prepare', {
    file: filename,
    sizeBytes: fileSize,
    contentType,
    target: opts.target,
  });

  const spinner = oraSpinner('Preparing upload…', opts.json);
  let mediaItemId: string;
  let uploadUrl: string;
  try {
    const result = await media.createMediaUpload({ filename, contentType, size: fileSize });
    mediaItemId = result.id;
    uploadUrl = result.uploadUrl;
    spinner.succeed('Ready');
    emitEvent(opts, 'upload_ready', {
      mediaItemId,
    });
  } catch (err) {
    spinner.fail(`Failed: ${formatError(err)}`);
    emitErrorJson(opts, 'upload_prepare', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }

  const uploadStart = Date.now();
  const uploadSpinner = oraSpinner(
    `Uploading ${filename} (${(fileSize / 1024 / 1024).toFixed(1)} MB)…`,
    opts.json,
  );
  try {
    const buf = await readFile(filePath);
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: buf,
    });
    if (!putRes.ok) {
      throw new Error(`presigned PUT failed: ${putRes.status} ${putRes.statusText}`);
    }
    await media.finalizeMedia(mediaItemId, audioRole ? { audioRole } : {});
    uploadSpinner.succeed(`Uploaded: ${filename}`);
    emitEvent(opts, 'upload_complete', {
      mediaItemId,
      bytesUploaded: fileSize,
      ...(audioRole ? { audioRole } : {}),
      durationMs: Date.now() - uploadStart,
    });
  } catch (err) {
    uploadSpinner.fail(`Upload failed: ${formatError(err)}`);
    emitErrorJson(opts, 'upload', err, ExitCode.NetworkError);
    exitWith(ExitCode.NetworkError);
  }

  const processSpinner = oraSpinner('Processing (transcription)…', opts.json);
  const start = Date.now();
  let finalItem: MediaResponse | null = null;
  let consecutivePollFailures = 0;
  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    if (Date.now() - start > POLL_TIMEOUT_MS) {
      const message = `Processing did not complete within ${Math.round(POLL_TIMEOUT_MS / 60000)}m. Media item ID: ${mediaItemId}.`;
      processSpinner.fail(message);
      emitErrorJson(opts, 'process', new Error(message), ExitCode.ApiServerError);
      exitWith(ExitCode.ApiServerError);
    }

    try {
      const item = await media.getMedia(mediaItemId);
      consecutivePollFailures = 0;
      const phase: string = item?.processingStatus?.phase ?? 'unknown';
      const percent = item?.processingStatus?.percent ?? null;
      const elapsedSec = Math.round((Date.now() - start) / 1000);
      const pct = percent != null ? ` · ${Math.round(percent * 100)}%` : '';
      processSpinner.text = `Processing… ${phase}${pct} (${elapsedSec}s)`;
      emitEvent(opts, 'process_progress', {
        phase,
        percent,
        elapsedSec,
      });
      if (phase === 'complete' || phase === 'completed') {
        processSpinner.succeed(`Ready: ${mediaItemId}`);
        finalItem = item;
        emitEvent(opts, 'process_complete', {
          mediaItemId,
          durationMs: Date.now() - start,
          item,
        });
        break;
      }
      if (phase === 'error') {
        const message = item?.processingStatus?.error ?? 'unknown error';
        processSpinner.fail(`Processing failed: ${message}`);
        emitErrorJson(
          opts,
          'process',
          new Error(message),
          ExitCode.ApiServerError,
        );
        exitWith(ExitCode.ApiServerError);
      }
    } catch (err) {
      if (err instanceof ApiError && [401, 403, 404].includes(err.status)) {
        processSpinner.fail(`Processing check failed: ${formatError(err)}`);
        emitErrorJson(opts, 'process', err, exitCodeForError(err));
        exitWith(exitCodeForError(err));
      }
      consecutivePollFailures++;
      if (consecutivePollFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        processSpinner.fail(`Processing check failed: ${formatError(err)}`);
        emitErrorJson(
          opts,
          'process',
          new Error(
            `Processing status unreadable after ${MAX_CONSECUTIVE_POLL_FAILURES} consecutive failures: ${formatError(err)}`,
          ),
          exitCodeForError(err),
        );
        exitWith(exitCodeForError(err));
      }
    }
  }

  if (opts.analyze) {
    info(`\nMedia item ID: ${mediaItemId}`, opts);
    const { analyzeCommand } = await import('./analyze.js');
    await analyzeCommand(mediaItemId, { target: opts.target, wait: true, json: opts.json });
    return { mediaItemId, item: finalItem };
  }

  if (!opts.json) {
    emitResult(opts, { mediaItemId, item: finalItem }, () => {
      console.log(`\nMedia item ID: ${mediaItemId}`);
      console.log(`\nRun \`cueframe analyze ${mediaItemId} --target ${opts.target}\` to generate clip suggestions.`);
    });
  }

  return { mediaItemId, item: finalItem };
}
