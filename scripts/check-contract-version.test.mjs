import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRACT_FILES, PACKAGE_JSON, checkContractVersion } from './check-contract-version.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * A scratch repository shaped like this one: the five api/*.json files and the package manifest,
 * one commit on main. Each helper returns the repo so calls chain in the tests.
 */
function scratchRepo() {
  const root = mkdtempSync(join(tmpdir(), 'cf-contract-version-'));
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.com',
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
  };
  // The caller's PR baseline belongs to the real repository, not this fixture's history.
  delete env.CONTRACT_BASELINE;
  const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const repo = {
    root,
    env,
    git,
    write(path, value) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
      return repo;
    },
    api(name, value) { return repo.write(`api/${name}`, value); },
    version(version) { return repo.write(PACKAGE_JSON, { name: '@cueframe/api-contract', version }); },
    commit(message) { git('add', '-A'); git('commit', '--quiet', '-m', message); return repo; },
    /** Fold the working tree into the last commit: main lands a resync and its bump as one commit. */
    amend() { git('add', '-A'); git('commit', '--quiet', '--amend', '--no-edit'); return repo; },
    /** Pretend `main` has been pushed: origin/main points where main does now. */
    publishMain() { git('update-ref', 'refs/remotes/origin/main', 'main'); return repo; },
    check(options) { return checkContractVersion(root, { base: undefined, ...options }); },
    dispose() { rmSync(root, { recursive: true, force: true }); },
  };
  git('init', '--quiet', '-b', 'main');
  for (const name of CONTRACT_FILES) repo.api(name, { name, revision: 1 });
  repo.api('contract-manifest.json', { schemaVersion: 1, kernelVersion: '0.2.64', privateCommit: 'a'.repeat(40), files: {} });
  repo.version('1.0.0').commit('contract 1.0.0');
  return repo;
}

function withRepo(fn) {
  const repo = scratchRepo();
  try { return fn(repo); } finally { repo.dispose(); }
}

test('this repository passes against its own history', () => {
  const result = checkContractVersion(REPO_ROOT);
  // The check's own sentence is the useful output when a developer has an un-bumped api/ edit in progress.
  assert.deepEqual(result.problems, [], result.problems.join('\n'));
  assert.equal(result.ok, true);
  assert.match(result.version.current, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/);
});

test('versioned local prereleases preserve the contract byte-identity gate', () => {
  withRepo((repo) => {
    repo.api('openapi.json', { revision: 2 }).version('1.1.0-ea20261029.1').commit('local engineering archive');
    assert.equal(repo.check().ok, true);
    repo.api('openapi.json', { revision: 3 });
    assert.equal(repo.check().ok, false, 'different bytes cannot reuse the same archive version');
    repo.version('1.1.0-ea20261029.2');
    assert.equal(repo.check().ok, true);
  });
});

test('a root commit with nothing to compare against passes', () => {
  withRepo((repo) => {
    const result = repo.check();
    assert.equal(result.ok, true);
    assert.equal(result.baseline.rev, null);
  });
});

test('on main: a commit that changes api/ without a version bump fails and names the file', () => {
  withRepo((repo) => {
    repo.api('openapi.json', { name: 'openapi.json', revision: 2 }).commit('resync without bump');
    const result = repo.check();
    assert.equal(result.ok, false);
    assert.deepEqual(result.changed, ['openapi.json']);
    assert.match(result.problems[0], /^api\/openapi\.json changed since HEAD~1 .* still 1\.0\.0;/);
  });
});

test('on main: a commit that changes api/ and bumps the version passes', () => {
  withRepo((repo) => {
    repo.api('openapi.json', { name: 'openapi.json', revision: 2 }).api('public-surface.json', { revision: 2 })
      .version('1.1.0').commit('resync with bump');
    const result = repo.check();
    assert.deepEqual(result.problems, [], result.problems.join('\n'));
    assert.deepEqual(result.changed, ['openapi.json', 'public-surface.json']);
    assert.deepEqual(result.version, { current: '1.1.0', baseline: '1.0.0' });
  });
});

test('on main: an uncommitted api/ change is compared against HEAD, so a bump in the previous commit does not cover it', () => {
  withRepo((repo) => {
    repo.api('openapi.json', { revision: 2 }).version('1.1.0').commit('resync with bump');
    repo.api('scene-schema.json', { revision: 3 }); // the sync ran again; nothing committed, no bump
    const result = repo.check();
    assert.equal(result.ok, false);
    assert.equal(result.baseline.rev, 'HEAD');
    assert.deepEqual(result.changed, ['scene-schema.json']);
    repo.version('1.2.0');
    assert.equal(repo.check().ok, true);
  });
});

