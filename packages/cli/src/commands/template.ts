import { existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { request, requestRaw } from '@cueframe/sdk';
import { initSdk, formatError } from '../remote/sdkClient.js';
import { ExitCode, exitCodeForError, exitCodeForStatus, exitWith } from '../remote/exitCodes.js';
import { emitError, emitEvent, emitResult } from '../remote/output.js';
import { coerceText, readTemplateShape, type TemplateShape } from '../internal/templateDocument.js';
import { uploadCommand } from './upload.js';
import { renderCommand } from './render.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ORG_TEMPLATE_ID = /^[a-z0-9]{28,40}$/;
const CATALOG_RAW = 'https://raw.githubusercontent.com/cueframe-ai/cueframe-templates/main';
const APPLY_RETRY_MS = 3_000;
const PREPARE_TIMEOUT_MS = 60 * 60_000;

export type TemplateRef =
  | { kind: 'file'; path: string }
  | { kind: 'slug'; slug: string }
  | { kind: 'org'; id: string };

/** A `.cueframe` path, a public catalog slug, or an org template id. */
export function resolveTemplate(input: string): TemplateRef {
  const path = resolve(input);
  if (input.endsWith('.cueframe') || existsSync(path)) return { kind: 'file', path };
  if (ORG_TEMPLATE_ID.test(input) && !input.includes('-')) return { kind: 'org', id: input };
  if (SLUG.test(input)) return { kind: 'slug', slug: input };
  throw new Error(`"${input}" is not a .cueframe file, a catalog slug, or a template id.`);
}

export type MediaChoice = { mediaId: string } | { url: string } | { sample: true };

/** `name=<file|https url|sample|media:<id>>`; files are uploaded at run time. */
export function parseMediaArg(arg: string): { name: string; file?: string; value?: MediaChoice } {
  const at = arg.indexOf('=');
  if (at <= 0) throw new Error(`--media takes name=<file|https url|sample|media:<id>>, got "${arg}".`);
  const name = arg.slice(0, at);
  const raw = arg.slice(at + 1);
  if (raw === 'sample') return { name, value: { sample: true } };
  if (/^media:[A-Za-z0-9_-]+$/.test(raw)) return { name, value: { mediaId: raw.slice(6) } };
  if (/^https:\/\//.test(raw)) return { name, value: { url: raw } };
  if (/^[a-z]+:\/\//.test(raw)) throw new Error(`--media ${name}: only https URLs can be imported, got "${raw}".`);
  return { name, file: resolve(raw) };
}

/** `name=value` pairs; the value stays a string until the document's parameter coerces it. */
export function parseValueArgs(args: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const arg of args) {
    const at = arg.indexOf('=');
    if (at <= 0) throw new Error(`--values takes name=value, got "${arg}".`);
    values[arg.slice(0, at)] = arg.slice(at + 1);
  }
  return values;
}

/**
 * Every value coerced to its declared parameter's JSON type; a list of what did not fit.
 * Whether a value is one the parameter accepts (an enum option, a number in range) is
 * the server's verdict: the kernel runs there, on publish and on a dry run.
 */
export function coerceValues(document: TemplateShape, raw: Record<string, string>): { values: Record<string, unknown>; problems: string[] } {
  const values: Record<string, unknown> = {};
  const problems: string[] = [];
  const byName = new Map(document.parameters.map((p) => [p.name, p] as const));
  for (const [name, text] of Object.entries(raw)) {
    const param = byName.get(name);
    if (!param) { problems.push(`${name}: not a parameter of ${document.slug}`); continue; }
    if (param.type === 'media') { problems.push(`${name}: a media parameter; pass it with --media`); continue; }
    values[name] = coerceText(param.type, text);
  }
  return { values, problems };
}

type DryRunMedia = Record<string, { mediaId: string } | { sample: true }>;
type RemoteProblem = { code?: string; param?: string; message: string };

/** The server's problem, as it phrased it: the parameter it names, its message, its code. */
function formatProblem(p: RemoteProblem): string {
  const head = p.param ? `${p.param}: ${p.message}` : p.message;
  return p.code ? `${head} (${p.code})` : head;
}

/**
 * The kernel's verdict on a document, or on inputs bound against it, from the API; nothing is stored.
 * Requires a key: the existing auth_missing path prints `cueframe login` guidance.
 */
async function validateRemote(raw: unknown, target: string, inputs?: { values?: Record<string, unknown>; media?: DryRunMedia; preset?: string }): Promise<string[]> {
  initSdk(target);
  const verdict = await request<{ ok: boolean; problems: RemoteProblem[] }>('/v1/templates', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ document: raw, dryRun: true, ...inputs }),
  });
  if (!Array.isArray(verdict?.problems)) {
    throw Object.assign(
      new Error('The server did not answer a dry run: no problems list came back. The CueFrame API at this target may not support template validation yet.'),
      { code: 'template_dry_run_unsupported', exitCode: ExitCode.ApiServerError },
    );
  }
  return verdict.ok ? [] : verdict.problems.map(formatProblem);
}

