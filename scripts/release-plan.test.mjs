import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { plannedVersions } from './release-plan.mjs';

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'cf-release-plan-'));
  const json = (path, value) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), JSON.stringify(value)); };
  json('package.json', { name: 'root', private: true });
  writeFileSync(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
  json('packages/sdk/package.json', { name: '@cueframe/sdk', version: '0.17.1' });
  json('packages/cli/package.json', { name: 'cueframe', version: '0.12.0', dependencies: { '@cueframe/sdk': 'workspace:^' } });
  mkdirSync(join(root, '.changeset'));
  cpSync(new URL('../.changeset/config.json', import.meta.url), join(root, '.changeset/config.json'));
  return { root, changeset: (name, text) => writeFileSync(join(root, '.changeset', `${name}.md`), text), dispose: () => rmSync(root, { recursive: true, force: true }) };
}

test('no pending changeset plans nothing', async () => {
  const ws = workspace();
  try { assert.deepEqual([...await plannedVersions(ws.root)], []); } finally { ws.dispose(); }
});

test('a minor changeset plans the next minor, and a dependent gets a patch (updateInternalDependencies)', async () => {
  const ws = workspace();
  try {
    ws.changeset('a', '---\n"@cueframe/sdk": minor\n---\n\nAdd a thing.\n');
    assert.deepEqual(Object.fromEntries(await plannedVersions(ws.root)), { '@cueframe/sdk': '0.18.0', cueframe: '0.12.1' });
  } finally { ws.dispose(); }
});
