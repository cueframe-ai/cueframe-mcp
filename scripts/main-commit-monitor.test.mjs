import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { attribute, deliver, gateProblems, inspect, parseRequired, report } from './main-commit-monitor.mjs';

const SHA = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const CI = '.github/workflows/ci.yml';
const TEXT = '.github/workflows/public-text.yml';
const merged = { number: 7, state: 'closed', merged_at: '2026-11-15T00:00:00Z', merge_commit_sha: SHA, base: { ref: 'main' }, head: { sha: HEAD }, html_url: 'https://github.com/o/r/pull/7' };
const ciRun = { id: 100, check_suite_id: 1, path: CI };
const textRun = { id: 200, check_suite_id: 2, path: TEXT };
const otherRun = { id: 300, check_suite_id: 3, path: '.github/workflows/other.yml' };
const run = (id, name, conclusion, status = 'completed', suite = 1) => ({ id, name, status, conclusion, app: { slug: 'github-actions' }, check_suite: { id: suite }, html_url: `https://github.com/o/r/runs/${id}` });
const status = (id, context, state, runId = 200) => ({ id, context, state, creator: { login: 'github-actions[bot]' }, target_url: `https://github.com/o/r/actions/runs/${runId}` });
const ciOnly = parseRequired(`check:ci-status@${CI}`);
const both = parseRequired(`check:ci-status@${CI},status:public-text@${TEXT}`);
const gates = (over) => gateProblems({ checkRuns: [], statuses: [], workflowRuns: [ciRun, textRun, otherRun], required: ciOnly, ...over });

test('each required gate names its evidence type and producing workflow', () => {
  assert.deepEqual(both, [{ type: 'check', name: 'ci-status', workflow: CI }, { type: 'status', name: 'public-text', workflow: TEXT }]);
  assert.deepEqual(parseRequired(''), []);
  assert.throws(() => parseRequired('ci-status'), /is not check:<name>@<workflow>/);
});

test('a required check that passed on the PR head from its workflow verifies the merge', () => {
  assert.deepEqual(gates({ checkRuns: [run(1, 'ci-status', 'success'), run(2, 'rehearsal', 'failure')] }), []);
});

