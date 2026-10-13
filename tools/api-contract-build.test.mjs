import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(REPO_ROOT, path));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('the contract build ships the synced openapi.json unchanged, and every $ref in it resolves', () => {
  execFileSync(process.execPath, ['packages/api-contract/scripts/build.mjs'], { cwd: REPO_ROOT, stdio: 'pipe' });
  const shipped = read('packages/api-contract/dist/openapi.json');
  assert.equal(sha(shipped), JSON.parse(read('api/contract-manifest.json')).files['openapi.json']);

  const spec = JSON.parse(shipped);
  const refs = new Set();
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) key === '$ref' ? refs.add(child) : walk(child);
    }
  };
  walk(spec);
  const missing = [...refs].filter((ref) => !spec.components.schemas[ref.replace('#/components/schemas/', '')]);
  assert.deepEqual(missing, []);
});
