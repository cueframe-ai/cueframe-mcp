import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sdk from '@cueframe/sdk';
import * as sdkClient from '../remote/sdkClient.js';
import { ExitCode } from '../remote/exitCodes.js';
import * as upload from './upload.js';
import * as render from './render.js';
import {
  coerceValues,
  parseMediaArg,
  parseValueArgs,
  resolveTemplate,
  templateRunCommand,
  templateStatusCommand,
  templateValidateCommand,
} from './template.js';

// The auth store reads ~/.cueframe/auth.json through os.homedir(); an empty home
// is how a machine with no `cueframe login` looks to the CLI.
const state = vi.hoisted(() => ({ home: '' }));
vi.mock('node:os', async (io) => ({ ...(await io<typeof import('node:os')>()), homedir: () => state.home }));
vi.mock('os', async (io) => ({ ...(await io<typeof import('node:os')>()), homedir: () => state.home }));
state.home = mkdtempSync(join(tmpdir(), 'cueframe-template-home-'));

const SHA = 'a'.repeat(64);

/** A template document as JSON. The CLI reads its shape; the server's kernel judges it. */
function document() {
  return {
    v: 1 as const,
    slug: 'yosemite-warp-text',
    name: 'Carved by water',
    parameters: [
      { name: 'source', type: 'media', kind: 'video', required: true, sample: { url: 'https://cdn.test/s.mp4', sha256: SHA, mimeType: 'video/mp4', durationSec: 16 } },
      { name: 'text', type: 'string', required: true, default: 'CARVED' },
      { name: 'layout', type: 'enum', required: false, options: ['stack', 'fan'], default: 'stack' },
      { name: 'size', type: 'number', required: false, min: 1, max: 9 },
    ],
    composition: { tracks: [{ id: 't', kind: 'overlay', name: 'T', contents: [{ id: 'o', kind: 'overlay', startTime: 0, duration: 2,
      source: { kind: 'overlay', primitiveId: 'heroText', params: { text: '{{text}}', layout: '{{layout}}' } } }] }] },
    presets: { granite: { label: 'Granite', values: { text: 'GRANITE', layout: 'fan' } } },
  };
}

type Verdict = { ok: boolean; slug: string | null; problems: Array<{ code: string; param?: string; message: string }> };
const OK_VERDICT: Verdict = { ok: true, slug: 'yosemite-warp-text', problems: [] };

class Exit extends Error {
  constructor(public readonly code: number) { super(`exit ${code}`); }
}

let dir: string;
let file: string;
const calls: string[] = [];
const stderr: string[] = [];
const errors: string[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cueframe-template-'));
  file = join(dir, 'template.cueframe');
  writeFileSync(file, JSON.stringify(document()));
  calls.length = 0;
  stderr.length = 0;
  errors.length = 0;
  vi.spyOn(process, 'exit').mockImplementation(((code: number) => { throw new Exit(code); }) as never);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { errors.push(args.map(String).join(' ')); });
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => { stderr.push(String(chunk)); return true; }) as never);
  vi.spyOn(sdkClient, 'initSdk').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

function stubLane(over: { jobStages?: string[]; verdict?: Verdict } = {}) {
  const jobStages = over.jobStages ?? ['ready'];
  const verdict = over.verdict ?? OK_VERDICT;
  vi.spyOn(upload, 'uploadCommand').mockImplementation(async (path) => { calls.push(`upload ${path}`); return { mediaItemId: 'media_1', item: null } as never; });
  vi.spyOn(render, 'renderCommand').mockImplementation(async () => { calls.push('render'); return { renderId: 'render_1', outputPath: '/out.mp4' } as never; });
  const request = vi.spyOn(sdk, 'request').mockImplementation(async (url, init) => {
    if (url === '/v1/templates') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { dryRun?: boolean };
      if (body.dryRun) { calls.push(`dry-run ${url}`); return verdict as never; }
      calls.push(`request ${url}`);
      return { id: 'tpl_org_1', version: 1, document: document() } as never;
    }
    calls.push(`request ${url}`);
    return { jobId: 'job_1', projectId: 'project_1', status: jobStages.shift() === 'processing' ? 'preparing' : 'ready', stage: jobStages.length ? 'processing' : 'ready' } as never;
  });
  const requestRaw = vi.spyOn(sdk, 'requestRaw').mockImplementation(async (url) => {
    calls.push(`instantiate ${url}`);
    return { status: 202, statusText: 'accepted', headers: {}, body: { jobId: 'job_1', projectId: null, status: 'preparing', stage: 'resolving' } } as never;
  });
  return { request, requestRaw };
}

