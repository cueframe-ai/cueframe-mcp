import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { differingFiles, isPrerelease, PUBLISHED_PACKAGES } from './check-published-versions.mjs';

const tree = (entries) => new Map(Object.entries(entries).map(([name, text]) => [name, Buffer.from(text)]));

test('identical package trees have no differences', () => {
  assert.deepEqual(differingFiles(tree({ 'package.json': '{}', 'dist/a.js': 'a' }), tree({ 'package.json': '{}', 'dist/a.js': 'a' })), []);
});

test('a changed, added or removed file is a difference', () => {
  const published = tree({ 'package.json': '{}', 'dist/a.js': 'a', 'dist/gone.js': 'g' });
  const local = tree({ 'package.json': '{}', 'dist/a.js': 'A', 'dist/new.js': 'n' });
  assert.deepEqual(differingFiles(local, published), ['dist/a.js', 'dist/gone.js', 'dist/new.js']);
});

// pnpm 10 packs the CLI's two workspace devDependencies in whichever order their ranges resolve, so the
// same tree packs `package.json` with `@cueframe/sdk` and `@cueframe/skills` either way round.
test('package.json is compared by content: key order alone is no difference, a value change is', () => {
  const a = '{\n  "name": "cueframe",\n  "devDependencies": {\n    "@cueframe/sdk": "^0.17.1",\n    "@cueframe/skills": "0.4.6"\n  }\n}\n';
  const b = '{\n  "name": "cueframe",\n  "devDependencies": {\n    "@cueframe/skills": "0.4.6",\n    "@cueframe/sdk": "^0.17.1"\n  }\n}\n';
  assert.deepEqual(differingFiles(tree({ 'package.json': a }), tree({ 'package.json': b })), []);
  assert.deepEqual(differingFiles(tree({ 'package.json': a }), tree({ 'package.json': b.replace('0.4.6', '0.4.7') })), ['package.json']);
  assert.deepEqual(differingFiles(tree({ 'package.json': '["a","b"]' }), tree({ 'package.json': '["b","a"]' })), ['package.json'], 'array order still counts');
});

test('an empty file added locally still counts', () => {
  assert.deepEqual(differingFiles(tree({ 'empty.txt': '' }), tree({})), ['empty.txt']);
});

test('a version with a prerelease suffix is a prerelease', () => {
  assert.equal(isPrerelease('0.17.1-ea20261031.1'), true);
  assert.equal(isPrerelease('1.0.0-rc.1'), true);
  assert.equal(isPrerelease('0.17.1'), false);
  assert.equal(isPrerelease('0.17.1+build.5'), false);
});

// Board decision, 2026-11-04: publish real versions only, never `-ea` prereleases.
test('every published package declares a normal version', () => {
  for (const dir of PUBLISHED_PACKAGES) {
    const { name, version } = JSON.parse(readFileSync(new URL(`../${dir}/package.json`, import.meta.url), 'utf8'));
    assert.equal(isPrerelease(version), false, `${name}@${version} is a prerelease; set a normal version`);
  }
});
