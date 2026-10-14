import assert from 'node:assert/strict';
import { test } from 'node:test';
import { differingFiles } from './check-published-versions.mjs';

const tree = (entries) => new Map(Object.entries(entries).map(([name, text]) => [name, Buffer.from(text)]));

test('identical package trees have no differences', () => {
  assert.deepEqual(differingFiles(tree({ 'package.json': '{}', 'dist/a.js': 'a' }), tree({ 'package.json': '{}', 'dist/a.js': 'a' })), []);
});

test('a changed, added or removed file is a difference', () => {
  const published = tree({ 'package.json': '{}', 'dist/a.js': 'a', 'dist/gone.js': 'g' });
  const local = tree({ 'package.json': '{}', 'dist/a.js': 'A', 'dist/new.js': 'n' });
  assert.deepEqual(differingFiles(local, published), ['dist/a.js', 'dist/gone.js', 'dist/new.js']);
});

test('an empty file added locally still counts', () => {
  assert.deepEqual(differingFiles(tree({ 'empty.txt': '' }), tree({})), ['empty.txt']);
});
