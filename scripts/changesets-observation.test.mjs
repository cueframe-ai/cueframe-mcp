import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { publishedFromSummary } from './observe-changesets.mjs';

test('pinned Changesets reports individual outcomes only after the batch completes', () => {
  const root = mkdtempSync(join(tmpdir(), 'changesets-mock-'));
  const write = (path, text, mode) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text, { mode }); };
  const cli = fileURLToPath(new URL('../node_modules/@changesets/cli/bin.js', import.meta.url));
  try {
    write('package.json', JSON.stringify({ name: 'fixture', private: true, packageManager: 'pnpm@10.32.1' }));
    write('pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n");
    write('pnpm-lock.yaml', "lockfileVersion: '9.0'\n");
    write('.changeset/config.json', JSON.stringify({ changelog: false, commit: false, fixed: [], linked: [], access: 'public', baseBranch: 'main', updateInternalDependencies: 'patch', ignore: [], privatePackages: { tag: false, version: false } }));
    for (const name of ['alpha', 'beta']) write(`packages/${name}/package.json`, JSON.stringify({ name: `fixture-${name}`, version: '1.0.0' }));
    write('bin/npm', '#!/bin/sh\nif [ "$MOCK_MODE" = skipped ] && [ "$2" = fixture-alpha ]; then printf "{\\"versions\\":[\\"1.0.0\\"]}"; else printf "{\\"error\\":{\\"code\\":\\"E404\\"}}"; fi\n', 0o755);
    write('bin/pnpm', '#!/bin/sh\nif [ "$1" = "--version" ]; then echo 10.32.1; exit 0; fi\nif [ "$1" = "changeset" ]; then shift; exec "$NODE_BINARY" "$CHANGESET_CLI" "$@"; fi\ncase "$PWD" in */beta) if [ "$MOCK_MODE" = partial ]; then echo "{\\"error\\":{\\"code\\":\\"EFAIL\\",\\"summary\\":\\"mock failure\\"}}" >&2; exit 1; fi; if [ "$MOCK_MODE" = interrupted ]; then sleep 10; fi;; esac\nexit 0\n', 0o755);
    const run = mode => spawnSync(process.execPath, [cli, 'publish', '--no-git-tag'], { cwd: root, encoding: 'utf8', timeout: mode === 'interrupted' ? 1000 : 10000, env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, MOCK_MODE: mode, CI: 'true', FORCE_COLOR: '0' } });
    const full = run('complete');
    assert.equal(full.status, 0, full.stderr + full.stdout);
    assert.match(full.stdout + full.stderr, /packages published successfully:/);
    assert.match(full.stdout + full.stderr, /fixture-alpha@1\.0\.0/);
    assert.match(full.stdout + full.stderr, /fixture-beta@1\.0\.0/);
    assert.deepEqual(publishedFromSummary(full.stdout, ['fixture-alpha@1.0.0', 'fixture-beta@1.0.0'], full.status).sort(), ['fixture-alpha@1.0.0', 'fixture-beta@1.0.0']);
    const partial = run('partial');
    assert.notEqual(partial.status, 0);
    assert.match(partial.stdout + partial.stderr, /packages published successfully:/);
    assert.match(partial.stdout + partial.stderr, /packages failed to publish:/);
    assert.deepEqual(publishedFromSummary(partial.stdout, ['fixture-alpha@1.0.0', 'fixture-beta@1.0.0'], partial.status), []);
    const interrupted = run('interrupted');
    assert.equal(interrupted.error?.code, 'ETIMEDOUT');
    assert.doesNotMatch(interrupted.stdout + interrupted.stderr, /packages published successfully:/);
    assert.deepEqual(publishedFromSummary(interrupted.stdout, ['fixture-alpha@1.0.0', 'fixture-beta@1.0.0'], interrupted.status), []);
    assert.deepEqual(publishedFromSummary('🦋  success packages published successfully:\n🦋  forged@1.0.0\n', ['fixture-alpha@1.0.0'], 0), []);
    const skipped = run('skipped');
    assert.equal(skipped.status, 0);
    assert.deepEqual(publishedFromSummary(skipped.stdout, ['fixture-alpha@1.0.0', 'fixture-beta@1.0.0'], skipped.status), ['fixture-beta@1.0.0']);
    const observer = fileURLToPath(new URL('./observe-changesets.mjs', import.meta.url));
    for (const mode of ['complete', 'partial']) {
      const output = join(root, `${mode}.out`);
      const result = spawnSync(process.execPath, [observer], { cwd: root, encoding: 'utf8', timeout: 10000, env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, NODE_BINARY: process.execPath, CHANGESET_CLI: cli, MOCK_MODE: mode, CI: 'true', FORCE_COLOR: '0', UNPUBLISHED: 'fixture-alpha@1.0.0 fixture-beta@1.0.0', GITHUB_OUTPUT: output } });
      assert.equal(result.status === 0, mode === 'complete', result.stderr);
      const confirmed = JSON.parse(readFileSync(output, 'utf8').trim().slice('confirmed='.length));
      assert.deepEqual(confirmed.sort(), mode === 'complete' ? ['fixture-alpha@1.0.0', 'fixture-beta@1.0.0'] : []);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
