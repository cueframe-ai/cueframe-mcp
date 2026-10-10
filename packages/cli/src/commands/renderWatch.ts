
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { type Ora } from 'ora';
import {
  ApiError,
  iterRenderEvents,
  renders,
  type CompleteFrame,
} from '@cueframe/sdk';
import { initSdk, formatError } from '../remote/sdkClient.js';
import { ExitCode, exitCodeForError, exitWith } from '../remote/exitCodes.js';
import { emitEvent, emitError, emitErrorJson, spinner as oraSpinner } from '../remote/output.js';
import { assertCleanIdentifier } from '../remote/validate.js';

const RECONNECT_BACKOFF_MS = 1500;
const POLL_FALLBACK_MS = 4000;
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_CONSECUTIVE_TRANSPORT_FAILURES = 5;

export type WatchResult =
  | { kind: 'complete'; outputUrl: string | null; outputExpiresAt: string | null; duration: number | null }
  | { kind: 'failed'; message: string };

interface WatchOpts {
  timeoutMs?: number;
  spinner?: Ora;
  onProgress?: (p: { phase: string; percent: number; elapsedSec: number }) => void;
  reconnectBackoffMs?: number;
}

export async function watchRender(
  projectId: string,
  renderId: string,
  opts: WatchOpts = {},
): Promise<WatchResult> {
  const deadline = Date.now() + (opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const backoffMs = opts.reconnectBackoffMs ?? RECONNECT_BACKOFF_MS;
  const start = Date.now();
  let consecutiveTransportFailures = 0;

  while (Date.now() < deadline) {
    let terminal: WatchResult | null = null;
    let pollFallback = false;

    try {
      for await (const ev of iterRenderEvents(projectId, renderId)) {
        consecutiveTransportFailures = 0;
        if (ev.event === 'progress') {
          const elapsed = Math.round((Date.now() - start) / 1000);
          if (opts.spinner) {
            const pct = Math.round(ev.data.percent * 100);
            opts.spinner.text = `Rendering… ${ev.data.phase}${pct > 0 ? ` · ${pct}%` : ''} (${elapsed}s)`;
          }
          opts.onProgress?.({
            phase: ev.data.phase,
            percent: ev.data.percent,
            elapsedSec: elapsed,
          });
          continue;
        }
        if (ev.event === 'complete') {
          terminal = {
            kind: 'complete',
            outputUrl: ev.data.outputUrl,
            outputExpiresAt: ev.data.outputExpiresAt,
            duration: ev.data.duration,
          };
        } else {
          terminal = { kind: 'failed', message: ev.data.message };
        }
        break;
      }
    } catch (err) {
      if (err instanceof ApiError) {
        pollFallback = true;
      } else {
        consecutiveTransportFailures++;
        if (consecutiveTransportFailures >= MAX_CONSECUTIVE_TRANSPORT_FAILURES) {
          throw Object.assign(
            new Error(
              `Render stream unreachable after ${MAX_CONSECUTIVE_TRANSPORT_FAILURES} consecutive transport failures: ${
                err instanceof Error ? err.message : String(err)
              }`,
            ),
            { cause: err },
          );
        }
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
    }

    if (terminal) return terminal;

    if (pollFallback) {
      const polled = await pollOnce(projectId, renderId);
      if (polled) return polled;
      await new Promise((r) => setTimeout(r, POLL_FALLBACK_MS));
      continue;
    }

    await new Promise((r) => setTimeout(r, backoffMs));
  }

  return {
    kind: 'failed',
    message: `Timed out waiting for render to reach a terminal state. Render ID: ${renderId}, Project ID: ${projectId}.`,
  };
}

async function pollOnce(projectId: string, renderId: string): Promise<WatchResult | null> {
  const job = await renders.getRender(projectId, renderId);
  if (job.status === 'complete') {
    return {
      kind: 'complete',
      outputUrl: job.outputUrl ?? null,
      outputExpiresAt: null,
      duration: null,
    };
  }
  if (job.status === 'error' || job.status === 'cancelled') {
    return {
      kind: 'failed',
      message: (job as { error?: string }).error ?? `Render ${job.status}`,
    };
  }
  return null;
}

export async function renderWatchCommand(
  renderId: string,
  opts: { target: string; project: string; out?: string; download: boolean; json?: boolean },
) {
  assertCleanIdentifier(renderId, 'renderId', opts);
  assertCleanIdentifier(opts.project, 'projectId', opts);
  initSdk(opts.target);

  emitEvent(opts, 'render_watch_prepare', {
    renderId,
    projectId: opts.project,
    target: opts.target,
  });

  const spinner = oraSpinner(`Watching render ${renderId}…`, opts.json);
  let result: WatchResult;
  try {
    result = await watchRender(opts.project, renderId, {
      spinner,
      onProgress: (p) => emitEvent(opts, 'render_progress', { renderId, ...p }),
    });
  } catch (err) {
    spinner.fail(`Failed to watch render: ${formatError(err)}`);
    emitErrorJson(opts, 'render_watch', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }

  if (result.kind === 'failed') {
    spinner.fail(result.message);
    emitErrorJson(opts, 'render_watch', new Error(result.message), ExitCode.ApiServerError);
    exitWith(ExitCode.ApiServerError);
  }

  spinner.succeed(`Render complete (${renderId})`);

  let outputPath: string | null = null;
  if (opts.download && result.outputUrl) {
    outputPath = await downloadOutput(
      result.outputUrl,
      opts.out ?? `./reel-${renderId.slice(0, 8)}.mp4`,
      opts.json,
    );
  } else if (!result.outputUrl) {
    emitError(
      opts,
      'render_watch',
      new Error('Render reported complete but no outputUrl was returned.'),
      ExitCode.ApiServerError,
    );
    if (!opts.json) {
      console.error(
        `Render reported complete but no outputUrl was returned.\n  Re-fetch via GET /v1/projects/${opts.project}/renders/${renderId}.`,
      );
    }
    exitWith(ExitCode.ApiServerError);
  }

  emitEvent(opts, 'render_complete', {
    renderId,
    projectId: opts.project,
    outputUrl: result.outputUrl,
    outputExpiresAt: result.outputExpiresAt,
    duration: result.duration,
    outputPath,
  });
  if (!opts.json) {
    if (result.outputUrl) console.log(`MP4 URL: ${result.outputUrl}`);
    if (result.outputExpiresAt) console.log(`Expires: ${result.outputExpiresAt}`);
    if (result.duration != null) console.log(`Duration: ${result.duration}s`);
  }
}

export async function downloadOutput(
  outputUrl: string,
  outPath: string,
  json?: boolean,
): Promise<string> {
  const resolved = resolve(outPath);
  const dl = oraSpinner(`Downloading → ${resolved}…`, json);
  try {
    const res = await fetch(outputUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(resolved, buf);
    dl.succeed(`Saved: ${resolved} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
    return resolved;
  } catch (err) {
    dl.fail(`Download failed: ${formatError(err)}`);
    console.error(`\nMP4 URL (1-hour TTL): ${outputUrl}`);
    exitWith(ExitCode.NetworkError);
  }
}

export type { CompleteFrame };
