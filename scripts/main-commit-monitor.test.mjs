import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { deliver, report, verdict } from './main-commit-monitor.mjs';

const SHA = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const merged = { number: 7, state: 'closed', merged_at: '2026-11-15T00:00:00Z', merge_commit_sha: SHA, base: { ref: 'main' }, head: { sha: HEAD }, html_url: 'https://github.com/o/r/pull/7' };
const run = (id, name, conclusion, status = 'completed') => ({ id, name, status, conclusion, html_url: `https://github.com/o/r/runs/${id}` });
const check = (over) => verdict({ sha: SHA, branch: 'main', pulls: [merged], checkRuns: [], statuses: [], required: ['ci-status'], ...over });

test('a merge commit whose required check passed on the PR head is verified', () => {
  const { pr, problems } = check({ checkRuns: [run(1, 'ci-status', 'success'), run(2, 'rehearsal', 'failure')] });
  assert.equal(pr.number, 7);
  assert.deepEqual(problems, []);
});

test('a commit pushed without a merged pull request is unverified', () => {
  const { pr, problems } = check({ pulls: [] });
  assert.equal(pr, null);
  assert.match(problems[0], /is not the merge commit of a pull request merged into main$/);
});

test('a commit that only belongs to an open pull request, or to another branch, is unverified', () => {
  const open = { ...merged, merged_at: null, merge_commit_sha: 'c'.repeat(40), state: 'open' };
  assert.match(check({ pulls: [open] }).problems[0], /associated pull requests: #7 \(open\)/);
  assert.equal(check({ pulls: [{ ...merged, base: { ref: 'release' } }] }).pr, null);
});

test('a required check that failed, was cancelled, is still running or never reported is named', () => {
  assert.match(check({ checkRuns: [run(1, 'ci-status', 'failure')] }).problems[0], /required check ci-status is failure on the head \(https:/);
  assert.match(check({ checkRuns: [run(1, 'ci-status', 'cancelled')] }).problems[0], /is cancelled/);
  assert.match(check({ checkRuns: [run(1, 'ci-status', null, 'in_progress')] }).problems[0], /is in_progress/);
  assert.match(check({ checkRuns: [run(1, 'ci-status', 'skipped')] }).problems[0], /is skipped/);
  assert.deepEqual(check({}).problems, ['required check ci-status never reported on the head']);
});

test('a pass on the exact head counts even when a later re-run of that head was cancelled', () => {
  assert.deepEqual(check({ checkRuns: [run(1, 'ci-status', 'success'), run(2, 'ci-status', 'failure')] }).problems, []);
  assert.match(check({ checkRuns: [run(1, 'ci-status', 'failure'), run(2, 'ci-status', 'cancelled')] }).problems[0], /is cancelled/);
});

test('a required commit status is read by context, newest first', () => {
  const required = ['ci-status', 'public-text'];
  const ok = [run(1, 'ci-status', 'success')];
  assert.deepEqual(check({ required, checkRuns: ok, statuses: [{ context: 'public-text', state: 'success' }, { context: 'public-text', state: 'pending' }] }).problems, []);
  assert.deepEqual(check({ required, checkRuns: ok, statuses: [{ context: 'public-text', state: 'failure' }] }).problems, ['required status public-text is failure on the head']);
});

test('with no required list every check and status on the head must pass, and some must exist', () => {
  const all = (over) => check({ required: [], ...over });
  assert.deepEqual(all({ checkRuns: [run(1, 'node', 'success'), run(2, 'drift', 'skipped'), run(3, 'main-commit-monitor', null, 'in_progress')] }).problems, []);
  assert.deepEqual(all({}).problems, ['no checks reported on the head']);
  assert.equal(all({ checkRuns: [run(1, 'node', 'success'), run(2, 'hygiene', 'failure')] }).problems.length, 1);
  assert.deepEqual(all({ checkRuns: [run(1, 'node', 'success')], statuses: [{ context: 'lint', state: 'error' }] }).problems, ['status lint is error on the head']);
});

test('the report carries the commit, the pull request and the problems for the revert issue', () => {
  const payload = report({ repo: 'o/r', sha: SHA, server: 'https://github.com', runUrl: 'https://github.com/o/r/actions/runs/1', commit: { message: 'fix: x\n\nbody', author: { name: 'A' } }, pr: { ...merged, merged_by: { login: 'm' } }, problems: ['p'] });
  assert.equal(payload.event, 'main_commit.unverified');
  assert.equal(payload.commit_url, `https://github.com/o/r/commit/${SHA}`);
  assert.equal(payload.commit_title, 'fix: x');
  assert.deepEqual(payload.pull_request, { number: 7, url: merged.html_url, head: HEAD, merged_by: 'm' });
  assert.equal(report({ repo: 'o/r', sha: SHA, server: 'https://github.com', runUrl: null, commit: null, pr: null, problems: [] }).pull_request, null);
});

test('delivery keys the webhook by repository and commit, and accepts only a created or duplicate issue', async () => {
  const calls = [];
  const answer = (status, body) => async (url, init) => {
    calls.push({ url, init });
    return { ok: status < 300, status, text: async () => JSON.stringify(body) };
  };
  assert.equal(await deliver({ webhook: 'https://tracker.example/hook', repo: 'o/r', sha: SHA, payload: { a: 1 }, post: answer(200, { status: 'accepted' }) }), 'accepted');
  assert.equal(calls[0].init.headers['idempotency-key'], `main-commit-monitor:o/r:${SHA}`);
  assert.deepEqual(JSON.parse(calls[0].init.body), { a: 1 });
  assert.equal(await deliver({ webhook: 'h', repo: 'o/r', sha: SHA, payload: {}, post: answer(200, { status: 'duplicate' }) }), 'duplicate');
  await assert.rejects(deliver({ webhook: 'h', repo: 'o/r', sha: SHA, payload: {}, post: answer(200, { status: 'ignored', reason: 'autopilot paused' }) }), /ignored autopilot paused/);
  await assert.rejects(deliver({ webhook: 'h', repo: 'o/r', sha: SHA, payload: {}, post: answer(404, {}) }), /404/);
});

test('the workflow runs the monitor on every push to main, only in the organization repository', () => {
  const workflow = readFileSync(new URL('../.github/workflows/main-commit-monitor.yml', import.meta.url), 'utf8');
  assert.match(workflow, /^on:\n  push:\n    branches: \[main\]\n\n/m);
  assert.match(workflow, /if: github\.repository_owner == 'cueframe-ai'/);
  assert.match(workflow, /^          REQUIRED_CHECKS: ''$/m);
  assert.match(workflow, /MAIN_MONITOR_WEBHOOK: \$\{\{ secrets\.MAIN_MONITOR_WEBHOOK \}\}/);
  assert.match(workflow, /node scripts\/main-commit-monitor\.mjs$/m);
});