function stubCatalog(raw: string) {
  const fetcher = vi.fn(async (url: string) => url.endsWith('/templates.json')
    ? { ok: true, status: 200, json: async () => ({ schemaVersion: 2, templates: [{ slug: 'yosemite-warp-text', documentSha256: createHash('sha256').update(raw).digest('hex') }] }) }
    : { ok: true, status: 200, text: async () => raw });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

function requestBody(request: ReturnType<typeof stubLane>['request'], index = 0): Record<string, unknown> {
  return JSON.parse(request.mock.calls[index]![1]!.body as string) as Record<string, unknown>;
}

describe('resolveTemplate', () => {
  it('tells a .cueframe path, a catalog slug and an org template id apart', () => {
    expect(resolveTemplate(file)).toEqual({ kind: 'file', path: file });
    expect(resolveTemplate('./missing.cueframe')).toMatchObject({ kind: 'file' });
    expect(resolveTemplate('yosemite-warp-text')).toEqual({ kind: 'slug', slug: 'yosemite-warp-text' });
    expect(resolveTemplate('k97d2x8bq4hn6m3zp1vw5c0tyr9ej7fa')).toEqual({ kind: 'org', id: 'k97d2x8bq4hn6m3zp1vw5c0tyr9ej7fa' });
    expect(() => resolveTemplate('Not A Slug')).toThrow(/not a \.cueframe file/);
  });
});

describe('inputs', () => {
  it('parses --media as a file, an https url or the sample', () => {
    expect(parseMediaArg('source=sample')).toEqual({ name: 'source', value: { sample: true } });
    expect(parseMediaArg('source=media:media_1')).toEqual({ name: 'source', value: { mediaId: 'media_1' } });
    expect(parseMediaArg('source=https://x.test/a.mp4')).toEqual({ name: 'source', value: { url: 'https://x.test/a.mp4' } });
    expect(parseMediaArg('source=./a.mp4')).toMatchObject({ name: 'source', file: expect.stringMatching(/\/a\.mp4$/) });
    expect(() => parseMediaArg('source=ftp://x/a.mp4')).toThrow(/only https/);
    expect(() => parseMediaArg('source')).toThrow(/name=/);
  });

  it('coerces --values by the declared type and refuses names the template does not declare', () => {
    const raw = parseValueArgs(['text=Hello=world', 'layout=fan', 'size=4']);
    expect(raw).toEqual({ text: 'Hello=world', layout: 'fan', size: '4' });
    expect(coerceValues(document(), raw)).toEqual({ values: { text: 'Hello=world', layout: 'fan', size: 4 }, problems: [] });
    // An enum typo travels to the server as given, and an unparseable number as NaN (JSON null);
    // the kernel there names the problem.
    const typo = coerceValues(document(), { layout: 'fann', size: 'big', source: 'x', nope: '1' });
    expect(typo.values).toEqual({ layout: 'fann', size: NaN });
    expect(typo.problems).toEqual([
      'source: a media parameter; pass it with --media',
      'nope: not a parameter of yosemite-warp-text',
    ]);
  });

  it('run exits with the user error before any call when a value names no parameter', async () => {
    const lane = stubLane();
    await expect(templateRunCommand(file, { media: ['source=sample'], values: ['nope=1'], out: 'o.mp4', target: 'prod', render: true }))
      .rejects.toThrow(/exit 2/);
    expect(calls).toEqual([]);
    expect(lane.request).not.toHaveBeenCalled();
  });
});

describe('template run', () => {
  it('reconnects to an existing preparation job without starting another project', async () => {
    stubLane();
    const status = await templateStatusCommand('job_1', { target: 'prod', wait: true, json: true });
    expect(status).toMatchObject({ jobId: 'job_1', status: 'ready', projectId: 'project_1' });
    expect(calls).toEqual(['request /v1/template-jobs/job_1']);
  });

  it('on a slug: uploads, starts the shared job with the preset and kit, and never publishes', async () => {
    stubCatalog(JSON.stringify(document()));
    const lane = stubLane();
    const clip = join(dir, 'clip.mp4');
    writeFileSync(clip, 'x');
    const result = await templateRunCommand('yosemite-warp-text', {
      media: [`source=${clip}`], values: ['text=JOURNEY'], preset: 'granite', brandKitId: 'bk_1', idempotencyKey: 'retry-1', out: 'o.mp4', target: 'prod', render: false,
    });
    expect(calls).toEqual([`upload ${clip}`, 'instantiate /v1/templates/yosemite-warp-text/instantiate', 'request /v1/template-jobs/job_1']);
    const [, init] = lane.requestRaw.mock.calls[0]!;
    expect((init!.headers as Record<string, string>)['Idempotency-Key']).toBe('retry-1');
    expect(JSON.parse(init!.body as string)).toEqual({
      projectName: 'Carved by water', values: { text: 'JOURNEY' }, media: { source: { mediaId: 'media_1' } }, preset: 'granite', brandKitId: 'bk_1',
    });
    expect(result).toMatchObject({ projectId: 'project_1', jobId: 'job_1', slug: 'yosemite-warp-text' });
    expect(result).not.toHaveProperty('renderId');
  });

  it('refuses a catalog document whose bytes no longer match before starting a job', async () => {
    const lane = stubLane();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/templates.json')
      ? { ok: true, status: 200, json: async () => ({ schemaVersion: 2, templates: [{ slug: 'yosemite-warp-text', documentSha256: '0'.repeat(64) }] }) }
      : { ok: true, status: 200, text: async () => JSON.stringify(document()) }));
    await expect(templateRunCommand('yosemite-warp-text', { media: ['source=sample'], values: [], out: 'o.mp4', target: 'prod', render: false }))
      .rejects.toThrow(/exit 2/);
    expect(calls).toEqual([]);
    expect(lane.requestRaw).not.toHaveBeenCalled();
  });

  it('on a local document: binds the inputs on the server, publishes it once, as read, then starts the job and renders', async () => {
    const lane = stubLane();
    const result = await templateRunCommand(file, { media: ['source=sample'], values: [], out: 'o.mp4', target: 'prod', render: true });
    expect(calls).toEqual(['dry-run /v1/templates', 'request /v1/templates', 'instantiate /v1/templates/tpl_org_1/instantiate', 'request /v1/template-jobs/job_1', 'render']);
    expect(requestBody(lane.request, 0)).toEqual({ document: document(), dryRun: true, values: {}, media: { source: { sample: true } } });
    expect(requestBody(lane.request, 1)).toEqual({ document: document() });
    expect(result).toMatchObject({ renderId: 'render_1', outputPath: '/out.mp4' });
  });

  it('on a local document: a value the server refuses is reported before anything is published', async () => {
    const lane = stubLane({ verdict: { ok: false, slug: 'yosemite-warp-text', problems: [{ code: 'template_values_invalid', param: 'layout', message: 'expected one of stack, fan' }] } });
    await expect(templateRunCommand(file, { media: ['source=sample'], values: ['layout=fann'], out: 'o.mp4', target: 'prod', render: true }))
      .rejects.toThrow(/exit 2/);
    expect(calls).toEqual(['dry-run /v1/templates']);
    expect(lane.request).toHaveBeenCalledTimes(1);
    expect(lane.requestRaw).not.toHaveBeenCalled();
    expect(stderr.join('')).toContain('layout: expected one of stack, fan (template_values_invalid)');
  });

  it('polls one job while media is processing', async () => {
    vi.useFakeTimers();
    try {
      const lane = stubLane({ jobStages: ['processing', 'ready'] });
      const run = templateRunCommand(file, { media: ['source=https://x.test/a.mp4'], values: [], out: 'o.mp4', target: 'prod', render: false });
      await vi.waitFor(() => expect(lane.requestRaw).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(6_000);
      await run;
      expect(lane.requestRaw).toHaveBeenCalledTimes(1);
      expect(lane.request).toHaveBeenCalledTimes(4); // bind, publish, two job polls
      expect(JSON.parse(lane.requestRaw.mock.calls[0]![1]!.body as string).media).toEqual({ source: { url: 'https://x.test/a.mp4' } });
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses a missing required media parameter, an unknown preset and a sample the template lacks', async () => {
    stubLane();
    await expect(templateRunCommand(file, { media: [], values: [], out: 'o.mp4', target: 'prod', render: true })).rejects.toThrow(/exit 2/);
    await expect(templateRunCommand(file, { media: ['source=sample'], values: [], preset: 'marble', out: 'o.mp4', target: 'prod', render: true })).rejects.toThrow(/exit 2/);
    const noSample = document();
    delete (noSample.parameters[0] as { sample?: unknown }).sample;
    writeFileSync(file, JSON.stringify(noSample));
    await expect(templateRunCommand(file, { media: ['source=sample'], values: [], out: 'o.mp4', target: 'prod', render: true })).rejects.toThrow(/exit 2/);
    expect(calls).toEqual([]);
  });

  it('dry-run asks the API to bind the inputs, stores nothing, and lists what it would do', async () => {
    const lane = stubLane();
    const result = await templateRunCommand(file, { media: ['source=sample'], values: ['text=JOURNEY'], preset: 'granite', out: 'o.mp4', target: 'prod', render: true, dryRun: true });
    expect(result).toMatchObject({ wouldRun: ['publish the document to your org', 'start template preparation job', 'wait for the ready project', 'render and download MP4'] });
    expect(calls).toEqual(['dry-run /v1/templates']);
    expect(requestBody(lane.request)).toEqual({ document: document(), dryRun: true, values: { text: 'JOURNEY' }, media: { source: { sample: true } }, preset: 'granite' });
    expect(sdkClient.initSdk).toHaveBeenCalledWith('prod');
  });

  it('dry-run binds a file or url as the parameter sample, a media id as itself, and omits a parameter with no sample', async () => {
    const doc = document();
    doc.parameters.push({ name: 'logo', type: 'media', kind: 'image', required: false } as never);
    doc.parameters.push({ name: 'music', type: 'media', kind: 'audio', required: false, sample: { url: 'https://cdn.test/m.mp3', sha256: SHA, mimeType: 'audio/mpeg', durationSec: 30 } } as never);
    writeFileSync(file, JSON.stringify(doc));
    const lane = stubLane();
    const clip = join(dir, 'clip.mp4');
    writeFileSync(clip, 'x');
    await templateRunCommand(file, { media: [`source=${clip}`, 'logo=https://x.test/logo.png', 'music=media:media_9'], values: [], out: 'o.mp4', target: 'prod', render: false, dryRun: true });
    expect(calls).toEqual(['dry-run /v1/templates']);
    expect(requestBody(lane.request).media).toEqual({ source: { sample: true }, music: { mediaId: 'media_9' } });
  });

  it("dry-run surfaces the server's binding problems as a user error, code and message as returned", async () => {
    stubLane({ verdict: { ok: false, slug: 'yosemite-warp-text', problems: [{ code: 'template_values_invalid', param: 'layout', message: 'expected one of stack, fan' }] } });
    await expect(templateRunCommand(file, { media: ['source=sample'], values: ['layout=fann'], out: 'o.mp4', target: 'prod', render: true, dryRun: true }))
      .rejects.toThrow(/exit 2/);
    expect(calls).toEqual(['dry-run /v1/templates']);
    expect(stderr.join('')).toContain('layout: expected one of stack, fan (template_values_invalid)');
  });
});

describe('template validate', () => {
  it('template validate prints the server problems and exits with the user-error code', async () => {
    const lane = stubLane({ verdict: { ok: false, slug: 'hello', problems: [{ code: 'template_parameter_undeclared', param: 'missing', message: 'undeclared parameter missing' }] } });
    await expect(templateValidateCommand(file, { target: 'prod' })).rejects.toThrow(new Exit(ExitCode.UserError).message);
    expect(errors.join('\n')).toContain('undeclared parameter missing');
    expect(requestBody(lane.request)).toMatchObject({ dryRun: true, document: document() });
    expect(sdkClient.initSdk).toHaveBeenCalledWith('prod');
  });

  it('template validate without a key prints the login guidance, not a stack trace', async () => {
    vi.mocked(sdkClient.initSdk).mockRestore();
    vi.stubEnv('CUEFRAME_API_KEY', undefined);
    const lane = stubLane();
    await expect(templateValidateCommand(file, { target: 'prod' })).rejects.toThrow(new Exit(ExitCode.UserError).message);
    expect(stderr.join('')).toContain('cueframe login');
    expect(lane.request).not.toHaveBeenCalled();
  });

  it('fails clearly, as a server error, when the API does not answer a dry run', async () => {
    const lane = stubLane({ verdict: { id: 'tpl_org_1', version: 1 } as unknown as Verdict });
    await expect(templateValidateCommand(file, { target: 'prod' })).rejects.toThrow(new Exit(ExitCode.ApiServerError).message);
    expect(stderr.join('')).toContain('did not answer a dry run');
    expect(lane.request).toHaveBeenCalledTimes(1);
  });

  it('as JSON: reports the problems as data and exits 2', async () => {
    stubLane({ verdict: { ok: false, slug: 'yosemite-warp-text', problems: [{ code: 'template_values_invalid', param: 'granite.layout', message: 'expected one of stack, fan' }] } });
    await expect(templateValidateCommand(file, { target: 'prod', json: true })).rejects.toThrow(/exit 2/);
    const printed = JSON.parse((console.log as unknown as { mock: { calls: string[][] } }).mock.calls.at(-1)![0]!) as { ok: boolean; problems: string[] };
    expect(printed.ok).toBe(false);
    expect(printed.problems).toEqual(['granite.layout: expected one of stack, fan (template_values_invalid)']);
  });

  it('reads a slug from the catalog, then asks the API for the verdict', async () => {
    const raw = JSON.stringify(document());
    const fetcher = stubCatalog(raw);
    const lane = stubLane();
    const result = await templateValidateCommand('yosemite-warp-text', { target: 'prod', json: true });
    expect(result).toEqual({ template: 'yosemite-warp-text', slug: 'yosemite-warp-text', ok: true, problems: [] });
    expect(fetcher).toHaveBeenCalledWith(`https://raw.githubusercontent.com/cueframe-ai/cueframe-templates/main/artifacts/${createHash('sha256').update(raw).digest('hex')}.cueframe`, expect.anything());
    expect(fetcher).toHaveBeenCalledWith('https://raw.githubusercontent.com/cueframe-ai/cueframe-templates/main/templates.json', expect.anything());
    expect(calls).toEqual(['dry-run /v1/templates']);
    expect(requestBody(lane.request)).toEqual({ document: document(), dryRun: true });
  });
});
