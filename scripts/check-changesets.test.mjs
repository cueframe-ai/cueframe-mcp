// Changesets: every pull request that changes a published package
// carries a changeset naming its bump, and nobody edits a `version` field by hand.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
const changesetBin = createRequire(import.meta.url).resolve('@changesets/cli/bin.js');
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

test('against a real git history: the branch fails until it adds a changeset', async () => {
  const repo = scratch();
  try {
    repo.git('checkout', '--quiet', '-b', 'feature');
    repo.write('packages/sdk/src/client.ts', 'export const a = 2;\n');
    repo.git('commit', '--quiet', '-am', 'change sdk');
    assert.notDeepEqual((await checkChangesets(repo.root, { base: repo.base })).problems, []);
    repo.write('.changeset/brave-sdk.md', '---\n"@cueframe/sdk": patch\n"cueframe": patch\n---\n\nFix a.\n');
    repo.git('add', '-A'); repo.git('commit', '--quiet', '-m', 'changeset');
    assert.deepEqual((await checkChangesets(repo.root, { base: repo.base })).problems, []);
    repo.write('packages/sdk/package.json', `${JSON.stringify({ name: '@cueframe/sdk', version: '1.0.1' }, null, 2)}\n`);
    repo.git('commit', '--quiet', '-am', 'hand bump');
    assert.match((await checkChangesets(repo.root, { base: repo.base })).problems.join('\n'), /version 1\.0\.0 -> 1\.0\.1/);
  } finally {
    repo.dispose();
  }
});

// Releases go through the Changesets "Version packages" pull
// request. That branch is the one place a `version` changes: it is accepted when it is exactly what the
// base's pending changesets plan, for every planned package.
const plan = new Map([['@cueframe/sdk', '1.0.1'], ['cueframe', '1.0.1']]);
const sdkEdit = { file: 'packages/sdk/package.json', name: '@cueframe/sdk', from: '1.0.0', to: '1.0.1' };
const cliEdit = { file: 'packages/cli/package.json', name: 'cueframe', from: '1.0.0', to: '1.0.1' };
const versionPrFiles = ['.changeset/brave-sdk.md', 'packages/sdk/package.json', 'packages/sdk/CHANGELOG.md', 'packages/cli/package.json', 'packages/cli/CHANGELOG.md'];

test('a Version packages branch that applies the base plan exactly passes without a new changeset', () => {
  assert.deepEqual(changesetProblems({ changedFiles: versionPrFiles, changesets: [], versionEdits: [sdkEdit, cliEdit], planned: plan }), []);
});

test('a version that differs from the plan, or a planned package left out, still fails', () => {
  const wrong = changesetProblems({ changedFiles: versionPrFiles, changesets: [], versionEdits: [{ ...sdkEdit, to: '1.1.0' }, cliEdit], planned: plan }).join('\n');
  assert.match(wrong, /version 1\.0\.0 -> 1\.1\.0 edited by hand/);
  const partial = changesetProblems({ changedFiles: versionPrFiles, changesets: [], versionEdits: [sdkEdit], planned: plan }).join('\n');
  assert.match(partial, /cueframe: the pending changesets plan 1\.0\.1/);
  const unplanned = changesetProblems({ changedFiles: ['packages/sdk/package.json'], changesets: [], versionEdits: [sdkEdit], planned: new Map() }).join('\n');
  assert.match(unplanned, /edited by hand/);
});

test('a skip-ci marker in a changeset fails: it would reach the Version packages PR and its merge commit', () => {
  for (const marker of ['[skip ci]', '[ci skip]', '[no ci]', '[skip actions]', '[actions skip]', '[SKIP CI]']) {
    const changeset = { file: '.changeset/a.md', ...parseChangeset(`---\n"@cueframe/sdk": patch\ncueframe: patch\n---\n\nFix ${marker} a.\n`) };
    assert.match(changesetProblems({ changedFiles: ['packages/sdk/src/client.ts', '.changeset/a.md'], changesets: [changeset], versionEdits: [] }).join('\n'), /skip/i, marker);
  }
});

test('against a real git history: `changeset version` output passes as a Version packages branch; a hand bump on top fails', async () => {
  const repo = scratch();
  try {
    repo.write('.changeset/config.json', readFileSync(new URL('../.changeset/config.json', import.meta.url), 'utf8'));
    repo.write('package.json', '{ "name": "scratch", "private": true }\n');
    repo.write('pnpm-workspace.yaml', 'packages:\n  - packages/*\n');
    repo.write('.changeset/brave-sdk.md', '---\n"@cueframe/sdk": patch\n"cueframe": patch\n---\n\nFix a.\n');
    repo.git('add', '-A'); repo.git('commit', '--quiet', '-m', 'merged feature with a changeset');
    const main = repo.git('rev-parse', 'HEAD');
    repo.git('checkout', '--quiet', '-b', 'changeset-release/main');
    execFileSync(process.execPath, [changesetBin, 'version'], { cwd: repo.root, stdio: 'pipe' });
    repo.git('add', '-A'); repo.git('commit', '--quiet', '-m', 'Version Packages');
    const result = await checkChangesets(repo.root, { base: main });
    assert.deepEqual(result.problems, []);
    repo.write('packages/sdk/package.json', `${JSON.stringify({ name: '@cueframe/sdk', version: '1.0.5' }, null, 2)}\n`);
    repo.git('commit', '--quiet', '-am', 'hand bump');
    assert.match((await checkChangesets(repo.root, { base: main })).problems.join('\n'), /1\.0\.0 -> 1\.0\.5 edited by hand/);
  } finally {
    repo.dispose();
  }
});

test('a Version packages pull request merged after main gained another changeset releases only what it consumed', async () => {
  const repo = scratch();
  try {
    repo.write('.changeset/config.json', readFileSync(new URL('../.changeset/config.json', import.meta.url), 'utf8'));
    repo.write('package.json', '{ "name": "scratch", "private": true }\n');
    repo.write('pnpm-workspace.yaml', 'packages:\n  - packages/*\n');
    repo.write('.changeset/brave-sdk.md', '---\n"@cueframe/sdk": patch\n"cueframe": patch\n---\n\nFix a.\n');
    repo.git('add', '-A'); repo.git('commit', '--quiet', '-m', 'feature one');
    repo.git('checkout', '--quiet', '-b', 'changeset-release/main');
    execFileSync(process.execPath, [changesetBin, 'version'], { cwd: repo.root, stdio: 'pipe' });
    repo.git('add', '-A'); repo.git('commit', '--quiet', '-m', 'Version Packages');
    repo.git('checkout', '--quiet', 'main');
    repo.write('.changeset/calm-skills.md', '---\n"@cueframe/skills": minor\n---\n\nNew skill.\n');
    repo.git('add', '-A'); repo.git('commit', '--quiet', '-m', 'feature two');
    const before = repo.git('rev-parse', 'HEAD');
    repo.git('merge', '--quiet', '--no-ff', '-m', 'Merge Version packages', 'changeset-release/main');
    assert.deepEqual((await checkChangesets(repo.root, { base: before })).problems, []);
  } finally {
    repo.dispose();
  }
});
