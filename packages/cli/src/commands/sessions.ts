
import { sessions as sessionsSdk } from '@cueframe/sdk';
import { initSdk } from '../remote/sdkClient.js';
import { ExitCode, exitCodeForError, exitWith } from '../remote/exitCodes.js';
import { emitEvent, emitError, emitResult } from '../remote/output.js';
import { assertCleanIdentifier } from '../remote/validate.js';

interface CommonOpts {
  target: string;
  json?: boolean;
}

interface CreateOpts extends CommonOpts {
  name: string;
  files: string[];
}


export async function sessionsListCommand(opts: CommonOpts) {
  initSdk(opts.target);
  emitEvent(opts, 'sessions_list_prepare', {});
  try {
    const out = await sessionsSdk.listSessions();
    emitEvent(opts, 'sessions_list_complete', { count: out.data.length });
    emitResult(opts, out, () => {
      if (out.data.length === 0) {
        console.log('No sessions yet. Create one with `cueframe sessions create --name <n> --files <mediaId:role> …`');
        return;
      }
      for (const s of out.data) {
        const mux = s.muxStatus ?? 'pending';
        console.log(`${s.id}\t${s.fileCount} files\tmux:${mux}\t${s.name}`);
      }
      if (out.pagination.hasMore) {
        console.log(`# more — pass --after ${out.pagination.nextCursor} (raw via \`cueframe api\`)`);
      }
    });
  } catch (err) {
    emitError(opts, 'sessions_list', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }
}


export async function sessionsGetCommand(sessionId: string, opts: CommonOpts) {
  assertCleanIdentifier(sessionId, 'sessionId', opts);
  initSdk(opts.target);
  emitEvent(opts, 'sessions_get_prepare', { sessionId });
  try {
    const out = await sessionsSdk.getSession(sessionId);
    emitEvent(opts, 'sessions_get_complete', { sessionId });
    emitResult(opts, out, () => {
      console.log(JSON.stringify(out, null, 2));
    });
  } catch (err) {
    emitError(opts, 'sessions_get', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }
}


export async function sessionsCreateCommand(opts: CreateOpts) {
  if (!opts.name) {
    console.error('--name is required');
    exitWith(ExitCode.UserError);
  }
  if (!opts.files || opts.files.length === 0) {
    console.error('At least one --file <mediaId:role> is required');
    exitWith(ExitCode.UserError);
  }
  const files = opts.files.map((entry, i) => {
    const colon = entry.indexOf(':');
    if (colon === -1) {
      console.error(`--file[${i}] must be <mediaId>:<role>. Got: ${entry}`);
      exitWith(ExitCode.UserError);
    }
    return {
      mediaId: entry.slice(0, colon).trim(),
      role: entry.slice(colon + 1).trim(),
    };
  });

  initSdk(opts.target);
  emitEvent(opts, 'sessions_create_prepare', { name: opts.name, fileCount: files.length });
  try {
    const out = await sessionsSdk.createSession({ name: opts.name, files });
    emitEvent(opts, 'sessions_create_complete', { sessionId: out.id });
    emitResult(opts, out, () => {
      console.log(`Session created: ${out.id}`);
      console.log(JSON.stringify(out, null, 2));
    });
  } catch (err) {
    emitError(opts, 'sessions_create', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }
}


export async function sessionsDeleteCommand(sessionId: string, opts: CommonOpts) {
  assertCleanIdentifier(sessionId, 'sessionId', opts);
  initSdk(opts.target);
  emitEvent(opts, 'sessions_delete_prepare', { sessionId });
  try {
    await sessionsSdk.deleteSession(sessionId);
    emitEvent(opts, 'sessions_delete_complete', { sessionId });
    emitResult(opts, { ok: true, sessionId }, () => {
      console.log(`Session ${sessionId} deleted.`);
    });
  } catch (err) {
    emitError(opts, 'sessions_delete', err, exitCodeForError(err));
    exitWith(exitCodeForError(err));
  }
}
