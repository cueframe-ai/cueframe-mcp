// No prerelease (`-ea…`, `-rc`, `-dev`) and no `file:`
// or tarball source for any @cueframe/* dependency, and every pinned version exists on npm.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectPins, pinProblems, specProblem } from './check-cueframe-pins.mjs';

test('local, tarball, git and URL sources are refused', () => {
  for (const spec of [
    'file:artifacts/cueframe-kernel-0.7.15.tgz',
    'link:../kernel',
    'portal:../kernel',
    '../artifacts/cueframe-kernel-0.7.15.tgz',
    'https://example.com/cueframe-kernel-0.7.15.tgz',
    'git+https://github.com/cueframe-ai/cueframe.git',
    'github:cueframe-ai/cueframe',
    'cueframe-ai/cueframe',
  ]) assert.match(specProblem(spec) ?? '', /not a registry version/, spec);
});

test('prerelease versions and ranges are refused', () => {
  for (const spec of ['0.7.15-ea20261029.19', '^0.7.15-ea20261029.19', '1.0.0-rc.1', '~2.0.0-dev.3']) {
    assert.match(specProblem(spec) ?? '', /prerelease/, spec);
  }
});

test('dist-tags are not pins', () => {
  assert.match(specProblem('latest') ?? '', /dist-tag/);
  assert.match(specProblem('*') ?? '', /not a pin/);
});

test('normal versions and ranges are accepted', () => {
  for (const spec of ['0.17.1', '^0.17.1', '~7.0.2', '>=1.2.3 <2']) assert.equal(specProblem(spec), null, spec);
});

test('pins are collected from every dependency field, pnpm overrides, catalogs and package versions', () => {
  const pins = collectPins({
    packageJsons: [
      { path: 'package.json', json: { name: 'root', version: '0.0.0', pnpm: { overrides: { '@cueframe/kernel': 'file:a.tgz', esbuild: '0.28.2' } }, devDependencies: { cueframe: '0.12.0' } } },
      { path: 'packages/x/package.json', json: { name: '@cueframe/x', version: '1.0.0-ea1', dependencies: { '@cueframe/sdk': 'workspace:^', '@cueframe/kernel': 'catalog:', '@cueframe/skills': 'npm:@cueframe/skills@0.4.6', react: '19.0.0' } } },
    ],
    workspaces: [{ path: 'pnpm-workspace.yaml', yaml: { catalog: { '@cueframe/kernel': '0.7.7' }, catalogs: { next: { '@cueframe/sdk': '0.17.1' } }, overrides: { '@cueframe/auth': '0.4.7' } } }],
  });
  const seen = pins.map((p) => `${p.where} ${p.name} ${p.spec}`).sort();
  assert.deepEqual(seen, [
    'package.json devDependencies cueframe 0.12.0',
    'package.json pnpm.overrides @cueframe/kernel file:a.tgz',
    'package.json version root 0.0.0',
    'packages/x/package.json dependencies @cueframe/skills 0.4.6',
    'packages/x/package.json version @cueframe/x 1.0.0-ea1',
    'pnpm-workspace.yaml catalog @cueframe/kernel 0.7.7',
    'pnpm-workspace.yaml catalogs.next @cueframe/sdk 0.17.1',
    'pnpm-workspace.yaml overrides @cueframe/auth 0.4.7',
  ]);
});

test('a pin npm does not have fails, one it has passes, an unreadable one fails', async () => {
  const registry = { '@cueframe/sdk': ['0.17.0', '0.17.1'], '@cueframe/kernel': null };
  const resolve = async (name, spec) => {
    if (registry[name] === null) throw new Error('E403 forbidden');
    return (registry[name] ?? []).filter((v) => spec.replace(/^[\^~]/, '') <= v);
  };
  const problems = await pinProblems([
    { where: 'a', name: '@cueframe/sdk', spec: '0.17.1' },
    { where: 'b', name: '@cueframe/sdk', spec: '0.18.0' },
    { where: 'c', name: '@cueframe/kernel', spec: '0.7.15' },
    { where: 'd', name: '@cueframe/x', spec: '1.0.0-ea1', kind: 'version' },
  ], { resolve });
  assert.equal(problems.length, 3, problems.join('\n'));
  assert.match(problems.join('\n'), /b: @cueframe\/sdk@0\.18\.0 is not on npm/);
  assert.match(problems.join('\n'), /c: @cueframe\/kernel@0\.7\.15: cannot read the registry \(E403 forbidden\)/);
  assert.match(problems.join('\n'), /d: @cueframe\/x version 1\.0\.0-ea1 is a prerelease/);
});

test('an own package version is not looked up on npm (it is published on merge, not before)', async () => {
  const resolve = async () => { throw new Error('should not be called'); };
  assert.deepEqual(await pinProblems([{ where: 'p', name: '@cueframe/sdk', spec: '9.9.9', kind: 'version' }], { resolve }), []);
});
