
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { exports as exportsSdk } from '@cueframe/sdk';
import { initSdk, formatError, ApiError } from '../remote/sdkClient.js';
import { ExitCode, exitCodeForError, exitWith } from '../remote/exitCodes.js';
import { emitEvent, emitError, emitErrorJson, info, spinner as oraSpinner } from '../remote/output.js';
import { assertCleanIdentifier } from '../remote/validate.js';

type Format = 'fcpxml' | 'premiere';

interface ExportOpts {
  target: string;
  projectId: string;
  suggestionId: string;
  out?: string;
  wait?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
  json?: boolean;
}

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;

export async function exportCommand(format: Format, opts: ExportOpts) {
  assertCleanIdentifier(opts.projectId, 'projectId', opts);
  assertCleanIdentifier(opts.suggestionId, 'suggestionId', opts);

  initSdk(opts.target);

  emitEvent(opts, 'export_prepare', {
    projectId: opts.projectId,
    suggestionId: opts.suggestionId,
    format,
    target: opts.target,
  });

  const create = oraSpinner(`Queuing ${format} export…`, opts.json);
  let exportId: string;
  try {
    const fn = format === 'fcpxml' ? exportsSdk.createFcpxmlExport : exportsSdk.createPremiereExport;
    const row = await fn(opts.projectId, { clipSuggestionId: opts.suggestionId });
    exportId = row.id;
    create.succeed(`Export queued: ${exportId}`);
  } catch (err) {
    create.fail(`Failed: ${formatError(err)}`);
    emitErrorJson(opts, 'export_prepare', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }

  emitEvent(opts, 'export_queued', {
    exportId,
    projectId: opts.projectId,
    format,
  });

  if (!opts.wait) {
    info(
      `Poll status with: cueframe api GET /v1/projects/${opts.projectId}/exports/${exportId}`,
      opts,
    );
    return;
  }

  const result = await pollUntilTerminal(opts.projectId, exportId, opts);

  if (result.kind === 'failed') {
    emitError(
      opts,
      'export_progress',
      Object.assign(new Error(result.message), result.error ? { details: result.error } : {}),
      ExitCode.ApiServerError,
    );
    if (!opts.json) {
      console.error(`Export failed: ${result.message}`);
    }
    exitWith(ExitCode.ApiServerError);
  }

  if (!result.outputUrl) {
    emitError(
      opts,
      'export_complete',
      new Error('Export reported complete but no outputUrl was returned.'),
      ExitCode.ApiServerError,
    );
    if (!opts.json) {
      console.error(
        `Export reported complete but no outputUrl was returned.\n  Export ID: ${exportId}\n  Re-fetch via GET /v1/projects/${opts.projectId}/exports/${exportId}.`,
      );
    }
    exitWith(ExitCode.ApiServerError);
  }

  const ext = 'zip';
  const outPath = opts.out ?? `./export-${exportId.slice(0, 8)}.${ext}`;
  const saved = await downloadArtifact(result.outputUrl, outPath, opts.json);

  emitEvent(opts, 'export_complete', {
    exportId,
    projectId: opts.projectId,
    format,
    outputUrl: result.outputUrl,
    outputExpiresAt: result.outputExpiresAt,
    outputSizeBytes: result.outputSizeBytes,
    trimCacheHit: result.trimCacheHit,
    outputPath: saved,
  });
}

type TerminalResult =
  | {
      kind: 'complete';
      outputUrl: string | null;
      outputExpiresAt: string | null;
      outputSizeBytes: number | null;
      trimCacheHit: boolean | null;
    }
  | {
      kind: 'failed';
      message: string;
      error: { phase: string; retryable: boolean } | null;
    };

async function pollUntilTerminal(
  projectId: string,
  exportId: string,
  opts: ExportOpts,
): Promise<TerminalResult> {
  const deadline = Date.now() + (opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const interval = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const start = Date.now();
  const poll = oraSpinner('Exporting…', opts.json);

  try {
    while (Date.now() < deadline) {
      let row: Awaited<ReturnType<typeof exportsSdk.getExport>>;
      try {
        row = await exportsSdk.getExport(projectId, exportId);
      } catch (err) {
        if (err instanceof ApiError && err.status >= 500) {
          await sleep(interval);
          continue;
        }
        poll.fail(`Failed to poll: ${formatError(err)}`);
        throw err;
      }

      const elapsed = Math.round((Date.now() - start) / 1000);
      const pct = Math.round((row.progress ?? 0) * 100);
      poll.text = `Exporting… ${row.status}${pct > 0 ? ` · ${pct}%` : ''} (${elapsed}s)`;

      emitEvent(opts, 'export_progress', {
        exportId,
        status: row.status,
        progress: row.progress,
        elapsedSec: elapsed,
      });

      if (row.status === 'complete') {
        poll.succeed(`Export complete (${elapsed}s)`);
        return {
          kind: 'complete',
          outputUrl: row.outputUrl ?? null,
          outputExpiresAt: row.outputExpiresAt ?? null,
          outputSizeBytes: row.outputSizeBytes ?? null,
          trimCacheHit: row.trimCacheHit ?? null,
        };
      }
      if (row.status === 'error' || row.status === 'cancelled') {
        const message = row.error?.message ?? `Export ${row.status}`;
        poll.fail(message);
        return {
          kind: 'failed',
          message,
          error: row.error
            ? { phase: row.error.phase, retryable: !!row.error.retryable }
            : null,
        };
      }

      await sleep(interval);
    }
    poll.fail(`Timed out waiting for export (${Math.round((Date.now() - start) / 1000)}s)`);
    return {
      kind: 'failed',
      message: `Timed out after ${Math.round((opts.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000)}s`,
      error: null,
    };
  } catch (err) {
    emitError(opts, 'export_progress', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }
}

async function downloadArtifact(url: string, outPath: string, json: boolean | undefined): Promise<string> {
  const resolved = resolve(outPath);
  const dl = oraSpinner(`Downloading → ${resolved}…`, json);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(resolved, buf);
    dl.succeed(`Saved: ${resolved} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
    return resolved;
  } catch (err) {
    dl.fail(`Download failed: ${formatError(err)}`);
    if (!json) console.error(`\nExport URL (7-day TTL): ${url}`);
    exitWith(ExitCode.NetworkError);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
