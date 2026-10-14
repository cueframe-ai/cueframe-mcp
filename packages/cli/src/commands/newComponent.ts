
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
import { blankComponentSource } from '../internal/componentSource.js';
import { createComponentBody } from '@cueframe/sdk/zod';

interface NewComponentOpts {
  category: string;
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
  return name.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function fail(opts: NewComponentOpts, message: string): never {
  emitError(opts, 'new_component', new Error(message), ExitCode.UserError);
  exitWith(ExitCode.UserError);
}

export function newComponentCommand(name: string, opts: NewComponentOpts): void {
  assertCleanIdentifier(name, 'name', opts);
  const dryRun = opts.dryRun ?? false;
  const force = opts.force ?? false;
  const pascal = toPascal(name);
  if (!pascal) {
    fail(opts, `name "${name}" has no alphanumeric characters to form a component identifier.`);
  }
  const category = createComponentBody.shape.category.safeParse(opts.category);
  if (!category.success) {
    fail(opts, `--category must be one of ${createComponentBody.shape.category.options.join(', ')}; got "${opts.category}".`);
  }
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

  const blank = blankComponentSource(name);
  const files = {
    'template.html': blank.template,
    'definition.json': JSON.stringify(blank.definition, null, 2) + '\n',
  };

  if (!dryRun) {
    mkdirSync(dir, { recursive: true });
    for (const [file, content] of Object.entries(files)) {
      writeFileSync(join(dir, file), content);
    }

    const manifestPath = join(ws.root, MANIFEST_FILENAME);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    const components = (manifest.components as Record<string, unknown> | undefined) ?? {};
    components[name] = { custom: true, name: toTitle(name), category: category.data, manifest: blank.manifest };
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
      console.log('Edit template.html and definition.json, then `cueframe push ' + name + '` to publish it to CueFrame.');
    },
  );
}
