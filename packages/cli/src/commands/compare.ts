import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requestRaw, type CompareFramesResponse, type CompareFramesResponseComparisonImagesItem } from '@cueframe/sdk';
import { initSdk } from '../remote/sdkClient.js';
import { emitError, emitEvent, info } from '../remote/output.js';
import { ExitCode, exitCodeForError, exitCodeForStatus, exitWith } from '../remote/exitCodes.js';
import { assertCleanIdentifier } from '../remote/validate.js';

const VIEWS = ['side_by_side', 'overlay', 'difference'] as const;
type View = (typeof VIEWS)[number];

interface CompareOptions {
  target: string;
  json?: boolean;
  referenceMedia: string;
  referenceRepresentation: string;
  referenceFrame: string;
  candidateJob: string;
  candidateArtifact: string;
  views?: string;
  crop?: string;
  out?: string;
}

type ComparisonImage = CompareFramesResponseComparisonImagesItem;
type ComparisonResponse = CompareFramesResponse;

function usage(message: string): never {
  throw Object.assign(new Error(message), { exitCode: ExitCode.UserError });
}

function integer(value: string, name: string, minimum = 0): number {
  if (!/^\d+$/.test(value)) usage(`${name} must be an integer of at least ${minimum}.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum) usage(`${name} must be an integer of at least ${minimum}.`);
  return number;
}

function requestBody(opts: CompareOptions) {
  const frame = integer(opts.referenceFrame, '--reference-frame');
  if (!/^sha256:[a-f0-9]{64}$/.test(opts.referenceRepresentation)) {
    usage('--reference-representation must be the certified sha256:<64 lowercase hex> identity.');
  }
  const views = opts.views?.split(',');
  if (views && (views.length === 0 || new Set(views).size !== views.length || views.some((view) => !VIEWS.includes(view as View)))) {
    usage(`--views must contain distinct comma-separated values from ${VIEWS.join(', ')}.`);
  }
  let crop: { x: number; y: number; width: number; height: number } | undefined;
  if (opts.crop !== undefined) {
    const values = opts.crop.split(',');
    if (values.length !== 4) usage('--crop must be x,y,width,height in the shared image coordinates.');
    crop = {
      x: integer(values[0], 'crop x'), y: integer(values[1], 'crop y'),
      width: integer(values[2], 'crop width', 1), height: integer(values[3], 'crop height', 1),
    };
  }
  return {
    reference: { mediaItemId: opts.referenceMedia, representationIdentity: opts.referenceRepresentation, frame },
    candidate: { jobId: opts.candidateJob, artifactId: opts.candidateArtifact },
    ...(views ? { views } : {}), ...(crop ? { crop } : {}),
  };
}

async function imageReceipt(image: ComparisonImage, outputDir?: string) {
  if (!VIEWS.includes(image.view) || !/^sha256:[a-f0-9]{64}$/.test(image.artifactSha256) || typeof image.pngBase64 !== 'string') {
    throw new Error('Comparison returned an invalid image receipt.');
  }
  const bytes = Buffer.from(image.pngBase64, 'base64');
  if (bytes.length !== image.byteLength || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    `sha256:${createHash('sha256').update(bytes).digest('hex')}` !== image.artifactSha256) {
    throw new Error('Comparison image bytes do not match their PNG identity.');
  }
  let path: string | undefined;
  if (outputDir !== undefined) {
    await mkdir(outputDir, { recursive: true });
    path = resolve(outputDir, `${image.view}-${image.artifactSha256.slice(7)}.png`);
    try { await writeFile(path, bytes, { flag: 'wx' }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || !(await readFile(path)).equals(bytes)) throw error;
    }
  }
  const { pngBase64: _, ...receipt } = image;
  return { ...receipt, delivery: path ? 'saved' : 'metadata_only', ...(path ? { path } : {}) };
}

export async function compareCommand(projectId: string, opts: CompareOptions) {
  assertCleanIdentifier(projectId, 'projectId', opts);
  assertCleanIdentifier(opts.referenceMedia, 'referenceMedia', opts);
  assertCleanIdentifier(opts.candidateJob, 'candidateJob', opts);
  assertCleanIdentifier(opts.candidateArtifact, 'candidateArtifact', opts);
  try {
    const body = requestBody(opts);
    initSdk(opts.target, { timeoutMs: 100_000 });
    emitEvent(opts, 'compare_prepare', { projectId, ...body });
    const raw = await requestRaw(`/v1/projects/${encodeURIComponent(projectId)}/compare-frames`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const code = exitCodeForStatus(raw.status);
    if (code !== ExitCode.Success) {
      const error = (raw.body as { error?: { code?: string; message?: string } } | null)?.error;
      throw Object.assign(new Error(error?.message ?? `Frame comparison failed: HTTP ${raw.status}.`), {
        code: error?.code, status: raw.status, exitCode: code,
      });
    }
    const result = raw.body as ComparisonResponse;
    if (!Array.isArray(result?.comparison?.images) || result.comparison.images.length === 0 || result.comparison.images.length > VIEWS.length) {
      throw new Error('Comparison returned no usable image receipts.');
    }
    const { images, ...comparison } = result.comparison;
    const receipts = [];
    for (const image of images) receipts.push(await imageReceipt(image, opts.out));
    emitEvent(opts, 'compare_complete', { projectId, reference: result.reference, candidate: result.candidate, comparison: { ...comparison, images: receipts } });
    info(`Compared ${receipts.length} views.${opts.out ? ` Saved PNGs in ${resolve(opts.out)}.` : ' Use --out <directory> to save the comparison PNGs.'}`, opts);
  } catch (error) {
    const code = exitCodeForError(error);
    emitError(opts, 'compare', error, code);
    exitWith(code);
  }
}
