
import { readFileSync } from 'fs';
import { ApiError, adviseError, requestRaw, type RawResponse } from '@cueframe/sdk';
import { compositionPath, normalizeEtag } from '../remote/compositionPath.js';
import { initSdk } from '../remote/sdkClient.js';
import { ExitCode, exitCodeForStatus, exitWith } from '../remote/exitCodes.js';
import { emitEvent, emitError, emitResult, info } from '../remote/output.js';
import { assertCleanIdentifier } from '../remote/validate.js';

interface CommonOpts {
  target: string;
  json?: boolean;
}

interface GetOpts extends CommonOpts {}

interface PutOpts extends CommonOpts {
  body: string;
  ifMatch?: string;
  force?: boolean;
}

interface FromSuggestionOpts extends CommonOpts {
  suggestionId: string;
  ifMatch?: string;
  force?: boolean;
  format?: string;
}

interface ValidateOpts extends CommonOpts {
  body: string;
}

export async function compositionGetCommand(projectId: string, opts: GetOpts) {
  assertCleanIdentifier(projectId, 'projectId', opts);
  initSdk(opts.target);

  emitEvent(opts, 'composition_get_prepare', { projectId });

  const raw = await safeRequest(compositionPath(projectId), { method: 'GET' }, opts, 'composition_get');

  if (raw.status >= 400) {
    emitApiError(raw, opts, 'composition_get');
    exitWith(exitCodeForStatus(raw.status));
  }

  const rawEtag = raw.headers['etag'];
  const etag = rawEtag ? normalizeEtag(rawEtag) : rawEtag;
  emitEvent(opts, 'composition_get_complete', { projectId, etag, status: raw.status });

  emitResult(opts, { etag, composition: raw.body }, () => {
    if (etag) console.log(`# ETag: ${etag}`);
    console.log(JSON.stringify(raw.body, null, 2));
  });
}


export async function compositionPutCommand(projectId: string, opts: PutOpts) {
  assertCleanIdentifier(projectId, 'projectId', opts);
  if (!opts.body) {
    console.error('--body is required (inline JSON, @file.json, or @- for stdin)');
    exitWith(ExitCode.UserError);
  }

  const ifMatch = requireIfMatch(opts);

  initSdk(opts.target);

  const bodyText = await resolveBodyArg(opts.body);

  emitEvent(opts, 'composition_put_prepare', { projectId, ifMatch });

  const headers = new Headers({
    'content-type': 'application/json',
    'if-match': ifMatch,
  });

  const raw = await safeRequest(
    `/v1/projects/${projectId}/composition`,
    { method: 'PUT', headers, body: bodyText },
    opts,
    'composition_put',
  );

  if (raw.status >= 400) {
    emitApiError(raw, opts, 'composition_put');
    exitWith(exitCodeForStatus(raw.status));
  }

  const etag = raw.headers['etag'];
  emitEvent(opts, 'composition_put_complete', {
    projectId,
    etag,
    status: raw.status,
    response: raw.body,
  });

  emitResult(opts, { etag, response: raw.body }, () => {
    console.log(`Composition saved (ETag: ${etag ?? 'unknown'}).`);
    if (raw.body && typeof raw.body === 'object') {
      console.log(JSON.stringify(raw.body, null, 2));
    }
  });

  return { etag, response: raw.body };
}


export async function compositionFromSuggestionCommand(projectId: string, opts: FromSuggestionOpts) {
  assertCleanIdentifier(projectId, 'projectId', opts);
  if (!opts.suggestionId) {
    console.error('--suggestion <suggestionId> is required');
    exitWith(ExitCode.UserError);
  }

  initSdk(opts.target);

  const ifMatch = await resolveIfMatch(projectId, opts);

  let format: unknown;
  if (opts.format) {
    try {
      format = JSON.parse(opts.format);
    } catch {
      console.error('--format must be JSON, e.g. \'{"aspectRatio":"9:16","fps":30,"resolution":"fhd"}\'');
      exitWith(ExitCode.UserError);
    }
  }

  const body = JSON.stringify({ suggestionId: opts.suggestionId, ...(format ? { format } : {}) });

  emitEvent(opts, 'composition_from_suggestion_prepare', {
    projectId,
    suggestionId: opts.suggestionId,
    ifMatch,
  });

  let raw;
  let currentIfMatch = ifMatch;
  let attempts = 0;
  const MAX_ETAG_RETRIES = 3;
  while (true) {
    attempts++;
    const headers = new Headers({
      'content-type': 'application/json',
      'if-match': currentIfMatch,
    });
    raw = await safeRequest(
      `/v1/projects/${projectId}/composition/from-suggestion`,
      { method: 'POST', headers, body },
      opts,
      'composition_from_suggestion',
    );

    const isStaleEtag =
      raw.status === 409 &&
      (raw.body as { error?: { code?: string } } | null)?.error?.code === 'stale_etag';
    if (!isStaleEtag) break;

    if (attempts > MAX_ETAG_RETRIES) {
      emitEvent(opts, 'composition_from_suggestion_etag_retries_exhausted', {
        projectId,
        attempts: MAX_ETAG_RETRIES,
      });
      break;
    }
    emitEvent(opts, 'composition_from_suggestion_etag_retry', {
      projectId,
      attempt: attempts,
      reason: 'stale_etag',
    });
    currentIfMatch = await resolveIfMatch(projectId, opts);
  }

  if (raw.status >= 400) {
    emitApiError(raw, opts, 'composition_from_suggestion');
    exitWith(exitCodeForStatus(raw.status));
  }

  const etag = raw.headers['etag'];
  emitEvent(opts, 'composition_from_suggestion_complete', {
    projectId,
    suggestionId: opts.suggestionId,
    etag,
    status: raw.status,
    response: raw.body,
    attempts,
  });

  emitResult(opts, { etag, response: raw.body }, () => {
    console.log(`Composition built from suggestion ${opts.suggestionId} (ETag: ${etag ?? 'unknown'}).`);
    if (raw.body && typeof raw.body === 'object') {
      console.log(JSON.stringify(raw.body, null, 2));
    }
  });
}