/**
 * The server binds the inputs without storing anything; a value or preset the template refuses
 * exits here. A file or url stands in as the parameter's sample; a parameter with no sample is
 * left out, and the server names it only if the template truly requires it.
 */
async function bindInputsRemote(
  raw: unknown,
  document: TemplateShape,
  inputs: { values: Record<string, unknown>; mediaArgs: ReturnType<typeof parseMediaArg>[]; preset?: string },
  opts: { target: string; json?: boolean },
): Promise<void> {
  const media: DryRunMedia = {};
  const byName = new Map(document.parameters.map((p) => [p.name, p] as const));
  for (const m of inputs.mediaArgs) {
    if (m.value && 'mediaId' in m.value) media[m.name] = { mediaId: m.value.mediaId };
    else if (byName.get(m.name)?.sample) media[m.name] = { sample: true };
  }
  let problems: string[];
  try {
    problems = await validateRemote(raw, opts.target, { values: inputs.values, media, ...(inputs.preset ? { preset: inputs.preset } : {}) });
  } catch (error) {
    const code = exitCodeForError(error);
    emitError(opts, 'template_validate', error, code);
    exitWith(code);
  }
  if (problems.length) {
    emitError(opts, 'template_inputs', new Error(problems.join('\n')), ExitCode.UserError);
    exitWith(ExitCode.UserError);
  }
}

/** The document's JSON, wherever the reference points; not yet checked by the kernel. */
async function readDocumentJson(ref: TemplateRef, target: string): Promise<unknown> {
  if (ref.kind === 'file') {
    const raw = JSON.parse(await readFile(ref.path, 'utf8')) as { v?: unknown; slug?: unknown };
    if (raw?.v !== 1 || typeof raw.slug !== 'string') throw new Error(`${ref.path} is not a CueFrame template document (v: 1, slug).`);
    return raw;
  }
  if (ref.kind === 'slug') {
    const catalogResponse = await fetch(`${CATALOG_RAW}/templates.json`, { headers: { accept: 'application/json' } });
    if (!catalogResponse.ok) throw new Error(`The public template catalog answered ${catalogResponse.status}.`);
    const catalog = await catalogResponse.json() as { schemaVersion?: number; templates?: Array<{ slug?: string; documentSha256?: string }> };
    if (catalog.schemaVersion !== 2 || !Array.isArray(catalog.templates)) throw new Error('The public template catalog is not schemaVersion 2.');
    const entry = catalog.templates.find((row) => row.slug === ref.slug);
    if (!entry) throw new Error(`The public catalog has no template "${ref.slug}".`);
    if (typeof entry.documentSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.documentSha256)) {
      throw new Error(`The public catalog has no document digest for "${ref.slug}".`);
    }
    const url = `${CATALOG_RAW}/artifacts/${entry.documentSha256}.cueframe`;
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`The public catalog has no template "${ref.slug}" (${response.status}).`);
    const bytes = await response.text();
    if (createHash('sha256').update(bytes).digest('hex') !== entry.documentSha256) {
      throw new Error(`The template ${ref.slug} changed since the catalog was read. Retry after the catalog refreshes.`);
    }
    const document = JSON.parse(bytes) as { slug?: unknown };
    if (document.slug !== ref.slug) throw new Error(`The catalog document for ${ref.slug} names ${String(document.slug)}.`);
    return document;
  }
  initSdk(target);
  const stored = await request<{ document: unknown }>(`/v1/templates/${encodeURIComponent(ref.id)}`);
  return stored.document;
}

type TemplateJob = { jobId: string; projectId: string | null; status: 'preparing' | 'ready' | 'failed' | 'cancelled'; stage: string; errorCode?: string; errorMessage?: string };

async function waitTemplateJob(job: TemplateJob, opts: { target: string; json?: boolean }): Promise<TemplateJob> {
  const started = Date.now();
  let lastStage = job.stage;
  while (job.status === 'preparing') {
    if (Date.now() - started > PREPARE_TIMEOUT_MS) {
      emitError(opts, 'template_instantiate', new Error(`Template job ${job.jobId} is still preparing after an hour. Reconnect with its job id.`), ExitCode.ApiServerError);
      exitWith(ExitCode.ApiServerError);
    }
    await new Promise((r) => setTimeout(r, APPLY_RETRY_MS));
    job = await request<TemplateJob>(`/v1/template-jobs/${encodeURIComponent(job.jobId)}`);
    if (job.stage !== lastStage) {
      lastStage = job.stage;
      emitEvent(opts, 'template_job_progress', { jobId: job.jobId, projectId: job.projectId, stage: job.stage });
    }
  }
  return job;
}

