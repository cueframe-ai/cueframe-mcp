import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initCommand } from './init.js';

describe('cueframe init', () => {
  const dirs: string[] = [];
  function ws(): string {
    const d = mkdtempSync(join(tmpdir(), 'cf-init-'));
    dirs.push(d);
    return d;
  }
  function inWorkspace(root: string) {
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  }
  afterEach(() => {
    vi.restoreAllMocks();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('scaffolds manifest + components dir + gitignore in a fresh repo', () => {
    const root = ws();
    inWorkspace(root);
    initCommand({ json: false });

    const manifest = join(root, 'cueframe.json');
    expect(existsSync(manifest)).toBe(true);
    expect(JSON.parse(readFileSync(manifest, 'utf8'))).toEqual({
      componentsDir: 'cueframe/components',
    });
    expect(existsSync(join(root, 'cueframe', 'components'))).toBe(true);
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toContain('.cueframe/');
  });

  it('is idempotent — keeps an existing manifest (custom componentsDir + passthrough keys) untouched', () => {
    const root = ws();
    writeFileSync(
      join(root, 'cueframe.json'),
      JSON.stringify({ componentsDir: 'custom/dir', brand: 'acme' }),
    );
    inWorkspace(root);
    initCommand({ json: false });

    expect(JSON.parse(readFileSync(join(root, 'cueframe.json'), 'utf8'))).toEqual({
      componentsDir: 'custom/dir',
      brand: 'acme',
    });
    expect(existsSync(join(root, 'custom', 'dir'))).toBe(true);
  });

  it('does not duplicate .cueframe/ in an existing .gitignore', () => {
    const root = ws();
    writeFileSync(join(root, '.gitignore'), 'node_modules\n.cueframe/\n');
    inWorkspace(root);
    initCommand({ json: false });

    const gi = readFileSync(join(root, '.gitignore'), 'utf8');
    expect(gi.match(/\.cueframe\//g)?.length).toBe(1);
  });

  it('points at a command that exists', () => {
    const root = ws();
    inWorkspace(root);
    initCommand({ json: false });
    const printed = vi.mocked(console.log).mock.calls.map((call) => String(call[0])).join('\n');
    expect(printed).toContain('cueframe new component <name>');
    expect(printed).not.toContain('eject');
  });

  it('dry-run writes nothing', () => {
    const root = ws();
    inWorkspace(root);
    initCommand({ json: false, dryRun: true });

    expect(existsSync(join(root, 'cueframe.json'))).toBe(false);
    expect(existsSync(join(root, 'cueframe', 'components'))).toBe(false);
    expect(existsSync(join(root, '.gitignore'))).toBe(false);
  });

  it('emits a structured result under --json', () => {
    const root = ws();
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    const out: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      out.push(args.join(' '));
    });
    initCommand({ json: true });
    const payload = JSON.parse(out.join('\n'));
    expect(payload.ok).toBe(true);
    expect(payload.componentsDir).toBe('cueframe/components');
    expect(payload.manifest.created).toBe(true);
  });
});
