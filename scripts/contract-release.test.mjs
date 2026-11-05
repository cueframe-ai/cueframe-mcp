// The api-contract release path end to end, in a scratch copy of this repository: a pull request that
// resyncs the contract and adds a changeset must pass the checks and the build CI runs BEFORE
// `changeset version` (the private sync stamps api/contract-manifest.json with the checkout's package
// version), and the release job's tree AFTER `changeset version` and the stamp sync must pass the same
// checks and the build the publish job runs. Review of PR 64 found the two halves disagreeing: the check
// wanted the planned version in the stamp, the build wanted the package version.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGESET_BIN = join(REPO_ROOT, 'node_modules/@changesets/cli/bin.js');

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cf-contract-release-'));
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.com',
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
  };
  delete env.CONTRACT_BASELINE;
  const run = (command, args) => {
    const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  };
  const ok = (command, args) => {
    const result = run(command, args);
    assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.output}`);
    return result.output;
  };
  for (const path of ['api', 'tools', '.changeset/config.json', 'scripts/check-contract-version.mjs', 'scripts/release-plan.mjs', 'scripts/sync-contract-stamp.mjs']) {
    cpSync(join(REPO_ROOT, path), join(root, path), { recursive: true });
  }
  cpSync(join(REPO_ROOT, 'packages/api-contract'), join(root, 'packages/api-contract'), {
    recursive: true,
    filter: (source) => !/[/\\](node_modules|dist)$/.test(source),
  });
  writeFileSync(join(root, 'package.json'), `${JSON.stringify({ name: 'fixture', private: true, type: 'module' })}\n`);
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/api-contract\n');
  writeFileSync(join(root, '.gitignore'), 'node_modules\ndist\n');
  symlinkSync(join(REPO_ROOT, 'node_modules'), join(root, 'node_modules'));
  mkdirSync(join(root, 'packages/api-contract/node_modules/@cueframe'), { recursive: true });
  symlinkSync(realpathSync(join(REPO_ROOT, 'packages/api-contract/node_modules/@cueframe/kernel')), join(root, 'packages/api-contract/node_modules/@cueframe/kernel'));
  ok('git', ['init', '--quiet', '-b', 'main']);
  ok('git', ['add', '-A']);
  ok('git', ['commit', '--quiet', '-m', 'main']);
  ok('git', ['update-ref', 'refs/remotes/origin/main', 'main']);
  const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
  return {
    root, run, ok, json,
    write(path, value) { writeFileSync(join(root, path), value); },
    dispose() { rmSync(root, { recursive: true, force: true }); },
  };
}

test('a contract changeset passes the pre-version CI build and the post-version release build', () => {
  const repo = fixture();
  try {
    const current = repo.json('packages/api-contract/package.json').version;
    const [major, minor, patch] = current.split('.').map(Number);
    const next = `${major}.${minor}.${patch + 1}`;
    assert.equal(repo.json('api/contract-manifest.json').contractVersion, current, 'main is stamped with its own version');

    // The pull request: a resync from a new private commit. The private sync stamps the version of the
    // checkout it ran against (packages/api-contract/package.json), which a pull request never edits.
    repo.ok('git', ['checkout', '--quiet', '-b', 'contract/resync']);
    const manifest = repo.json('api/contract-manifest.json');
    repo.write('api/contract-manifest.json', `${JSON.stringify({ ...manifest, privateCommit: 'b'.repeat(40), privateSource: { ...manifest.privateSource, baseCommit: 'b'.repeat(40) } }, null, 2)}\n`);
    repo.ok('git', ['commit', '--quiet', '-am', 'resync']);
    assert.equal(repo.run(process.execPath, ['scripts/check-contract-version.mjs']).status, 1, 'an api/ change without a changeset fails');
    repo.write('.changeset/resync.md', '---\n"@cueframe/api-contract": patch\n---\n\nResync.\n');
    repo.ok('git', ['add', '-A']);
    repo.ok('git', ['commit', '--quiet', '-m', 'changeset']);

    // CI on the pull request (and validate on main): the check and the build, before `changeset version`.
    assert.match(repo.ok(process.execPath, ['scripts/check-contract-version.mjs']), /moved .* -> /);
    repo.ok(process.execPath, ['packages/api-contract/scripts/build.mjs']);
    assert.equal(repo.json('packages/api-contract/dist/manifest.json').contractVersion, current);

    // The merge, then the release job: `changeset version` and the stamp sync, committed to main.
    const merged = repo.ok('git', ['rev-parse', 'HEAD']).trim();
    repo.ok('git', ['checkout', '--quiet', 'main']);
    repo.ok('git', ['merge', '--quiet', '--ff-only', 'contract/resync']);
    repo.ok(process.execPath, [CHANGESET_BIN, 'version']);
    assert.equal(repo.json('packages/api-contract/package.json').version, next);
    assert.equal(repo.run(process.execPath, ['packages/api-contract/scripts/build.mjs']).status, 1, 'without the stamp sync the release build refuses the stale stamp');
    repo.ok(process.execPath, ['scripts/sync-contract-stamp.mjs']);
    assert.equal(repo.json('api/contract-manifest.json').contractVersion, next);
    repo.ok('git', ['add', '-A']);
    repo.ok('git', ['commit', '--quiet', '-m', 'chore(release): version packages [skip ci]']);

    // The publish job builds the release commit; the next push's CI measures it against the merge.
    repo.ok(process.execPath, ['packages/api-contract/scripts/build.mjs']);
    for (const file of ['manifest.json', 'contract-manifest.json']) {
      assert.equal(repo.json(`packages/api-contract/dist/${file}`).contractVersion, next, file);
    }
    repo.ok(process.execPath, ['scripts/check-contract-version.mjs', '--base', merged]);
    // Run again, the stamp sync is a no-op.
    assert.match(repo.ok(process.execPath, ['scripts/sync-contract-stamp.mjs']), /already/);
  } finally {
    repo.dispose();
  }
});
