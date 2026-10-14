import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newComponentCommand } from './newComponent.js';
import { scaffoldDefinition, scaffoldTemplate } from '../internal/componentSource.js';
import { DEFAULT_COMPONENT_MANIFEST_V4 } from '../internal/componentManifest.js';

describe('cueframe new component', () => {
  const dirs: string[] = [];

  function workspace(): string {
    const d = mkdtempSync(join(tmpdir(), 'cf-new-'));
    dirs.push(d);
    writeFileSync(join(d, 'cueframe.json'), JSON.stringify({ componentsDir: 'cueframe/components' }));
    return d;
  }
  function bareDir(): string {
    const d = mkdtempSync(join(tmpdir(), 'cf-new-bare-'));
    dirs.push(d);
    return d;
  }
  function inDir(root: string) {
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  }
  function captureExit(): string[] {
    const errs: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      errs.push(String(chunk));
      return true;
    });
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    return errs;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('scaffolds the native blank component: template.html and definition.json', () => {
    const root = workspace();
    inDir(root);
    newComponentCommand('my-badge', { json: false });

    const dir = join(root, 'cueframe', 'components', 'my-badge');
    expect(readFileSync(join(dir, 'template.html'), 'utf8')).toBe(scaffoldTemplate('my-badge'));
    expect(JSON.parse(readFileSync(join(dir, 'definition.json'), 'utf8'))).toEqual(scaffoldDefinition());
    expect(existsSync(join(dir, 'index.tsx'))).toBe(false);
  });

  it('stamps cueframe.json with the version-4 component manifest', () => {
    const root = workspace();
    inDir(root);
    newComponentCommand('my-badge', { json: false });

    const manifest = JSON.parse(readFileSync(join(root, 'cueframe.json'), 'utf8'));
    expect(manifest.components['my-badge']).toEqual({
      custom: true,
      manifest: DEFAULT_COMPONENT_MANIFEST_V4,
    });
  });

  it('refuses a non-empty existing dir without --force', () => {
    const root = workspace();
    const dir = join(root, 'cueframe', 'components', 'my-badge');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.tsx'), 'existing');
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    const errs = captureExit();

    expect(() => newComponentCommand('my-badge', { json: false })).toThrow('exit:2');
    expect(errs.join('')).toMatch(/--force/);
    expect(readFileSync(join(dir, 'index.tsx'), 'utf8')).toBe('existing');
  });

  it('overwrites with --force', () => {
    const root = workspace();
    const dir = join(root, 'cueframe', 'components', 'my-badge');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.tsx'), 'existing');
    inDir(root);

    newComponentCommand('my-badge', { json: false, force: true });
    expect(readFileSync(join(dir, 'template.html'), 'utf8')).toBe(scaffoldTemplate('my-badge'));
  });

  it('no workspace → UserError telling the user to run `cueframe init`', () => {
    const root = bareDir();
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    const errs = captureExit();
    expect(() => newComponentCommand('my-badge', { json: false })).toThrow('exit:2');
    expect(errs.join('')).toMatch(/cueframe init/);
  });

  it('dry-run writes nothing', () => {
    const root = workspace();
    inDir(root);
    newComponentCommand('my-badge', { json: false, dryRun: true });

    expect(existsSync(join(root, 'cueframe', 'components', 'my-badge'))).toBe(false);
    const manifest = JSON.parse(readFileSync(join(root, 'cueframe.json'), 'utf8'));
    expect(manifest.components).toBeUndefined();
  });
});