test('on a branch: all commits since the merge-base with origin/main share one version bump', () => {
  withRepo((repo) => {
    repo.publishMain().git('checkout', '--quiet', '-b', 'contract/resync');
    repo.api('openapi.json', { revision: 2 }).version('1.1.0').commit('resync + bump');
    repo.api('openapi.json', { revision: 3 }).commit('fix-up resync, same version');
    const result = repo.check();
    assert.deepEqual(result.problems, [], result.problems.join('\n'));
    assert.match(result.baseline.reason, /^merge-base of HEAD and origin\/main \(contract\/resync\)$/);
    assert.deepEqual(result.version, { current: '1.1.0', baseline: '1.0.0' });
  });
});

test('on a branch: api/ changed with no bump since origin/main fails even when the tip commit is clean', () => {
  withRepo((repo) => {
    repo.publishMain().git('checkout', '--quiet', '-b', 'contract/resync');
    repo.api('scene-examples.json', { revision: 2 }).commit('resync');
    repo.write('README.md', 'unrelated\n').commit('docs');
    const result = repo.check();
    assert.equal(result.ok, false);
    assert.deepEqual(result.changed, ['scene-examples.json']);
  });
});

test('off main with no origin/main, the reason names HEAD~1 and why, not "previous commit on main"', () => {
  withRepo((repo) => {
    repo.api('openapi.json', { revision: 2 }).version('1.1.0').commit('bump');
    repo.git('checkout', '--quiet', '-b', 'no-remote');
    assert.equal(repo.check().baseline.reason, 'HEAD~1 (no origin/main to compute a merge-base against; branch no-remote)');
    repo.git('checkout', '--quiet', '--detach');
    assert.equal(repo.check().baseline.reason, 'HEAD~1 (no origin/main to compute a merge-base against; detached HEAD)');
    repo.git('checkout', '--quiet', 'main');
    assert.equal(repo.check().baseline.reason, 'HEAD~1 (previous commit on main)');
  });
});

test('a requested baseline wins; an all-zero or unknown one falls back with a warning', () => {
  withRepo((repo) => {
    const first = repo.git('rev-parse', 'HEAD');
    repo.api('openapi.json', { revision: 2 }).version('1.1.0').commit('bump');
    repo.api('openapi.json', { revision: 3 }).commit('resync, no bump');
    assert.equal(repo.check().ok, false, 'HEAD~1 sees the un-bumped change');
    const fromFirst = repo.check({ base: first });
    assert.equal(fromFirst.ok, true, 'from the first commit the version did move');
    assert.equal(fromFirst.baseline.rev, first);
    for (const zeros of [repo.check({ base: '0'.repeat(40) }), repo.check({ base: '0'.repeat(64) })]) {
      assert.equal(zeros.ok, false);
      assert.match(zeros.warnings[0], /not a reachable commit; falling back/);
    }
    assert.match(repo.check({ base: 'no-such-ref' }).warnings[0], /no-such-ref is not a reachable commit/);
  });
});

test('a sync manifest stamped with another contractVersion fails regardless of history', () => {
  withRepo((repo) => {
    repo.api('contract-manifest.json', { schemaVersion: 1, kernelVersion: '0.2.64', privateCommit: 'a'.repeat(40), files: {}, contractVersion: '1.0.1' });
    repo.version('1.0.1').commit('sync stamped 1.0.1');
    assert.equal(repo.check().ok, true, 'stamp equal to the package version is fine');
    repo.version('1.0.2'); // the package moved on, the stamp did not
    const result = repo.check();
    assert.equal(result.ok, false);
    assert.match(result.problems[0], /records contractVersion 1\.0\.1 but .* is 1\.0\.2/);
  });
});

test('the CLI exits 1 with the problem on stderr and 0 with a summary on stdout', () => {
  withRepo((repo) => {
    const script = resolve(REPO_ROOT, 'scripts/check-contract-version.mjs');
    const cli = () => {
      try {
        return { status: 0, stdout: execFileSync(process.execPath, [script, '--root', repo.root], { env: repo.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
      } catch (error) { return { status: error.status, stderr: error.stderr }; }
    };
    repo.api('openapi.json', { revision: 2 }).commit('resync, no bump');
    const failed = cli();
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /^api\/openapi\.json changed since HEAD~1/);
    repo.version('1.1.0').amend();
    const passed = cli();
    assert.equal(passed.status, 0);
    assert.match(passed.stdout, /^contract version ok: @cueframe\/api-contract 1\.1\.0; api\/openapi\.json changed and the package moved 1\.0\.0 -> 1\.1\.0/);
  });
});
