import {
  ApiError,
  requestRaw,
  type FormatFps,
  type FormatResolution,
} from '@cueframe/sdk';
import { initSdk, formatError } from '../remote/sdkClient.js';
import { ExitCode, exitCodeForError, exitWith } from '../remote/exitCodes.js';
import { downloadOutput, watchRender } from './renderWatch.js';
import { emitEvent, emitError, emitErrorJson, spinner as oraSpinner } from '../remote/output.js';
import { assertCleanIdentifier } from '../remote/validate.js';
import { deriveIdempotencyKey } from '../remote/idempotency.js';

async function fetchCompositionEtag(projectId: string): Promise<string> {
  const res = await requestRaw(`/v1/projects/${projectId}/composition`, {
    method: 'GET',
  });
  if (res.status === 404) return 'no-composition';
  if (res.status >= 400) {
    return 'unknown-composition';
  }
  return res.headers['etag'] ?? 'no-etag';
}

export async function renderCommand(
  projectId: string,
  opts: {
    target: string;
    aspect?: '9:16' | '1:1' | '16:9';
    fps?: FormatFps;
    resolution?: FormatResolution;
    out?: string;
    json?: boolean;
    dryRun?: boolean;
    idempotencyKey?: string;
    priority?: 'interactive' | 'standard' | 'background';
    intent?: 'preview' | 'final';
  },
) {
  assertCleanIdentifier(projectId, 'projectId', opts);

  if (opts.dryRun) {
    emitEvent(opts, 'render_dry_run', {
      projectId,
      target: opts.target,
      wouldCall: 'POST /v1/projects/:id/renders → SSE watch → download MP4',
    });
    if (!opts.json) {
      console.log(
        `[dry-run] Would render project ${projectId} on ${opts.target}.`,
      );
    }
    return;
  }

  initSdk(opts.target);

  emitEvent(opts, 'render_prepare', {
    projectId,
    target: opts.target,
  });

  let idempotencyKey: string;
  try {
    idempotencyKey =
      opts.idempotencyKey ??
      (await deriveIdempotencyKey('render', [
        projectId,
        await fetchCompositionEtag(projectId),
      ]));
    emitEvent(opts, 'idempotency_key', {
      scope: 'render',
      key: idempotencyKey,
      overridden: !!opts.idempotencyKey,
    });
  } catch (err) {
    idempotencyKey = '';
    emitEvent(opts, 'idempotency_key', {
      scope: 'render',
      key: null,
      skipped: true,
      reason: err instanceof Error ? err.message : String(err),
    });
  }

  const create = oraSpinner('Queuing render…', opts.json);
  let renderId: string;
  let renderStatus: string;
  let isReplay = false;
  try {
    const body: Record<string, unknown> = opts.aspect
      ? {
          format: {
            aspectRatio: opts.aspect,
            fps: opts.fps ?? 30,
            resolution: opts.resolution ?? 'fhd',
          },
        }
      : {};
    if (opts.priority) body.priority = opts.priority;
    if (opts.intent) body.intent = opts.intent;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;

    const raw = await requestRaw(`/v1/projects/${projectId}/renders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (raw.status >= 400) {
      const wire = (raw.body as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiError(raw.status, {
        code: wire?.code ?? 'unknown',
        message: wire?.message ?? raw.statusText,
      });
    }
    const job = raw.body as { id: string; status: string };
    renderId = job.id;
    renderStatus = job.status;
    isReplay = raw.headers['idempotency-replay'] === 'true';
    create.succeed(
      isReplay
        ? `Render replayed: ${renderId} (status: ${renderStatus})`
        : `Render queued: ${renderId}`,
    );
  } catch (err) {
    create.fail(`Failed: ${formatError(err)}`);
    emitErrorJson(opts, 'render_prepare', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }

  if (isReplay) {
    emitEvent(opts, 'render_idempotent_replay', {
      renderId,
      projectId,
      status: renderStatus,
      idempotencyKey,
    });
  } else {
    emitEvent(opts, 'render_queued', { renderId, projectId });
  }

  const poll = oraSpinner('Rendering…', opts.json);
  let result: Awaited<ReturnType<typeof watchRender>>;
  try {
    result = await watchRender(projectId, renderId, {
      spinner: poll,
      onProgress: (p) => emitEvent(opts, 'render_progress', { renderId, ...p }),
    });
  } catch (err) {
    poll.fail(`Failed to watch render: ${formatError(err)}`);
    emitErrorJson(opts, 'render_progress', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }

  if (result.kind === 'failed') {
    poll.fail(result.message);
    emitErrorJson(opts, 'render_progress', new Error(result.message), ExitCode.ApiServerError);
    exitWith(ExitCode.ApiServerError);
  }

  poll.succeed('Render complete');

  if (!result.outputUrl) {
    emitError(
      opts,
      'render_complete',
      new Error('Render reported complete but no outputUrl was returned.'),
      ExitCode.ApiServerError,
    );
    if (!opts.json) {
      console.error(
        `Render reported complete but no outputUrl was returned.\n  Render ID: ${renderId}\n  Project ID: ${projectId}\n  Re-fetch via GET /v1/projects/${projectId}/renders/${renderId} once the URL is signed.`,
      );
    }
    exitWith(ExitCode.ApiServerError);
  }

  const outPath = await downloadOutput(
    result.outputUrl,
    opts.out ?? `./reel-${renderId.slice(0, 8)}.mp4`,
    opts.json,
  );

  emitEvent(opts, 'render_complete', {
    renderId,
    projectId,
    outputUrl: result.outputUrl,
    outputExpiresAt: result.outputExpiresAt,
    duration: result.duration,
    outputPath: outPath,
  });

  return {
    renderId,
    projectId,
    outputUrl: result.outputUrl,
    outputExpiresAt: result.outputExpiresAt,
    duration: result.duration,
    outputPath: outPath,
  };
}
