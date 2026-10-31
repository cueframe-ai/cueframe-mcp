
import { readFileSync } from 'fs';
import { requestRaw, type RawResponse } from '@cueframe/sdk';
import { initSdk } from '../remote/sdkClient.js';
import {
  ExitCode,
  exitCodeForError,
  exitCodeForStatus,
  exitWith,
} from '../remote/exitCodes.js';
import { emitError } from '../remote/output.js';

const SUPPORTED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

interface ApiOpts {
  target: string;
  body?: string;
  header?: string[];
  include?: boolean;
  timeoutMs?: string;
  json?: boolean;
}

export async function apiCommand(method: string, path: string, opts: ApiOpts) {
  const upperMethod = method.toUpperCase();
  if (!SUPPORTED_METHODS.has(upperMethod)) {
    emitError(
      opts,
      'api',
      new Error(`Unsupported method: ${method}. Allowed: ${[...SUPPORTED_METHODS].join(', ')}.`),
      ExitCode.UserError,
    );
    exitWith(ExitCode.UserError);
  }

  if (!path.startsWith('/')) {
    emitError(opts, 'api', new Error(`Path must start with '/'. Got: ${path}`), ExitCode.UserError);
    exitWith(ExitCode.UserError);
  }

  let timeoutMs: number | undefined;
  if (opts.timeoutMs !== undefined) {
    timeoutMs = Number(opts.timeoutMs);
    if (!/^\d+$/.test(opts.timeoutMs) || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
      emitError(opts, 'api', new Error('--timeout-ms must be an integer between 1 and 2147483647.'), ExitCode.UserError);
      exitWith(ExitCode.UserError);
    }
  }
  if (timeoutMs === undefined) initSdk(opts.target);
  else initSdk(opts.target, { timeoutMs });

  const headers = parseHeaders(opts.header ?? []);
  const body = await resolveBody(opts.body, upperMethod);

  if (body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  let raw: RawResponse;
  try {
    raw = await requestRaw(path, {
      method: upperMethod,
      headers,
      body,
    });
  } catch (err) {
    emitError(opts, 'api', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }

  printResponse(raw, { include: !!opts.include, json: !!opts.json, method: upperMethod, path });

  const code = exitCodeForStatus(raw.status);
  if (code !== ExitCode.Success) {
    emitError(
      opts,
      'api',
      Object.assign(new Error(`${upperMethod} ${path} → ${raw.status} ${raw.statusText}`), {
        code: (raw.body as { error?: { code?: string } } | null)?.error?.code,
        status: raw.status,
      }),
      code,
    );
  }
  process.exitCode = code;
}

function printResponse(
  raw: RawResponse,
  { include, json, method, path }: { include: boolean; json: boolean; method: string; path: string },
) {
  if (json) {
    console.log(JSON.stringify({
      status: raw.status,
      statusText: raw.statusText,
      headers: raw.headers,
      body: raw.body,
    }));
    return;
  }

  if (include) {
    process.stdout.write(`HTTP/1.1 ${raw.status} ${raw.statusText}\n`);
    for (const [k, v] of Object.entries(raw.headers)) {
      process.stdout.write(`${k}: ${v}\n`);
    }
    process.stdout.write('\n');
    writeBody(raw.body, raw.status >= 400);
    return;
  }

  if (raw.status === 204 || raw.body === null) {
    console.error(`${method} ${path} → ${raw.status} (no content)`);
    return;
  }
  writeBody(raw.body, raw.status >= 400);
}

function writeBody(body: unknown, toStderr: boolean) {
  const stream = toStderr ? process.stderr : process.stdout;
  if (body === null || body === undefined) return;
  if (typeof body === 'string') {
    stream.write(body.endsWith('\n') ? body : body + '\n');
  } else {
    stream.write(JSON.stringify(body, null, 2) + '\n');
  }
}

export function parseHeaders(raw: string[]): Headers {
  const h = new Headers();
  for (const entry of raw) {
    const colon = entry.indexOf(':');
    if (colon === -1) {
      console.error(`Invalid --header (expected "Name: value"): ${entry}`);
      exitWith(ExitCode.UserError);
    }
    const name = entry.slice(0, colon).trim();
    const value = entry.slice(colon + 1).trim();
    h.set(name, value);
  }
  return h;
}

async function resolveBody(arg: string | undefined, method: string): Promise<string | undefined> {
  if (arg) {
    if (arg.startsWith('@')) {
      const path = arg.slice(1);
      if (path === '-') return readStdin();
      return readFileSync(path, 'utf-8');
    }
    return arg;
  }

  if (method === 'GET' || method === 'DELETE') return undefined;
  if (process.stdin.isTTY) return undefined;
  return readStdin();
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}