export async function templateStatusCommand(jobId: string, opts: { target: string; json?: boolean; wait?: boolean }) {
  initSdk(opts.target);
  let job = await request<TemplateJob>(`/v1/template-jobs/${encodeURIComponent(jobId)}`);
  if (opts.wait) job = await waitTemplateJob(job, opts);
  emitResult(opts, job, () => console.log(`${job.status} · ${job.stage}${job.projectId ? ` · project ${job.projectId}` : ''}`));
  if (opts.wait && job.status !== 'ready') {
    emitError(opts, job.errorCode ?? 'template_instantiate', new Error(job.errorMessage ?? `Template job ${job.jobId} ${job.status}.`), ExitCode.ApiServerError);
    exitWith(ExitCode.ApiServerError);
  }
  return job;
}

export async function templateValidateCommand(input: string, opts: { target: string; json?: boolean }) {
  let ref: TemplateRef;
  let raw: unknown;
  try {
    ref = resolveTemplate(input);
    raw = await readDocumentJson(ref, opts.target);
  } catch (error) {
    emitError(opts, 'template_read', error, ExitCode.UserError);
    exitWith(ExitCode.UserError);
  }
  // The kernel runs on the server: a document it refuses comes back as problems, not as a transport error.
  let problems: string[];
  try {
    problems = await validateRemote(raw, opts.target);
  } catch (error) {
    const code = exitCodeForError(error);
    emitError(opts, 'template_validate', error, code);
    exitWith(code);
  }
  const slug = (raw as { slug?: unknown })?.slug;
  const name = typeof slug === 'string' ? slug : input;
  const result = { template: ref.kind === 'file' ? ref.path : input, slug: name, ok: problems.length === 0, problems };
  emitResult(opts, result, () => {
    if (problems.length === 0) {
      console.log(`ok ${name}`);
      return;
    }
    console.error(`FAIL ${name}`);
    for (const problem of problems) console.error(`  ${problem}`);
  });
  if (problems.length) exitWith(ExitCode.UserError);
  return result;
}

