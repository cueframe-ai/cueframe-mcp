import { request, requestRaw } from '@cueframe/sdk';
import { initSdk } from '../remote/sdkClient.js';
import { emitResult, emitError } from '../remote/output.js';
import { ExitCode, exitCodeForError, exitCodeForStatus, exitWith } from '../remote/exitCodes.js';

type CommonOpts = { target: string; json?: boolean };
type Actions = ('read' | 'write')[];

const RESOURCES = ['media', 'sessions', 'projects', 'renders', 'webhooks'];

const PRESETS: Record<string, Record<string, Actions>> = {
  readonly: Object.fromEntries(RESOURCES.map((r) => [r, ['read']])),
  editall: Object.fromEntries(RESOURCES.map((r) => [r, ['read', 'write']])),
};

function resolvePermissions(opts: { scope?: string; preset?: string }): Record<string, Actions> {
  if (opts.preset) {
    const p = PRESETS[opts.preset];
    if (!p) {
      console.error(`Unknown --preset "${opts.preset}". Valid: ${Object.keys(PRESETS).join(', ')}.`);
      exitWith(ExitCode.UserError);
    }
    return p;
  }
  if (opts.scope) return parseScope(opts.scope);
  console.error('Provide --scope or --preset (e.g. --preset readonly | editall).');
  exitWith(ExitCode.UserError);
}

function parseScope(scope: string): Record<string, Actions> {
  const perms: Record<string, Actions> = {};
  for (const seg of scope.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [res, acts] = seg.split(':');
    if (!res || !acts) {
      console.error(`Invalid --scope "${seg}". Use resource:rw (e.g. renders:rw,media:r).`);
      exitWith(ExitCode.UserError);
    }
    if (!RESOURCES.includes(res!)) {
      console.error(`--scope "${seg}": unknown resource "${res}". Valid: ${RESOURCES.join(', ')}.`);
      exitWith(ExitCode.UserError);
    }
    const a: Actions = [];
    if (/r/i.test(acts!)) a.push('read');
    if (/w/i.test(acts!)) a.push('write');
    if (a.length === 0) {
      console.error(`--scope "${seg}": actions must include r and/or w.`);
      exitWith(ExitCode.UserError);
    }
    perms[res!] = a;
  }
  if (Object.keys(perms).length === 0) {
    console.error('--scope is required, e.g. --scope media:rw,projects:rw,renders:rw');
    exitWith(ExitCode.UserError);
  }
  return perms;
}

export async function keysCreateCommand(
  opts: { name: string; scope?: string; preset?: string; expires?: string } & CommonOpts,
) {
  initSdk(opts.target);
  const permissions = resolvePermissions(opts);
  const body: Record<string, unknown> = { name: opts.name, permissions };
  if (opts.expires) {
    const days = Number(opts.expires);
    if (!Number.isFinite(days) || days <= 0) {
      console.error('--expires must be a positive number of days.');
      exitWith(ExitCode.UserError);
    }
    body.expiresIn = Math.round(days * 86400);
  }
  try {
    const data = await request<{ key: string; id: string; prefix: string; start: string }>(
      '/v1/api-keys',
      { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } },
    );
    emitResult(
      opts,
      { ok: true, id: data.id, prefix: data.prefix, start: data.start, key: data.key },
      () => {
        const scopes = Object.entries(permissions)
          .map(([r, a]) => `${r}:${a.map((x) => x[0]).join('')}`)
          .join(' ');
        console.log(`✓ API key "${opts.name}" created — scopes: ${scopes}`);
        console.log(`\n  ${data.key}\n`);
        console.log('  Shown ONCE — store it now (paste it into your integration; not saved here).');
      },
    );
  } catch (e) {
    emitError(opts, 'keys_create', e, exitCodeForError(e));
    exitWith(exitCodeForError(e));
  }
}

export async function keysListCommand(opts: CommonOpts) {
  initSdk(opts.target);
  let res;
  try {
    res = await requestRaw('/api/auth/api-key/list', { method: 'GET' });
  } catch (err) {
    emitError(opts, 'keys_list', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }
  if (res.status >= 400) {
    emitError(opts, 'keys_list', new Error(`list failed (${res.status})`), exitCodeForStatus(res.status));
    exitWith(exitCodeForStatus(res.status));
  }
  const keys = (Array.isArray(res.body) ? res.body : []) as Array<{
    id: string;
    name?: string;
    start?: string;
    enabled?: boolean;
  }>;
  emitResult(opts, { ok: true, keys }, () => {
    if (keys.length === 0) {
      console.log('No API keys.');
      return;
    }
    for (const k of keys) {
      console.log(`  ${k.id}  ${k.name ?? '(unnamed)'}  ${k.start ?? ''}…`);
    }
  });
}

export async function keysRevokeCommand(keyId: string, opts: CommonOpts) {
  initSdk(opts.target);
  let res;
  try {
    res = await requestRaw('/api/auth/api-key/delete', {
      method: 'POST',
      body: JSON.stringify({ keyId }),
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    emitError(opts, 'keys_revoke', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }
  if (res.status >= 400) {
    emitError(opts, 'keys_revoke', new Error(`revoke failed (${res.status})`), exitCodeForStatus(res.status));
    exitWith(exitCodeForStatus(res.status));
  }
  emitResult(opts, { ok: true, revoked: keyId }, () => console.log(`✓ Revoked ${keyId}`));
}