export async function compositionValidateCommand(opts: ValidateOpts) {
  if (!opts.body) {
    console.error('--body is required (inline JSON, @file.json, or @- for stdin)');
    exitWith(ExitCode.UserError);
  }

  initSdk(opts.target);

  const bodyText = await resolveBodyArg(opts.body);

  emitEvent(opts, 'composition_validate_prepare', {});

  const headers = new Headers({ 'content-type': 'application/json' });
  const raw = await safeRequest(
    '/v1/composition/validate',
    { method: 'POST', headers, body: bodyText },
    opts,
    'composition_validate',
  );

  if (raw.status >= 400) {
    emitApiError(raw, opts, 'composition_validate');
    exitWith(exitCodeForStatus(raw.status));
  }

  emitEvent(opts, 'composition_validate_complete', { status: raw.status });

  emitResult(opts, { valid: true }, () => {
    console.log('✓ Composition is valid.');
  });

  return { valid: true as const };
}


function requireIfMatch(opts: { ifMatch?: string; force?: boolean }): string {
  if (opts.ifMatch && opts.force) {
    console.error('Pass either --if-match <etag> or --force, not both.');
    exitWith(ExitCode.UserError);
  }
  if (opts.force) return '*';
  if (opts.ifMatch) return opts.ifMatch;
  console.error(
    [
      'composition put needs the ETag of the version your edit is based on, so it cannot overwrite a newer save.',
      '  Read it with `cueframe composition get <projectId>` (the `# ETag:` line, or `.etag` with --json) and pass --if-match <etag>.',
      '  Pass --force to overwrite unconditionally, or to create the first composition of a project that has none.',
    ].join('\n'),
  );
  exitWith(ExitCode.UserError);
}

async function resolveIfMatch(
  projectId: string,
  opts: { ifMatch?: string; force?: boolean; target: string; json?: boolean },
): Promise<string> {
  if (opts.force) return '*';
  if (opts.ifMatch) return opts.ifMatch;

  const raw = await safeRequest(compositionPath(projectId), { method: 'GET' }, opts, 'composition_etag_fetch');

  if (raw.status === 404) {
    info('No existing composition; treating as create (If-Match: *).', opts);
    return '*';
  }

  if (raw.status >= 400) {
    emitApiError(raw, opts, 'composition_etag_fetch');
    exitWith(exitCodeForStatus(raw.status));
  }

  const etag = raw.headers['etag'];
  if (!etag) {
    emitError(
      opts,
      'composition_etag_fetch',
      new Error('Server returned no ETag on composition GET; cannot safely thread If-Match. Pass --force to overwrite anyway.'),
      ExitCode.ApiServerError,
    );
    exitWith(ExitCode.ApiServerError);
  }
  return normalizeEtag(etag);
}

async function resolveBodyArg(arg: string): Promise<string> {
  if (arg.startsWith('@')) {
    const path = arg.slice(1);
    if (path === '-') {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString('utf-8');
    }
    return readFileSync(path, 'utf-8');
  }
  return arg;
}

async function safeRequest(
  path: string,
  init: RequestInit,
  opts: { json?: boolean },
  phase: string,
): Promise<RawResponse> {
  try {
    return await requestRaw(path, init);
  } catch (err) {
    emitError(opts, phase, err, ExitCode.NetworkError);
    exitWith(ExitCode.NetworkError);
  }
}

function emitApiError(raw: RawResponse, opts: { json?: boolean }, phase: string) {
  const wireError = (raw.body as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
  const code = wireError?.code ?? 'unknown';
  const message = wireError?.message ?? raw.statusText;
  const advice = composeAdvice(code, raw.status, wireError?.details);

  const exitCode = exitCodeForStatus(raw.status);

  if (opts.json) {
    emitError(
      opts,
      phase,
      Object.assign(new Error(message), { code, status: raw.status, details: wireError?.details, advice }),
      exitCode,
    );
  } else {
    process.stderr.write(`✖ ${phase}: ${message} (${code}, ${raw.status})\n`);
    if (advice) process.stderr.write(`  → ${advice}\n`);
  }
}

function composeAdvice(code: string, status: number, details: unknown): string | null {
  const fake = new ApiError(status, {
    code,
    message: '',
    details: (details && typeof details === 'object'
      ? (details as Record<string, unknown>)
      : undefined),
  });
  const shared = adviseError(fake);
  if (shared) return shared;

  if (status === 404) {
    return 'Project or composition not found. Run `cueframe list` to confirm the project ID; the composition may not yet exist.';
  }
  return null;
}
