
import { components } from '@cueframe/sdk';
import {
  findWorkspace,
  listComponents,
  type Workspace,
} from '../internal/workspace.js';
import { initSdk, formatError, ApiError } from '../remote/sdkClient.js';
import { ExitCode, exitCodeForError, exitWith, type ExitCodeValue } from '../remote/exitCodes.js';
import { emitEvent, emitError, emitErrorJson, emitResult } from '../remote/output.js';
import { assertCleanIdentifier } from '../remote/validate.js';
import { readComponentSource } from '../internal/componentSource.js';
import { readComponentMetadata, type ComponentMetadata } from '../internal/componentManifest.js';

interface PushOpts {
  target: string;
  json?: boolean;
}

const PROP_SCHEMA_NOTE = 'declared in the native (v4) source definition';

function pushErrorExitCode(error: unknown): ExitCodeValue {
  const code = (error as { code?: string }).code;
  return code === 'no_component_source' || code === 'no_component_manifest' || code === 'invalid_component_definition' || code === 'component_source_retired' || code === 'invalid_component_metadata' || code === 'invalid_workspace_manifest'
    ? ExitCode.UserError
    : exitCodeForError(error);
}

export interface PushOutcome {
  id: string;
  action: 'created' | 'updated';
  name: string;
  category: ComponentMetadata['category'];
  propSchema: typeof PROP_SCHEMA_NOTE;
}

async function pushOne(ws: Workspace, id: string, opts: PushOpts): Promise<PushOutcome> {
  const source = readComponentSource(ws, id);
  const { name, category, ejectedFrom } = readComponentMetadata(ws, id);
  const description = `Custom component "${id}" pushed from the local CueFrame workspace.`;

  emitEvent(opts, 'push_component', {
    id,
    name,
    category,
    ejectedFrom,
    propSchema: PROP_SCHEMA_NOTE,
  });

  let exists = false;
  try {
    await components.getComponent(id);
    exists = true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      exists = false;
    } else {
      throw err;
    }
  }

  if (exists) {
    await components.updateComponent(id, {
      source,
      name,
      description,
      category,
      origin: 'customer-owned',
      ...(ejectedFrom ? { ejectedFrom } : {}),
    });
    emitEvent(opts, 'pushed', { id, action: 'updated' });
    return { id, action: 'updated', name, category, propSchema: PROP_SCHEMA_NOTE };
  }

  await components.createComponent({
    componentId: id,
    source,
    name,
    description,
    category,
    origin: 'customer-owned',
    ...(ejectedFrom ? { ejectedFrom } : {}),
  });
  emitEvent(opts, 'pushed', { id, action: 'created' });
  return { id, action: 'created', name, category, propSchema: PROP_SCHEMA_NOTE };
}

export async function pushCommand(id: string | undefined, opts: PushOpts): Promise<void> {
  if (!id) {
    emitError(
      opts,
      'push',
      new Error('Pass a component id (cueframe push <id>), or use `cueframe sync` to push all.'),
      ExitCode.UserError,
    );
    exitWith(ExitCode.UserError);
  }
  assertCleanIdentifier(id, 'id', opts);
  initSdk(opts.target);

  const ws = findWorkspace(process.cwd());
  if (!ws) {
    emitError(
      opts,
      'push',
      new Error('No CueFrame workspace found (no cueframe.json up-tree). Run `cueframe init` first.'),
      ExitCode.UserError,
    );
    exitWith(ExitCode.UserError);
  }

  emitEvent(opts, 'push_prepare', { id, target: opts.target });

  try {
    const outcome = await pushOne(ws, id, opts);
    emitResult(
      opts,
      { ok: true, target: opts.target, ...outcome },
      () => {
        console.log(`✓ ${outcome.action} component ${outcome.id} (${outcome.name}) on CueFrame`);
        console.log(`  propSchema: ${outcome.propSchema}`);
      },
    );
  } catch (err) {
    const code = pushErrorExitCode(err);
    emitError(opts, 'push', err, code);
    exitWith(code);
  }
}

export async function syncCommand(opts: PushOpts): Promise<void> {
  initSdk(opts.target);

  const ws = findWorkspace(process.cwd());
  if (!ws) {
    emitError(
      opts,
      'sync',
      new Error('No CueFrame workspace found (no cueframe.json up-tree). Run `cueframe init` first.'),
      ExitCode.UserError,
    );
    exitWith(ExitCode.UserError);
  }

  const ids = listComponents(ws);
  emitEvent(opts, 'sync_prepare', { target: opts.target, count: ids.length, ids });

  const results: PushOutcome[] = [];
  const failures: { id: string; error: unknown }[] = [];
  for (const id of ids) {
    try {
      results.push(await pushOne(ws, id, opts));
    } catch (err) {
      const code = pushErrorExitCode(err);
      emitErrorJson(opts, 'sync', err, code);
      failures.push({ id, error: err });
    }
  }

  emitResult(
    opts,
    {
      ok: failures.length === 0,
      target: opts.target,
      pushed: results,
      failed: failures.map((f) => ({ id: f.id, error: formatError(f.error) })),
    },
    () => {
      if (results.length === 0 && failures.length === 0) {
        console.log('No components to sync. Scaffold one with `cueframe new component <id>`.');
        return;
      }
      for (const r of results) console.log(`✓ ${r.action} ${r.id} (${r.name})`);
      if (results.length > 0) console.log(`  propSchema: ${PROP_SCHEMA_NOTE}`);
      for (const f of failures) console.error(`✖ ${f.id}: ${formatError(f.error)}`);
      console.log(`Synced ${results.length}/${ids.length} component(s) to CueFrame.`);
    },
  );

  if (failures.length > 0) exitWith(exitCodeForError(failures[0].error));
}
