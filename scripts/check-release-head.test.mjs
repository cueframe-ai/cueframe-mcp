import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkReleaseHead } from './check-release-head.mjs';

const sha = 'a'.repeat(40);
const other = 'b'.repeat(40);
const repository = 'cueframe-ai/cueframe-mcp';
const ref = (head) => JSON.stringify({ ref: 'refs/heads/main', object: { type: 'commit', sha: head } });

test('current main succeeds; stale queued or rerun CI fails', () => {
  assert.doesNotThrow(() => checkReleaseHead({ sha, repository, lookup: () => ref(sha) }));
  assert.throws(() => checkReleaseHead({ sha, repository, lookup: () => ref(other) }), /not the current main/);
});

test('lookup failures, malformed results and missing inputs fail closed', () => {
  for (const lookup of [() => { throw new Error('lookup failed'); }, () => 'invalid', () => '{}']) {
    assert.throws(() => checkReleaseHead({ sha, repository, lookup }));
  }
  assert.throws(() => checkReleaseHead({ sha: '', repository, lookup: () => ref(sha) }));
});

test('each downstream path refuses a main advance after planning', () => {
  for (const effect of ['version-pr', 'publish', 'tag', 'registry']) {
    let head = sha;
    const lookup = () => ref(head);
    checkReleaseHead({ sha, repository, lookup });
    head = other;
    let called = false;
    assert.throws(() => { checkReleaseHead({ sha, repository, lookup }); called = true; }, /not the current main/, effect);
    assert.equal(called, false, effect);
  }
});

test('CLI uses gh and fails when its live lookup fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-head-'));
  try {
    const executable = join(dir, 'gh');
    writeFileSync(executable, '#!/bin/sh\n[ "$1" = api ] || exit 2\nprintf "%s" "$FAKE_REF"\nexit "${FAKE_STATUS:-0}"\n', { mode: 0o755 });
    const run = (head, status = '0') => spawnSync(process.execPath, [fileURLToPath(new URL('./check-release-head.mjs', import.meta.url))], {
      encoding: 'utf8', env: { PATH: dir, RELEASE_SHA: sha, GITHUB_REPOSITORY: repository, FAKE_REF: ref(head), FAKE_STATUS: status },
    });
    assert.equal(run(sha).status, 0);
    assert.notEqual(run(other).status, 0);
    assert.notEqual(run(sha, '1').status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('workflow checks each path immediately before its effect', () => {
  const workflow = readFileSync(new URL('../.github/workflows/publish-npm.yml', import.meta.url), 'utf8');
  for (const [job, next, effect] of [
    ['version-pr', 'release-plan', 'open or update the Version packages pull request'],
    ['release-plan', 'publish', 'versions on main that npm does not have'],
    ['publish', 'tag', 'changeset publish'],
    ['tag', 'registry', 'tag the released commit once per published package'],
    ['registry', null, 'publish server.json when its version is new'],
  ]) {
    const section = workflow.split(`\n  ${job}:\n`)[1].split(next ? `\n  ${next}:\n` : '\n  nonexistent:\n')[0];
    assert.ok(section.indexOf('run: node scripts/check-release-head.mjs') >= 0, job);
    assert.ok(section.indexOf('run: node scripts/check-release-head.mjs') < section.indexOf(`- name: ${effect}`), job);
  }
  assert.match(workflow, /node scripts\/check-release-head\.mjs\n          "\$RUNNER_TEMP\/mcp-publisher" publish server\.json/);
});