export async function templateRunCommand(input: string, opts: {
  media: string[];
  values: string[];
  preset?: string;
  brandKitId?: string;
  idempotencyKey?: string;
  out: string;
  target: string;
  render: boolean;
  json?: boolean;
  dryRun?: boolean;
}) {
  let ref: TemplateRef;
  let raw: unknown;
  let document: TemplateShape;
  let mediaArgs: ReturnType<typeof parseMediaArg>[];
  let rawValues: Record<string, string>;
  try {
    ref = resolveTemplate(input);
    raw = await readDocumentJson(ref, opts.target);
    document = readTemplateShape(raw);
    mediaArgs = opts.media.map(parseMediaArg);
    rawValues = parseValueArgs(opts.values);
  } catch (error) {
    emitError(opts, 'template_read', error, ExitCode.UserError);
    exitWith(ExitCode.UserError);
  }

  const { values, problems } = coerceValues(document, rawValues);
  const declaredMedia = new Map(document.parameters.filter((p) => p.type === 'media').map((p) => [p.name, p] as const));
  for (const m of mediaArgs) {
    const param = declaredMedia.get(m.name);
    if (!param) problems.push(`${m.name}: not a media parameter of ${document.slug}`);
    else if (m.value && 'sample' in m.value && !param.sample) problems.push(`${m.name}: the template has no sample for it`);
    else if (m.file && !existsSync(m.file)) problems.push(`${m.name}: file not found: ${m.file}`);
  }
  if (opts.preset !== undefined && !document.presets?.[opts.preset]) {
    problems.push(`preset ${opts.preset}: not one of ${Object.keys(document.presets ?? {}).join(', ') || '(none)'}`);
  }
  for (const [name, param] of declaredMedia) {
    if (param.required && !mediaArgs.some((m) => m.name === name)) problems.push(`${name}: required; pass --media ${name}=<file|https url|media:<id>${param.sample ? '|sample' : ''}>`);
  }
  if (problems.length) {
    emitError(opts, 'template_inputs', new Error(problems.join('\n')), ExitCode.UserError);
    exitWith(ExitCode.UserError);
  }

  const templateName = ref.kind === 'file' ? ref.path : input;
  if (opts.dryRun) {
    await bindInputsRemote(raw, document, { values, mediaArgs, preset: opts.preset }, opts);
    const result = {
      template: templateName,
      slug: document.slug,
      target: opts.target,
      values,
      media: mediaArgs.map((m) => m.file ?? m.value),
      preset: opts.preset ?? null,
      render: opts.render,
      output: resolve(opts.out),
      wouldRun: [
        ...(ref.kind === 'file' ? ['publish the document to your org'] : []),
        ...mediaArgs.filter((m) => m.file).map((m) => `upload ${m.name}`),
        'start template preparation job',
        'wait for the ready project',
        ...(opts.render ? ['render and download MP4'] : []),
      ],
    };
    emitResult(opts, result, () => console.log(`[dry-run] Template inputs bind. Would create a project from ${document.name}.`));
    return result;
  }

  emitEvent(opts, 'template_run_prepare', { template: templateName, slug: document.slug, target: opts.target, preset: opts.preset ?? null });

  initSdk(opts.target);
  let templateId = ref.kind === 'file' ? '' : ref.kind === 'slug' ? ref.slug : ref.id;
  if (ref.kind === 'file') {
    // A republish bumps the org template's version; the server binds the inputs first so a typo in --values stores nothing.
    await bindInputsRemote(raw, document, { values, mediaArgs, preset: opts.preset }, opts);
    try {
      const published = await request<{ id: string; version: number }>('/v1/templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document: raw }),
      });
      templateId = published.id;
      emitEvent(opts, 'template_published', { templateId, version: published.version });
    } catch (error) {
      emitError(opts, 'template_publish', error, exitCodeForError(error));
      exitWith(exitCodeForError(error));
    }
  }

  const media: Record<string, MediaChoice> = {};
  for (const m of mediaArgs) {
    if (m.value) { media[m.name] = m.value; continue; }
    const uploaded = await uploadCommand(m.file!, { target: opts.target, analyze: false, json: opts.json });
    if (!uploaded) throw new Error(`Template run stopped before CueFrame returned a media id for ${m.name}.`);
    media[m.name] = { mediaId: uploaded.mediaItemId };
  }
  initSdk(opts.target);

  const body = JSON.stringify({
    projectName: document.name,
    values,
    media,
    ...(opts.preset ? { preset: opts.preset } : {}),
    ...(opts.brandKitId ? { brandKitId: opts.brandKitId } : {}),
  });
  let response;
  const idempotencyKey = opts.idempotencyKey ?? randomUUID();
  emitEvent(opts, 'template_job_request', { templateId, idempotencyKey });
  try {
    response = await requestRaw(`/v1/templates/${encodeURIComponent(templateId)}/instantiate`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': idempotencyKey }, body,
    });
  } catch (error) {
    emitError(opts, 'template_instantiate', error, exitCodeForError(error));
    exitWith(exitCodeForError(error));
  }
  if (response.status >= 400) {
    const wrapper = response.body as { error?: { code?: string; message?: string; details?: unknown } } | null;
    const error = Object.assign(new Error(wrapper?.error?.message ?? response.statusText), { code: wrapper?.error?.code, status: response.status, details: wrapper?.error?.details });
    emitError(opts, 'template_instantiate', error, exitCodeForStatus(response.status));
    exitWith(exitCodeForStatus(response.status));
  }
  let job = response.body as TemplateJob;
  emitEvent(opts, 'template_job_started', { jobId: job.jobId, projectId: job.projectId, stage: job.stage });
  job = await waitTemplateJob(job, opts);
  if (job.status !== 'ready' || !job.projectId) {
    emitError(opts, job.errorCode ?? 'template_instantiate', new Error(job.errorMessage ?? `Template job ${job.jobId} ${job.status}.`), ExitCode.ApiServerError);
    exitWith(ExitCode.ApiServerError);
  }
  emitEvent(opts, 'template_job_complete', { jobId: job.jobId, projectId: job.projectId });

  const rendered = opts.render
    ? await renderCommand(job.projectId, { target: opts.target, out: opts.out, json: opts.json })
    : undefined;

  const result = {
    template: templateName,
    slug: document.slug,
    templateId,
    jobId: job.jobId,
    projectId: job.projectId,
    media,
    ...(rendered ? { renderId: rendered.renderId, outputPath: rendered.outputPath } : {}),
  };
  emitEvent(opts, 'template_run_complete', result);
  if (!opts.json) {
    emitResult(opts, result, () => {
      console.log(`\nProject ${job.projectId} created from ${document.name}.`);
      if (rendered) console.log(`Output: ${rendered.outputPath}`);
    });
  }
  return result;
}
