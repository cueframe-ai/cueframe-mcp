#!/usr/bin/env node
// Main commit monitor. GitHub's free plan cannot enforce required checks on private repositories, so
// every push to main is checked after the fact. Every commit the push adds must arrive through a pull
// request merged into main in that push, and that pull request's required checks must have passed on
// its head. Each commit that fails goes, with its pull request (if any) and the failing or missing
// checks, to the company tracker's webhook, which opens one revert issue in the engineering queue.
// The idempotency key is the repository and commit, so a re-run of this job never opens a second issue.
//
// REQUIRED_CHECKS lists the gates a merge reads, comma separated, each naming its evidence type and
// the workflow that must produce it, for example
//   check:ci-status@.github/workflows/ci.yml,status:public-text@.github/workflows/public-text.yml
// A same-name check or status from any other producer never counts. Left empty, every check and
// status reported on the head is required.
// The same file lives in cueframe, cueframe-private, cueframe-mcp and cueframe-ops; keep them equal.
//
// Usage: node main-commit-monitor.mjs [--dry-run] [--repo <owner/name>] [--before <sha>] [--sha <sha>]
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_EVENT_PATH, REQUIRED_CHECKS, MAIN_MONITOR_WEBHOOK.

import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PASSING = new Set(['success', 'neutral', 'skipped']);
const SELF = 'main-commit-monitor';
const ACTIONS_APP = 'github-actions';
const ACTIONS_BOT = 'github-actions[bot]';
const NO_COMMIT = /^0+$/;

