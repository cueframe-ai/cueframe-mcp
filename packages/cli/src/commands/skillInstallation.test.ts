import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installSkillPackages } from './skillInstallation.js';

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cueframe-skill-refresh-'));
  roots.push(root);
  const source = join(root, 'source');
  const destination = join(root, '.agents', 'skills');
  const packageDir = join(source, 'example');
  mkdirSync(join(packageDir, 'references'), { recursive: true });
  writeFileSync(join(packageDir, 'SKILL.md'), '---\nname: example\ndescription: Example.\n---\nVersion one.\n');
  writeFileSync(join(packageDir, 'references', 'preview.md'), 'First reference.\n');
  const skill = join(destination, 'example');
  const run = (force = false) => installSkillPackages(source, [destination], { force, today: '2026-09-14' });
  return { root, source, destination, packageDir, skill, run };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('managed skill package refresh', () => {
  it('refreshes unchanged packages, including changed and removed supporting files', () => {
    const f = fixture();
    f.run();
    writeFileSync(join(f.packageDir, 'SKILL.md'), '---\nname: example\ndescription: Example.\n---\nVersion two.\n');
    rmSync(join(f.packageDir, 'references', 'preview.md'));
    writeFileSync(join(f.packageDir, 'references', 'motion.md'), 'Motion windows.\n');
    const result = f.run();
    expect(result.installed).toEqual([join(f.skill, 'SKILL.md')]);
    expect(result.skipped).toEqual([]);
    expect(readFileSync(join(f.skill, 'SKILL.md'), 'utf8')).toContain('Version two.');
    expect(existsSync(join(f.skill, 'references', 'preview.md'))).toBe(false);
    expect(readFileSync(join(f.skill, 'references', 'motion.md'), 'utf8')).toBe('Motion windows.\n');
    expect(readFileSync(join(result.backups[0].path, 'references', 'preview.md'), 'utf8')).toBe('First reference.\n');
    expect(f.run().unchanged).toEqual([join(f.skill, 'SKILL.md')]);
  });

  it.each(['edit', 'addition', 'deletion', 'permissions'] as const)('preserves a local %s anywhere in a package', (change) => {
    const f = fixture();
    f.run();
    const reference = join(f.skill, 'references', 'preview.md');
    if (change === 'edit') writeFileSync(reference, 'My local guidance.');
    if (change === 'addition') writeFileSync(join(f.skill, 'notes.md'), 'My notes.');
    if (change === 'deletion') rmSync(reference);
    if (change === 'permissions') chmodSync(reference, 0o700);
    writeFileSync(join(f.packageDir, 'SKILL.md'), 'New upstream content.');
    const result = f.run();
    expect(result.skipped).toEqual([join(f.skill, 'SKILL.md')]);
    expect(result.installed).toEqual([]);
    expect(result.backups).toEqual([]);
    expect(readFileSync(join(f.skill, 'SKILL.md'), 'utf8')).toContain('Version one.');
  });

  it.each(['missing', 'corrupt'] as const)('preserves legacy packages with a %s receipt', (receipt) => {
    const f = fixture();
    f.run();
    const path = join(f.skill, '.cueframe-install.json');
    if (receipt === 'missing') rmSync(path);
    else writeFileSync(path, 'broken');
    expect(f.run().skipped).toEqual([join(f.skill, 'SKILL.md')]);
  });

  it('backs up the entire edited package before an explicit replacement', () => {
    const f = fixture();
    f.run();
    writeFileSync(join(f.skill, 'references', 'preview.md'), 'Custom reference.');
    writeFileSync(join(f.skill, 'notes.md'), 'Keep me.');
    const result = f.run(true);
    expect(result.backups).toHaveLength(1);
    const backup = result.backups[0].path;
    expect(readFileSync(join(backup, 'notes.md'), 'utf8')).toBe('Keep me.');
    expect(readFileSync(join(backup, 'references', 'preview.md'), 'utf8')).toBe('Custom reference.');
    expect(readFileSync(join(f.skill, 'references', 'preview.md'), 'utf8')).toBe('First reference.\n');
  });

  it('preserves executable script modes', () => {
    const f = fixture();
    writeFileSync(join(f.packageDir, 'check.sh'), '#!/bin/sh\nexit 0\n');
    chmodSync(join(f.packageDir, 'check.sh'), 0o755);
    f.run();
    expect(lstatSync(join(f.skill, 'check.sh')).mode & 0o777).toBe(0o755);
    expect(f.run().unchanged).toHaveLength(1);
  });

  it('does not follow an installed package symlink, even when force-replacing it', () => {
    const f = fixture();
    const outside = join(f.root, 'custom');
    mkdirSync(outside);
    writeFileSync(join(outside, 'SKILL.md'), 'User package.');
    mkdirSync(f.destination, { recursive: true });
    symlinkSync(outside, f.skill);
    expect(f.run().skipped).toHaveLength(1);
    const result = f.run(true);
    expect(lstatSync(result.backups[0].path).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(outside, 'SKILL.md'), 'utf8')).toBe('User package.');
    expect(lstatSync(f.skill).isSymbolicLink()).toBe(false);
  });

  it('rejects a linked source resource before installing anything', () => {
    const f = fixture();
    symlinkSync(join(f.packageDir, 'SKILL.md'), join(f.packageDir, 'references', 'linked.md'));
    expect(() => f.run()).toThrow('symbolic link');
    expect(existsSync(f.destination)).toBe(false);
  });
});
