import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { evidence } from './release-evidence.mjs';

const jobs = Object.fromEntries(['release-plan', 'publish', 'tag', 'registry'].map(name => [name, { result: 'success' }]));
const base = { sha: 'a'.repeat(40), ciRun: '1', ciAttempt: '2', run: '3', attempt: '4', jobs, plan: 'a@1.0.0 b@1.0.0', confirmed: ['a@1.0.0', 'b@1.0.0'] };
test('reports complete, partial, absent evidence and each failed downstream boundary', () => {
  assert.equal(evidence(base).outcome, 'observed-complete');
  assert.equal(evidence({ ...base, confirmed: ['a@1.0.0'] }).outcome, 'investigate');
  assert.equal(evidence({ ...base, confirmed: [] }).packages[0].publish, 'unknown');
  for (const job of Object.keys(jobs)) for (const result of ['failure', 'skipped', 'cancelled']) {
    assert.equal(evidence({ ...base, jobs: { ...jobs, [job]: { result } } }).outcome, 'investigate', `${job}: ${result}`);
  }
  assert.throws(() => evidence({ ...base, ciAttempt: '' }));
  assert.throws(() => evidence({ ...base, confirmed: ['other@1.0.0'] }));
  assert.equal(evidence({ ...base, plan: undefined, confirmed: [], jobs: { ...jobs, publish: { result: 'skipped' }, tag: { result: 'skipped' }, registry: { result: 'skipped' } } }).outcome, 'investigate');
});
test('an empty B plan has its own run record and does not rewrite A', () => {
  const a = evidence({ ...base, confirmed: [], jobs: { ...jobs, publish: { result: 'failure' } } });
  const b = evidence({ ...base, sha: 'b'.repeat(40), run: '5', plan: '', confirmed: [], jobs: { ...jobs, publish: { result: 'skipped' }, tag: { result: 'skipped' }, registry: { result: 'skipped' } } });
  assert.equal(a.outcome, 'investigate'); assert.equal(b.outcome, 'no-publication-planned'); assert.notEqual(a.run, b.run);
});
test('independent evidence job uploads and fails visibly for incomplete evidence', () => {
  const wf = parse(readFileSync(new URL('../.github/workflows/publish-npm.yml', import.meta.url), 'utf8'));
  const job = wf.jobs['release-evidence'];
  assert.deepEqual(job.needs, ['release-plan', 'publish', 'tag', 'registry']);
  assert.match(job.if, /always\(\)/);
  const upload = job.steps.find(s => s.name === 'retain release evidence');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
  assert.match(upload.with.name, /github\.run_id/); assert.match(upload.with.name, /github\.run_attempt/);
  assert.match(job.steps.find(s => s.name === 'surface incomplete release').run, /exit 1/);
});

test('CLI classifies GitHub needs with encoded empty, missing and nonempty plans', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-evidence-'));
  try {
    const run = (needs) => {
      const result = spawnSync(process.execPath, [new URL('./release-evidence.mjs', import.meta.url).pathname], {
        env: { ...process.env, RELEASE_SHA: base.sha, CI_RUN: '1', CI_ATTEMPT: '1', GITHUB_RUN_ID: '2', GITHUB_RUN_ATTEMPT: '1', JOBS: JSON.stringify(needs), REPORT_PATH: join(dir, 'report.json'), GITHUB_OUTPUT: join(dir, 'output') }, encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
    };
    const skipped = { result: 'skipped', outputs: {} };
    const needs = { 'release-plan': { result: 'success', outputs: { evidence_plan: '""' } }, publish: skipped, tag: skipped, registry: skipped };
    assert.equal(run(needs).outcome, 'no-publication-planned');
    assert.equal(run({ ...needs, 'release-plan': { result: 'success', outputs: {} } }).outcome, 'investigate');
    assert.equal(run({ ...needs, 'release-plan': { result: 'failure', outputs: { evidence_plan: '""' } } }).outcome, 'investigate');
    for (const name of ['publish', 'tag', 'registry']) {
      for (const result of ['success', 'failure', 'cancelled']) assert.equal(run({ ...needs, [name]: { result, outputs: {} } }).outcome, 'investigate');
    }
    const release = { 'release-plan': { result: 'success', outputs: { unpublished: 'a@1.0.0', evidence_plan: '"a@1.0.0"' } }, publish: { result: 'success', outputs: { confirmed: '["a@1.0.0"]' } }, tag: { result: 'success', outputs: {} }, registry: { result: 'success', outputs: {} } };
    assert.equal(run(release).outcome, 'observed-complete');
    assert.equal(run({ ...release, publish: { result: 'success', outputs: {} } }).outcome, 'investigate');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('workflow emits a nonempty encoded evidence plan independently of publication output', () => {
  const wf = parse(readFileSync(new URL('../.github/workflows/publish-npm.yml', import.meta.url), 'utf8'));
  const plan = wf.jobs['release-plan'];
  assert.equal(plan.outputs.evidence_plan, '${{ steps.plan.outputs.evidence_plan }}');
  assert.match(plan.steps.find(s => s.id === 'plan').run, /JSON\.stringify\(process\.env\.UNPUBLISHED\)/);
  assert.equal(wf.jobs.publish.if, "needs.release-plan.outputs.unpublished != ''");
});
