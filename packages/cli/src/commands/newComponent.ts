
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { findWorkspace, componentDir } from '../internal/workspace.js';
import { emitEvent, emitError, emitResult } from '../remote/output.js';
import { ExitCode, exitWith } from '../remote/exitCodes.js';
import { assertCleanIdentifier } from '../remote/validate.js';
import { scaffoldDefinition } from '../internal/componentSource.js';
import { DEFAULT_COMPONENT_MANIFEST_V2 } from '../internal/componentManifest.js';

interface NewComponentOpts {
  json?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

const MANIFEST_FILENAME = 'cueframe.json';

function toPascal(name: string): string {
  const words = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function toTitle(name: string): string {
  const words = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function fail(opts: NewComponentOpts, message: string): never {
  emitError(opts, 'new_component', new Error(message), ExitCode.UserError);
  exitWith(ExitCode.UserError);
}

function indexTsxStub(name: string, pascal: string): string {
  return (
    `import React from 'react';\n` +
    `\n` +
    `/** Custom CueFrame component. Source v3 standalone clip; edit definition.json with the code. */\n` +
    `export default function ${pascal}({ params }: { durationInFrames: number; params: Record<string, unknown>; assets: Record<string, unknown>; render: { frame: number; fps: number; width: number; height: number; seed: string; colorSpace: 'srgb' } }) {\n` +
    `  return <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>{String((params as { text?: unknown }).text ?? '${name}')}</div>;\n` +
    `}\n`
  );
}

function configTsStub(name: string, title: string): string {
  return (
    `import { z } from 'zod';\n` +
    `import component from './index';\n` +
    `\n` +
    `const paramsSchema = z.object({}).passthrough();\n` +
    `\n` +
    `export const config = {\n` +
    `  id: '${name}',\n` +
    `  component,\n` +
    `  name: '${title}',\n` +
    `  category: 'ui-blocks',\n` +
    `  kind: 'component',\n` +
    `  version: '0.1.0',\n` +
    `  paramsSchema,\n` +
    `};\n` +
    `export default config;\n`
  );
}

export function newComponentCommand(name: string, opts: NewComponentOpts): void {
  assertCleanIdentifier(name, 'name', opts);
  const dryRun = opts.dryRun ?? false;
  const force = opts.force ?? false;
  const pascal = toPascal(name);
  if (!pascal) {
    fail(opts, `name "${name}" has no alphanumeric characters to form a component identifier.`);
  }
  const title = toTitle(name);
  emitEvent(opts, 'new_component_prepare', { name, dryRun, force });

  const ws = findWorkspace(process.cwd());
  if (!ws) {
    fail(
      opts,
      'No CueFrame workspace found (no cueframe.json up-tree). Run `cueframe init` first to scaffold one.',
    );
  }

  const dir = componentDir(ws, name);
  const dirExisted = existsSync(dir);
  if (dirExisted && readdirSync(dir).length > 0 && !force) {
    fail(
      opts,
      `Component dir ${dir} already exists and is non-empty. Pass --force to overwrite (this replaces local source).`,
    );
  }

  const files = {
    'index.tsx': indexTsxStub(name, pascal),
    'config.ts': configTsStub(name, title),
    'definition.json': JSON.stringify(scaffoldDefinition(name), null, 2) + '\n',
  };

  if (!dryRun) {
    mkdirSync(dir, { recursive: true });
    for (const [file, content] of Object.entries(files)) {
      writeFileSync(join(dir, file), content);
    }

    const manifestPath = join(ws.root, MANIFEST_FILENAME);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    const components = (manifest.components as Record<string, unknown> | undefined) ?? {};
    components[name] = { custom: true, manifest: DEFAULT_COMPONENT_MANIFEST_V2 };
    manifest.components = components;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  emitResult(
    opts,
    {
      ok: true,
      dryRun,
      name,
      component: pascal,
      dir,
      files: Object.keys(files),
      overwritten: dirExisted && force,
    },
    () => {
      const verb = dryRun ? 'Would scaffold' : 'Scaffolded';
      console.log(`✓ ${verb} custom component ${name} (${pascal}) into ${dir}`);
      for (const file of Object.keys(files)) {
        console.log(`  ${dryRun ? 'would write' : 'wrote'} ${file}`);
      }
      if (!dryRun) console.log(`  stamped cueframe.json components.${name} (custom)`);
      console.log('Edit index.tsx, then `cueframe push ' + name + '` to publish it to CueFrame.');
    },
  );
}
