import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkApiInputs } from './check-api-inputs.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** A temp root holding a copy of the committed api/; `mutate` edits it before the check runs. */
function withApiCopy(mutate = () => {}) {
  const root = mkdtempSync(join(tmpdir(), 'cf-api-inputs-'));
  cpSync(resolve(REPO_ROOT, 'api'), join(root, 'api'), { recursive: true });
  const path = (name) => join(root, 'api', name);
  const readJson = (name) => JSON.parse(readFileSync(path(name), 'utf8'));
  const writeJson = (name, value) => writeFileSync(path(name), `${JSON.stringify(value, null, 2)}\n`);
  try {
    mutate({ path, readJson, writeJson });
    return checkApiInputs(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('the committed inputs pass as one sync', () => {
  const result = withApiCopy();
  assert.deepEqual(result.problems, []);
  assert.equal(result.ok, true);
  assert.match(result.manifest.kernelVersion, /^\d+\.\d+\.\d+/);
});

test('scene-schema.json with one description changed fails, naming scene-schema.json', () => {
  const result = withApiCopy(({ readJson, writeJson }) => {
    const schema = readJson('scene-schema.json');
    schema.description = `${schema.description} (tampered)`;
    writeJson('scene-schema.json', schema);
  });
  assert.equal(result.ok, false);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /^scene-schema\.json: sha256 .* does not match the sync manifest/);
});

test('scene-examples.json with one example removed fails, naming scene-examples.json', () => {
  const result = withApiCopy(({ readJson, writeJson }) => {
    const examples = readJson('scene-examples.json');
    assert.ok(examples.length >= 2, 'the fixture needs two examples to remove one');
    writeJson('scene-examples.json', examples.slice(1));
  });
  assert.equal(result.ok, false);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /^scene-examples\.json: sha256 .* does not match the sync manifest/);
});

test('a manifest without privateCommit fails', () => {
  const result = withApiCopy(({ readJson, writeJson }) => {
    const manifest = readJson('contract-manifest.json');
    delete manifest.privateCommit;
    writeJson('contract-manifest.json', manifest);
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.problems, ['api/contract-manifest.json is not a sync manifest; re-run the private contract sync']);
});

test('working-tree provenance requires every recoverable source digest', () => {
  for (const key of ['sha256', 'patchSha256', 'untrackedSha256', 'lockfileSha256']) {
    const result = withApiCopy(({ readJson, writeJson }) => {
      const manifest = readJson('contract-manifest.json');
      manifest.schemaVersion = 2;
      manifest.privateSource = {
        kind: 'working-tree', baseCommit: manifest.privateCommit,
        sha256: 'a'.repeat(64), patchSha256: 'b'.repeat(64),
        untrackedSha256: 'c'.repeat(64), lockfileSha256: 'd'.repeat(64),
      };
      delete manifest.privateSource[key];
      writeJson('contract-manifest.json', manifest);
    });
    assert.equal(result.ok, false, key);
    assert.match(result.problems[0], /invalid source snapshot provenance/);
  }
});

test('source snapshot base must match the private commit', () => {
  const result = withApiCopy(({ readJson, writeJson }) => {
    const manifest = readJson('contract-manifest.json');
    manifest.schemaVersion = 2;
    manifest.privateSource = { kind: 'commit', baseCommit: '0'.repeat(40), lockfileSha256: 'a'.repeat(64) };
    writeJson('contract-manifest.json', manifest);
  });
  assert.equal(result.ok, false);
});

test('openapi.json with one edit fails, naming openapi.json', () => {
  const result = withApiCopy(({ readJson, writeJson }) => {
    const spec = readJson('openapi.json');
    spec.info.description = `${spec.info.description ?? ''} (tampered)`;
    writeJson('openapi.json', spec);
  });
  assert.equal(result.ok, false);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /^openapi\.json: sha256 .* does not match the sync manifest/);
});

test('the sync manifest names the kernel artifact whose components the contract embeds, under this package version', () => {
  // The private sync asserts the embedded components deep-equal that artifact (assertEmbedsKernelComponents);
  // here the manifest must carry the artifact's identity and the contract version this package publishes.
  const manifest = JSON.parse(readFileSync(resolve(REPO_ROOT, 'api/contract-manifest.json'), 'utf8'));
  const { version } = JSON.parse(readFileSync(resolve(REPO_ROOT, 'packages/api-contract/package.json'), 'utf8'));
  assert.equal(manifest.kernelArtifact?.version, manifest.kernelVersion);
  assert.match(manifest.kernelArtifact.sha256, /^[0-9a-f]{64}$/);
  assert.equal(manifest.contractVersion, version);
});
