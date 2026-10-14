
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { components } from '@cueframe/sdk';
import {
  findWorkspace,
  componentDir,
  listComponents,
  type Workspace,
} from '../internal/workspace.js';
import { initSdk, formatError, ApiError } from '../remote/sdkClient.js';
import { ExitCode, exitCodeForError, exitWith, type ExitCodeValue } from '../remote/exitCodes.js';
import { emitEvent, emitError, emitErrorJson, emitResult } from '../remote/output.js';
import { assertCleanIdentifier } from '../remote/validate.js';
import { readComponentSource } from '../internal/componentSource.js';

interface PushOpts {
  target: string;
  json?: boolean;
}

const MANIFEST_FILENAME = 'cueframe.json';

const SDK_CATEGORIES = ['effects', 'transitions', 'text', 'layouts', 'backgrounds', 'ui-blocks', 'scenes'] as const;
type SdkCategory = (typeof SDK_CATEGORIES)[number];

function toSdkCategory(raw: string | undefined): SdkCategory {
  return (SDK_CATEGORIES as readonly string[]).includes(raw ?? '')
    ? (raw as SdkCategory)
    : 'layouts';
}

interface ComponentMeta {
  name?: string;
  category?: string;
  version?: string;
}

function unwrap(expr: ts.Expression): ts.Expression {
  let e = expr;
  while (
    ts.isAsExpression(e) ||
    ts.isParenthesizedExpression(e) ||
    (typeof ts.isSatisfiesExpression === 'function' && ts.isSatisfiesExpression(e))
  ) {
    e = e.expression;
  }
  return e;
}

function importsFrom(sf: ts.SourceFile, specifier: string): boolean {
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    if (stmt.moduleSpecifier.text === specifier) return true;
  }
  return false;
}

function analyzeConfigLiteral(source: string, fileName: string): ComponentMeta {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let objLit: ts.ObjectLiteralExpression | undefined;
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === 'config' && decl.initializer) {
        const init = unwrap(decl.initializer);
        if (ts.isObjectLiteralExpression(init)) objLit = init;
      }
    }
    if (objLit) break;
  }
  const meta: ComponentMeta = {};
  if (!objLit) return meta;
  for (const p of objLit.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    if (!(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) continue;
    const key = p.name.text;
    if (!ts.isStringLiteralLike(p.initializer)) continue;
    if (key === 'name') meta.name = p.initializer.text;
    else if (key === 'category') meta.category = p.initializer.text;
    else if (key === 'version') meta.version = p.initializer.text;
  }
  return meta;
}

function readComponentMeta(dir: string): ComponentMeta {
  const configPath = join(dir, 'config.ts');
  if (!existsSync(configPath)) return {};
  const configSrc = readFileSync(configPath, 'utf8');
  const configSf = ts.createSourceFile('config.ts', configSrc, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const underConfigPath = join(dir, '_config.ts');
  if (importsFrom(configSf, './_config') && existsSync(underConfigPath)) {
    return analyzeConfigLiteral(readFileSync(underConfigPath, 'utf8'), '_config.ts');
  }
  return analyzeConfigLiteral(configSrc, 'config.ts');
}

function titleize(id: string): string {
  return id
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function ejectedFromFor(ws: Workspace, id: string): string | undefined {
  const manifestPath = join(ws.root, MANIFEST_FILENAME);
  if (!existsSync(manifestPath)) return undefined;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      components?: Record<string, { ejectedFrom?: string }>;
    };
    const ejectedFrom = manifest.components?.[id]?.ejectedFrom;
    return typeof ejectedFrom === 'string' && ejectedFrom.length > 0 ? ejectedFrom : undefined;
  } catch {
    return undefined;
  }
}

const PROP_SCHEMA_NOTE = 'declared in the native (v4) source definition';

function pushErrorExitCode(error: unknown): ExitCodeValue {
  const code = (error as { code?: string }).code;
  return code === 'no_component_source' || code === 'no_component_manifest' || code === 'invalid_component_definition' || code === 'component_source_retired'
    ? ExitCode.UserError
    : exitCodeForError(error);
}

export interface PushOutcome {
  id: string;
  action: 'created' | 'updated';
  name: string;
  category: SdkCategory;
  propSchema: typeof PROP_SCHEMA_NOTE;
}

async function pushOne(ws: Workspace, id: string, opts: PushOpts): Promise<PushOutcome> {
  const dir = componentDir(ws, id);
  const source = readComponentSource(ws, id);
  const meta = readComponentMeta(dir);
  const name = meta.name ?? titleize(id);
  const category = toSdkCategory(meta.category);
  const ejectedFrom = ejectedFromFor(ws, id);
  const description = `Custom component "${id}" pushed from the local CueFrame workspace.`;

  emitEvent(opts, 'push_component', {
    id,
    name,
    category,
    version: meta.version,
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
