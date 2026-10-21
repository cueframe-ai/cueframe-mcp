import {
  ApiError,
  normalizeEtag,
  requestRaw,
  type FormatAspectRatio,
  type FormatFps,
  type FormatResolution,
  type RenderCreateRequest,
  type RenderCreateRequestIntent,
  type RenderCreateRequestPriority,
} from '@cueframe/sdk';
import { initSdk, formatError } from '../remote/sdkClient.js';
import { ExitCode, exitCodeForError, exitWith } from '../remote/exitCodes.js';
import { downloadOutput, watchRender } from './renderWatch.js';
import { emitEvent, emitError, emitErrorJson, spinner as oraSpinner } from '../remote/output.js';
import { assertCleanIdentifier } from '../remote/validate.js';
import { canonicalJson, deriveIdempotencyKey } from '../remote/idempotency.js';
import { compositionPath } from '../remote/compositionPath.js';

async function fetchCompositionEtag(projectId: string): Promise<string> {
  let res;
  try {
    res = await requestRaw(compositionPath(projectId), { method: 'GET' });
  } catch (err) {
    throw Object.assign(
      new Error(`Could not read the composition ETag to derive the render's Idempotency-Key: ${formatError(err)}. Retry, or pass --idempotency-key.`),
      { exitCode: ExitCode.NetworkError },
    );
  }
  // A project with no composition yet renders from its clip; the key still covers project and body.
  if (res.status === 404) return 'no-composition';
  const etag = res.headers['etag'];
  if (res.status >= 400 || !etag) {
    const wire = (res.body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status >= 400 ? res.status : 502, {
      code: wire?.code ?? 'composition_etag_unavailable',
      message: `Could not read the composition ETag to derive the render's Idempotency-Key (${res.status}${wire?.message ? `: ${wire.message}` : ''}). Retry, or pass --idempotency-key.`,
    });
  }
  return normalizeEtag(etag);
}

export async function renderCommand(
  projectId: string,
  opts: {
    target: string;
    aspect?: FormatAspectRatio;
    fps?: FormatFps;
    resolution?: FormatResolution;
    out?: string;
    json?: boolean;
    dryRun?: boolean;
    idempotencyKey?: string;
    priority?: RenderCreateRequestPriority;
    intent?: RenderCreateRequestIntent;
  },
) {
  assertCleanIdentifier(projectId, 'projectId', opts);

  if (!opts.aspect && (opts.fps !== undefined || opts.resolution !== undefined)) {
    console.error(
      '--fps and --resolution need --aspect: a render format override names its aspect ratio, which must match the composition\'s.',
    );
    exitWith(ExitCode.UserError);
  }

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

  const body: RenderCreateRequest = {};
  if (opts.aspect) {
    body.format = {
      aspectRatio: opts.aspect,
      ...(opts.fps !== undefined ? { fps: opts.fps } : {}),
      ...(opts.resolution !== undefined ? { resolution: opts.resolution } : {}),
    };
  }
  if (opts.priority) body.priority = opts.priority;
  if (opts.intent) body.intent = opts.intent;

  let idempotencyKey: string;
  try {
    idempotencyKey =
      opts.idempotencyKey ??
      (await deriveIdempotencyKey('render', [
        projectId,
        await fetchCompositionEtag(projectId),
        canonicalJson(body),
      ]));
  } catch (err) {
    emitError(opts, 'render_prepare', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }
  emitEvent(opts, 'idempotency_key', {
    scope: 'render',
    key: idempotencyKey,
    overridden: !!opts.idempotencyKey,
  });

  const create = oraSpinner('Queuing render…', opts.json);
  let renderId: string;
  let renderStatus: string;
  let isReplay = false;
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    };

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