test('a required check that failed, was cancelled, is running, was skipped or never reported is named', () => {
  assert.match(gates({ checkRuns: [run(1, 'ci-status', 'failure')] })[0], /required check ci-status is failure on the head \(https:/);
  assert.match(gates({ checkRuns: [run(1, 'ci-status', 'cancelled')] })[0], /is cancelled/);
  assert.match(gates({ checkRuns: [run(1, 'ci-status', null, 'in_progress')] })[0], /is in_progress/);
  assert.match(gates({ checkRuns: [run(1, 'ci-status', 'skipped')] })[0], /is skipped/);
  assert.deepEqual(gates({}), [`required check ci-status from ${CI} never reported on the head`]);
});

test('a pass on the exact head counts even when a later re-run of that head was cancelled', () => {
  assert.deepEqual(gates({ checkRuns: [run(1, 'ci-status', 'success'), run(2, 'ci-status', 'failure')] }), []);
  assert.match(gates({ checkRuns: [run(1, 'ci-status', 'failure'), run(2, 'ci-status', 'cancelled')] })[0], /is cancelled/);
});

test('a same-name check from another workflow or app cannot stand in for the required check', () => {
  const elsewhere = run(1, 'ci-status', 'success', 'completed', 3);
  const otherApp = { ...run(2, 'ci-status', 'success'), app: { slug: 'some-app' } };
  assert.match(gates({ checkRuns: [elsewhere, otherApp] })[0], /never reported on the head \(a same-name check from another producer does not count\)/);
  assert.match(gates({ checkRuns: [elsewhere, run(3, 'ci-status', 'failure')] })[0], /is failure/);
});

test('a same-name check run cannot mask a failed or missing trusted status', () => {
  const green = [run(1, 'ci-status', 'success'), run(2, 'public-text', 'success')];
  assert.deepEqual(gates({ required: both, checkRuns: green, statuses: [status(1, 'public-text', 'failure')] }), [`required status public-text is failure on the head (https://github.com/o/r/actions/runs/200)`]);
  assert.match(gates({ required: both, checkRuns: green })[0], /required status public-text from .* never reported on the head$/);
});

test('a trusted status is read from its workflow: newest pass wins, other producers do not count', () => {
  const ok = [run(1, 'ci-status', 'success')];
  assert.deepEqual(gates({ required: both, checkRuns: ok, statuses: [status(2, 'public-text', 'success'), status(1, 'public-text', 'pending')] }), []);
  const forged = [status(3, 'public-text', 'success', 300), { ...status(4, 'public-text', 'success'), creator: { login: 'someone' } }];
  assert.match(gates({ required: both, checkRuns: ok, statuses: forged })[0], /a same-name status from another producer does not count/);
});

test('with no required gates every check and status on the head must pass, and some must exist', () => {
  const all = (over) => gates({ required: [], ...over });
  assert.deepEqual(all({ checkRuns: [run(1, 'node', 'success'), run(2, 'drift', 'skipped'), run(3, 'main-commit-monitor', null, 'in_progress')] }), []);
  assert.deepEqual(all({}), ['no checks reported on the head']);
  assert.equal(all({ checkRuns: [run(1, 'node', 'success'), run(2, 'hygiene', 'failure')] }).length, 1);
  assert.deepEqual(all({ checkRuns: [run(1, 'node', 'success')], statuses: [{ context: 'lint', state: 'error' }] }), ['status lint is error on the head']);
});

const c = (n) => String(n).repeat(40);

test('a push of commits that bypassed pull requests flags each of them', () => {
  const { merges, orphans } = attribute({ commits: [c(1)], pullsByCommit: new Map([[c(1), []]]), branch: 'main' });
  assert.equal(merges.size, 0);
  assert.match(orphans[0].problem, /did not arrive through a pull request merged into main in this push$/);
  const open = { ...merged, merged_at: null, merge_commit_sha: c(9), state: 'open', number: 8 };
  assert.match(attribute({ commits: [c(1)], pullsByCommit: new Map([[c(1), [open]]]), branch: 'main' }).orphans[0].problem, /associated pull requests: #8 \(open\)/);
});

test('a merge commit is judged by its pull request, and the branch commits it brought are covered by it', () => {
  const pr = { ...merged, merge_commit_sha: c(3) };
  const { merges, orphans } = attribute({ commits: [c(1), c(2), c(3)], pullsByCommit: new Map([[c(1), [pr]], [c(2), [pr]], [c(3), [pr]]]), branch: 'main' });
  assert.deepEqual([...merges.keys()], [c(3)]);
  assert.deepEqual(orphans, []);
  assert.equal(attribute({ commits: [c(3)], pullsByCommit: new Map([[c(3), [{ ...pr, base: { ref: 'release' } }]]]), branch: 'main' }).merges.size, 0);
});

test('a multi-commit push with an unverified ancestor and a green merge at the tip flags the ancestor', async () => {
  const pr = { ...merged, merge_commit_sha: c(2) };
  const api = {
    '/repos/o/r': { default_branch: 'main' },
    [`/repos/o/r/compare/${c(5)}...${c(2)}?per_page=100&page=1`]: { status: 'ahead', total_commits: 2, commits: [{ sha: c(1), commit: { message: 'direct push' } }, { sha: c(2), commit: { message: 'Merge #7' } }] },
    [`/repos/o/r/commits/${c(2)}/pulls`]: [pr],
    [`/repos/o/r/commits/${c(1)}/pulls`]: [],
    [`/repos/o/r/commits/${HEAD}/check-runs?filter=all&per_page=100&page=1`]: { check_runs: [run(1, 'ci-status', 'success')] },
    [`/repos/o/r/commits/${HEAD}/statuses?per_page=100&page=1`]: [],
    [`/repos/o/r/actions/runs?head_sha=${HEAD}&per_page=100&page=1`]: { workflow_runs: [ciRun] },
  };
  const get = async (path) => {
    assert.ok(path in api, path);
    return api[path];
  };
  const { commits, merges, findings } = await inspect({ get, repo: 'o/r', before: c(5), after: c(2), required: ciOnly });
  assert.deepEqual(commits, [c(1), c(2)]);
  assert.deepEqual([...merges.keys()], [c(2)]);
  assert.deepEqual(findings.map((f) => [f.sha, f.pr, f.commit.message]), [[c(1), null, 'direct push']]);
});

test('a force push or a reset of main is flagged on the new tip', async () => {
  const get = async (path) =>
    path === '/repos/o/r' ? { default_branch: 'main' } : path.startsWith('/repos/o/r/compare/') ? { status: 'behind', total_commits: 0, commits: [] } : assert.fail(path);
  const { findings } = await inspect({ get, repo: 'o/r', before: c(1), after: c(2), required: ciOnly });
  assert.deepEqual(findings.map((f) => f.problems[0]), [`main was moved back from ${c(1)} to ${c(2)}`]);
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
  const answer = (code, body) => async (url, init) => {
    calls.push({ url, init });
    return { ok: code < 300, status: code, text: async () => JSON.stringify(body) };
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
  // Listing permissions sets every other scope to none; these are the reads inspect() makes.
  assert.match(workflow, /^permissions:\n  actions: read\n  checks: read\n  contents: read\n  pull-requests: read\n  statuses: read\n\n/m);
  assert.equal(/^          REQUIRED_CHECKS: (.*)$/m.exec(workflow)[1], "''");
  parseRequired(/^          REQUIRED_CHECKS: '?(.*?)'?$/m.exec(workflow)[1]);
  assert.match(workflow, /MAIN_MONITOR_WEBHOOK: \$\{\{ secrets\.MAIN_MONITOR_WEBHOOK \}\}/);
  assert.match(workflow, /^        run: node scripts\/main-commit-monitor\.mjs$/m);
});