export function parseRequired(text) {
  return (text ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((entry) => {
    const match = /^(check|status):([^@]+)@(\.github\/workflows\/[\w.-]+\.ya?ml)$/.exec(entry);
    if (!match) throw new Error(`REQUIRED_CHECKS entry "${entry}" is not check:<name>@<workflow> or status:<context>@<workflow>`);
    return { type: match[1], name: match[2], workflow: match[3] };
  });
}

// Evidence per name: a passing run on the exact head proves it, even when a later re-run of the same
// head was cancelled (a new head voids evidence; the same head keeps it). Otherwise the latest entry
// (ids grow) says what is wrong.
const pick = (items, passed) =>
  items.reduce((seen, item) => (!seen || (passed(item) && !passed(seen)) || (passed(item) === passed(seen) && item.id > seen.id) ? item : seen), null);
const group = (items, key) => {
  const groups = new Map();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
};
const completed = (run, accepted) => run.status === 'completed' && accepted.has(run.conclusion);
const describeRun = (run) => (run.status === 'completed' ? run.conclusion : run.status);
const runIdOf = (status) => /\/actions\/runs\/(\d+)/.exec(status.target_url ?? '')?.[1];

// The problems with one merged pull request's head; none means its required checks passed.
// workflowRuns are the Actions runs on the head: they tie a check run (by check suite) and a status
// (by the run its target_url names) to the workflow file that produced it.
export function gateProblems({ checkRuns, statuses, workflowRuns, required }) {
  const bySuite = new Map(workflowRuns.map((run) => [run.check_suite_id, run]));
  const byId = new Map(workflowRuns.map((run) => [String(run.id), run]));
  const problems = [];
  if (!required.length) {
    const runs = [...group(checkRuns.filter((run) => run.name !== SELF), (run) => run.name).values()].map((same) => pick(same, (run) => completed(run, PASSING)));
    const contexts = [...group(statuses, (status) => status.context).values()].map((same) => pick(same, (status) => status.state === 'success'));
    if (!runs.length && !contexts.length) problems.push('no checks reported on the head');
    for (const run of runs) if (!completed(run, PASSING)) problems.push(`check ${run.name} is ${describeRun(run)} on the head (${run.html_url})`);
    for (const status of contexts) if (status.state !== 'success') problems.push(`status ${status.context} is ${status.state} on the head`);
    return problems;
  }
  for (const gate of required) {
    if (gate.type === 'check') {
      const named = checkRuns.filter((run) => run.name === gate.name);
      const trusted = named.filter((run) => run.app?.slug === ACTIONS_APP && bySuite.get(run.check_suite?.id)?.path === gate.workflow);
      const run = pick(trusted, (r) => completed(r, new Set(['success'])));
      if (!run) problems.push(`required check ${gate.name} from ${gate.workflow} never reported on the head${named.length ? ' (a same-name check from another producer does not count)' : ''}`);
      else if (!completed(run, new Set(['success']))) problems.push(`required check ${gate.name} is ${describeRun(run)} on the head (${run.html_url})`);
    } else {
      const named = statuses.filter((status) => status.context === gate.name);
      const trusted = named.filter((status) => status.creator?.login === ACTIONS_BOT && byId.get(runIdOf(status))?.path === gate.workflow);
      const status = pick(trusted, (s) => s.state === 'success');
      if (!status) problems.push(`required status ${gate.name} from ${gate.workflow} never reported on the head${named.length ? ' (a same-name status from another producer does not count)' : ''}`);
      else if (status.state !== 'success') problems.push(`required status ${gate.name} is ${status.state} on the head (${status.target_url})`);
    }
  }
  return problems;
}

// Sorts the commits a push added. A commit that is the merge commit of a pull request merged into the
// branch is judged by that pull request's checks; a commit that pull request brought with it (its
// branch commits, or the rebased copies) is covered by it. Anything else came in without a pull request.
export function attribute({ commits, pullsByCommit, branch }) {
  const added = new Set(commits);
  const mergedHere = (sha) =>
    (pullsByCommit.get(sha) ?? []).filter((p) => p.merged_at && p.base?.ref === branch && added.has(p.merge_commit_sha));
  const merges = new Map();
  const orphans = [];
  for (const sha of commits) {
    const prs = mergedHere(sha);
    const own = prs.find((p) => p.merge_commit_sha === sha);
    if (own) merges.set(sha, own);
    else if (!prs.length) {
      const seen = (pullsByCommit.get(sha) ?? []).map((p) => `#${p.number} (${p.merged_at ? 'merged as another commit' : p.state})`);
      orphans.push({ sha, problem: `${sha} did not arrive through a pull request merged into ${branch} in this push${seen.length ? `; associated pull requests: ${seen.join(', ')}` : ''}` });
    }
  }
  return { merges, orphans };
}

// The issue body: the tracker appends this payload to the revert issue's description.
export function report({ repo, sha, server, runUrl, commit, pr, problems }) {
  return {
    event: 'main_commit.unverified',
    repository: repo,
    commit: sha,
    commit_url: `${server}/${repo}/commit/${sha}`,
    commit_title: (commit?.message ?? '').split('\n')[0],
    commit_author: commit?.author?.name ?? null,
    pull_request: pr ? { number: pr.number, url: pr.html_url, head: pr.head.sha, merged_by: pr.merged_by?.login ?? null } : null,
    problems,
    monitor_run: runUrl,
    action: `Revert ${sha} on ${repo} main through a pull request, unless a later commit already reverted it.`,
  };
}

export async function deliver({ webhook, repo, sha, payload, post = fetch }) {
  const response = await post(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': `${SELF}:${repo}:${sha}` },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body = {};
  try {
    body = JSON.parse(text);
  } catch {}
  // accepted: the issue is being created; duplicate: an earlier run of this job already created it.
  if (!response.ok || !['accepted', 'duplicate'].includes(body.status)) {
    throw new Error(`Tracker webhook answered ${response.status} ${body.status ?? ''} ${body.reason ?? ''}`.trim());
  }
  return body.status;
}

// Reads GitHub and returns one finding per unverified commit: { sha, commit, pr, problems }.
export async function inspect({ get, repo, before, after, required }) {
  const pages = async (path, key) => {
    const items = [];
    for (let page = 1; ; page += 1) {
      const body = await get(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      const batch = key ? body[key] : body;
      items.push(...batch);
      if (batch.length < 100) return items;
    }
  };
  const { default_branch: branch } = await get(`/repos/${repo}`);
  const findings = [];
  let added;
  if (!before || NO_COMMIT.test(before)) {
    added = [await get(`/repos/${repo}/commits/${after}`)];
  } else {
    added = [];
    for (let page = 1; ; page += 1) {
      const range = await get(`/repos/${repo}/compare/${before}...${after}?per_page=100&page=${page}`);
      if (page === 1 && range.status !== 'ahead' && range.status !== 'identical') {
        findings.push({ sha: after, commit: null, pr: null, problems: [`main was ${range.status === 'behind' ? 'moved back' : 'force-pushed'} from ${before} to ${after}`] });
      }
      added.push(...range.commits);
      if (range.commits.length < 100 || added.length >= range.total_commits) break;
    }
  }
  const commits = added.map((c) => c.sha);
  const info = new Map(added.map((c) => [c.sha, c.commit]));
  const pullsByCommit = new Map();
  for (const sha of commits) pullsByCommit.set(sha, await get(`/repos/${repo}/commits/${sha}/pulls`));
  const { merges, orphans } = attribute({ commits, pullsByCommit, branch });
  for (const { sha, problem } of orphans) findings.push({ sha, commit: info.get(sha), pr: null, problems: [problem] });
  for (const [sha, pr] of merges) {
    const head = pr.head.sha;
    const problems = gateProblems({
      checkRuns: await pages(`/repos/${repo}/commits/${head}/check-runs?filter=all`, 'check_runs'),
      statuses: await pages(`/repos/${repo}/commits/${head}/statuses`),
      workflowRuns: await pages(`/repos/${repo}/actions/runs?head_sha=${head}`, 'workflow_runs'),
      required,
    });
    if (problems.length) findings.push({ sha, commit: info.get(sha), pr, problems });
  }
  return { branch, commits, merges, findings };
}

async function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
  const dryRun = argv.includes('--dry-run');
  const repo = arg('--repo') ?? process.env.GITHUB_REPOSITORY;
  const after = arg('--sha') ?? event.after ?? process.env.GITHUB_SHA;
  const before = arg('--before') ?? event.before;
  const token = process.env.GITHUB_TOKEN;
  const api = process.env.GITHUB_API_URL ?? 'https://api.github.com';
  const server = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
  const required = parseRequired(process.env.REQUIRED_CHECKS);
  if (!repo || !after || !token) throw new Error('GITHUB_REPOSITORY, GITHUB_SHA and GITHUB_TOKEN are required');
  const runUrl = process.env.GITHUB_RUN_ID ? `${server}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;
  const get = async (path) => {
    const response = await fetch(`${api}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    });
    if (!response.ok) throw new Error(`GET ${path}: ${response.status} ${await response.text()}`);
    return response.json();
  };

  const { commits, merges, findings } = await inspect({ get, repo, before, after, required });
  const gates = required.map((g) => `${g.type}:${g.name}@${g.workflow}`).join(', ') || 'every check';
  const prs = [...merges.values()].map((p) => `#${p.number}`).join(', ') || 'none';
  console.log(`${repo} ${before ?? '(none)'}..${after}: ${commits.length} commit(s), merged pull requests ${prs}; required: ${gates}.`);
  if (!findings.length) {
    console.log('Every added commit is verified.');
    return 0;
  }
  const webhook = process.env.MAIN_MONITOR_WEBHOOK;
  if (!dryRun && !webhook) throw new Error(`MAIN_MONITOR_WEBHOOK is not set, so no revert issue was opened for ${findings.map((f) => f.sha).join(', ')}`);
  for (const { sha, commit, pr, problems } of findings) {
    const payload = report({ repo, sha, server, runUrl, commit, pr, problems });
    console.log(`${sha}: unverified (${pr ? `PR #${pr.number} head ${pr.head.sha}` : 'no merged pull request'}).\n- ${problems.join('\n- ')}`);
    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      continue;
    }
    const status = await deliver({ webhook, repo, sha, payload });
    console.log(`::warning title=Unverified commit on main::${sha} needs a revert; the tracker ${status} the revert issue.`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Unverified commit \`${sha}\`; the tracker ${status} the revert issue.\n\n- ${problems.join('\n- ')}\n\n`);
    }
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`::error title=Main commit monitor::${error.message}`);
      process.exit(1);
    },
  );
}
