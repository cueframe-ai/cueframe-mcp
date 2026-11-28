import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
