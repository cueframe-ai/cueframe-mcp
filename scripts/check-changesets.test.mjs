// Board decision, 2026-11-04 (Paperclip CUE-49): every pull request that changes a published package
// carries a changeset naming its bump, and nobody edits a `version` field by hand.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PACKAGES, affectedPackages, changesetProblems, checkChangesets, parseChangeset, shipsFile } from './check-changesets.mjs';

test('test files and the release-written CHANGELOG never ship; sources, READMEs and skills do', () => {
  assert.equal(shipsFile('packages/sdk/src/client.ts'), true);
  assert.equal(shipsFile('packages/cli/README.md'), true);
  assert.equal(shipsFile('skills/cueframe-cli/SKILL.md'), true);
  assert.equal(shipsFile('packages/cli/src/commands/render.test.ts'), false);
  assert.equal(shipsFile('packages/sdk/vitest.config.ts'), false);
  assert.equal(shipsFile('packages/sdk/CHANGELOG.md'), false);
});

test('a file maps to every package whose tarball it reaches', () => {
  assert.deepEqual(affectedPackages(['packages/sdk/src/client.ts']), ['@cueframe/sdk', 'cueframe']);
  assert.deepEqual(affectedPackages(['skills/cueframe-cli/SKILL.md']), ['@cueframe/skills', 'cueframe']);
  assert.deepEqual(affectedPackages(['api/openapi.json']), ['@cueframe/api-contract']);
  assert.deepEqual(affectedPackages(['README.md', 'scripts/x.mjs', 'packages/sdk/src/a.test.ts']), []);
  assert.deepEqual(Object.keys(PACKAGES).sort(), ['@cueframe/api-contract', '@cueframe/sdk', '@cueframe/skills', 'cueframe']);
});

test('a changeset names packages and bump levels', () => {
  assert.deepEqual(parseChangeset('---\n"@cueframe/sdk": minor\ncueframe: patch\n---\n\nAdd a thing.\n'), {
    releases: { '@cueframe/sdk': 'minor', cueframe: 'patch' },
    summary: 'Add a thing.',
    problems: [],
  });
  assert.match(parseChangeset('no frontmatter').problems[0], /frontmatter/);
  assert.match(parseChangeset('---\n"@cueframe/sdk": huge\n---\nx\n').problems[0], /huge/);
  assert.match(parseChangeset('---\n"@cueframe/sdk": patch\n---\n').problems[0], /summary/);
});

test('a package change without a changeset fails; with one it passes', () => {
  const changed = ['packages/sdk/src/client.ts'];
  assert.match(changesetProblems({ changedFiles: changed, changesets: [], versionEdits: [] }).join('\n'), /@cueframe\/sdk.*cueframe/s);
  const both = { file: '.changeset/a.md', releases: { '@cueframe/sdk': 'patch', cueframe: 'patch' }, problems: [] };
  assert.deepEqual(changesetProblems({ changedFiles: changed, changesets: [both], versionEdits: [] }), []);
  const sdkOnly = { file: '.changeset/a.md', releases: { '@cueframe/sdk': 'patch' }, problems: [] };
  assert.match(changesetProblems({ changedFiles: changed, changesets: [sdkOnly], versionEdits: [] }).join('\n'), /cueframe has no changeset/);
});

test('a hand-edited version, an unknown package and prerelease mode fail', () => {
  const problems = changesetProblems({
    changedFiles: ['.changeset/pre.json'],
    changesets: [{ file: '.changeset/a.md', releases: { '@cueframe/nope': 'patch' }, problems: [] }],
    versionEdits: [{ file: 'packages/sdk/package.json', from: '0.17.1', to: '0.17.2' }],
  }).join('\n');
  assert.match(problems, /packages\/sdk\/package\.json: version 0\.17\.1 -> 0\.17\.2/);
  assert.match(problems, /@cueframe\/nope/);
  assert.match(problems, /prerelease mode/);
});

test('a change outside every package needs no changeset', () => {
  assert.deepEqual(changesetProblems({ changedFiles: ['README.md', '.github/workflows/ci.yml'], changesets: [], versionEdits: [] }), []);
});

function scratch() {
  const root = mkdtempSync(join(tmpdir(), 'cf-changesets-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim();
  const write = (path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  git('init', '--quiet', '-b', 'main');
  for (const dir of ['api-contract', 'sdk', 'skills', 'cli']) write(`packages/${dir}/package.json`, `${JSON.stringify({ name: dir === 'cli' ? 'cueframe' : `@cueframe/${dir}`, version: '1.0.0' }, null, 2)}\n`);
  write('packages/sdk/src/client.ts', 'export const a = 1;\n');
  git('add', '-A'); git('commit', '--quiet', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  return { root, git, write, base, dispose: () => rmSync(root, { recursive: true, force: true }) };
}

test('against a real git history: the branch fails until it adds a changeset', () => {
  const repo = scratch();
  try {
    repo.git('checkout', '--quiet', '-b', 'feature');
    repo.write('packages/sdk/src/client.ts', 'export const a = 2;\n');
    repo.git('commit', '--quiet', '-am', 'change sdk');
    assert.notDeepEqual(checkChangesets(repo.root, { base: repo.base }).problems, []);
    repo.write('.changeset/brave-sdk.md', '---\n"@cueframe/sdk": patch\n"cueframe": patch\n---\n\nFix a.\n');
    repo.git('add', '-A'); repo.git('commit', '--quiet', '-m', 'changeset');
    assert.deepEqual(checkChangesets(repo.root, { base: repo.base }).problems, []);
    repo.write('packages/sdk/package.json', `${JSON.stringify({ name: '@cueframe/sdk', version: '1.0.1' }, null, 2)}\n`);
    repo.git('commit', '--quiet', '-am', 'hand bump');
    assert.match(checkChangesets(repo.root, { base: repo.base }).problems.join('\n'), /version 1\.0\.0 -> 1\.0\.1/);
  } finally {
    repo.dispose();
  }
});
