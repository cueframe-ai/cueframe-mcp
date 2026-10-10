
import { createClient, requestRaw, type RawResponse } from '@cueframe/sdk';
import { clientHeaders } from '../remote/sdkClient.js';
import { resolveApiUrl } from '../remote/auth.js';
import { ExitCode, exitCodeForStatus, exitWith } from '../remote/exitCodes.js';
import { emitError, emitResult } from '../remote/output.js';

interface SchemaOpts {
  target: string;
  json?: boolean;
}

const REF_RE = /#\/components\/schemas\/([A-Za-z0-9_]+)/g;

function collectReachable(schemas: Record<string, unknown>, entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length) {
    const name = stack.pop()!;
    if (seen.has(name) || !(name in schemas)) continue;
    seen.add(name);
    const text = JSON.stringify(schemas[name]);
    let m: RegExpExecArray | null;
    REF_RE.lastIndex = 0;
    while ((m = REF_RE.exec(text))) stack.push(m[1]);
  }
  return seen;
}

function resolveEntryName(doc: any): string | null {
  const paths = doc?.paths ?? {};
  for (const p of Object.values<any>(paths)) {
    if (p?.put?.operationId === 'putComposition') {
      const ref = p.put?.requestBody?.content?.['application/json']?.schema?.$ref;
      const m = typeof ref === 'string' ? ref.match(/#\/components\/schemas\/(.+)$/) : null;
      if (m) return m[1];
    }
  }
  return null;
}

export async function schemaCommand(resource: string, opts: SchemaOpts) {
  if (resource !== 'composition') {
    console.error(`Unknown schema '${resource}'. Supported: composition.`);
    exitWith(ExitCode.UserError);
  }

  createClient({ baseUrl: resolveApiUrl(opts.target), headers: clientHeaders() });

  let raw: RawResponse;
  try {
    raw = await requestRaw('/v1/openapi.json', { method: 'GET' });
  } catch (err) {
    emitError(opts, 'schema', err, ExitCode.NetworkError);
    exitWith(ExitCode.NetworkError);
  }

  if (raw.status >= 400) {
    const code = exitCodeForStatus(raw.status);
    emitError(opts, 'schema', new Error(`Failed to fetch /v1/openapi.json (${raw.status})`), code);
    exitWith(code);
  }

  const doc = raw.body as any;
  const schemas: Record<string, unknown> = doc?.components?.schemas ?? {};
  const entry = resolveEntryName(doc);

  if (!entry || !(entry in schemas)) {
    emitError(
      opts,
      'schema',
      new Error(
        'Could not locate the composition schema in openapi.json (putComposition body ref not found).',
      ),
      ExitCode.ApiServerError,
    );
    exitWith(ExitCode.ApiServerError);
  }

  const reachable = collectReachable(schemas, entry);
  reachable.delete(entry);
  const referenced: Record<string, unknown> = {};
  for (const name of [...reachable].sort()) referenced[name] = schemas[name];

  const result = { name: entry, schema: schemas[entry], referenced };

  emitResult(opts, result, () => {
    console.log(JSON.stringify(result, null, 2));
  });
}
