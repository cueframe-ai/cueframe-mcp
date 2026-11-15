#!/usr/bin/env node
// Main commit monitor. GitHub's free plan cannot enforce required checks on private repositories, so
// every push to main is checked after the fact: the pushed commit must be the merge commit of a pull
// request into main whose required checks passed on that pull request's head. When it is not, the
// commit, the pull request (if any) and the failing or missing checks go to the company tracker's
// webhook, which opens one revert issue in the engineering queue. The idempotency key is the
// repository and commit, so a re-run of this job never opens a second issue.
//
// REQUIRED_CHECKS names the checks a merge reads (check run names or commit status contexts, comma
// separated), for example `ci-status`. Left empty, every check reported on the head is required.
// The same file lives in cueframe, cueframe-private, cueframe-mcp and cueframe-ops; keep them equal.
//
// Usage: node main-commit-monitor.mjs [--dry-run] [--sha <sha>] [--repo <owner/name>]
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA, REQUIRED_CHECKS, MAIN_MONITOR_WEBHOOK.

import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PASSING = new Set(['success', 'neutral', 'skipped']);
const SELF = 'main-commit-monitor';

// Evidence per name: a passing run on the exact head proves it, even when a later re-run of the same
// head was cancelled (a new head voids evidence; the same head keeps it). Otherwise the latest run
// (ids grow) says what is wrong.
const byName = (runs, name, passed) => {
  const result = new Map();
  for (const run of runs) {
    const seen = result.get(name(run));
    if (!seen || (passed(run) && !passed(seen)) || (passed(run) === passed(seen) && run.id > seen.id)) result.set(name(run), run);
  }
  return result;
};
const completed = (run, accepted) => run.status === 'completed' && accepted.has(run.conclusion);

const describeRun = (run) => (run.status === 'completed' ? run.conclusion : run.status);

// Pure verdict over what GitHub reports. Returns { pr, problems }; no problems means verified.
export function verdict({ sha, branch, pulls, checkRuns, statuses, required }) {
  const pr = pulls.find((p) => p.merged_at && p.merge_commit_sha === sha && p.base?.ref === branch);
  if (!pr) {
    const open = pulls.map((p) => `#${p.number} (${p.merged_at ? 'merged as another commit' : p.state})`);
    const why = open.length ? `; associated pull requests: ${open.join(', ')}` : '';
    return { pr: null, problems: [`${sha} is not the merge commit of a pull request merged into ${branch}${why}`] };
  }
  const accepted = required.length ? new Set(['success']) : PASSING;
  const runs = byName(checkRuns.filter((run) => run.name !== SELF), (run) => run.name, (run) => completed(run, accepted));
  const contexts = byName(statuses, (status) => status.context, (status) => status.state === 'success');
  const problems = [];
  const checkProblem = (run, label) =>
    completed(run, accepted) ? [] : [`${label} ${run.name} is ${describeRun(run)} on the head (${run.html_url})`];
  const statusProblem = (status, label) => (status.state === 'success' ? [] : [`${label} ${status.context} is ${status.state} on the head`]);
  if (required.length) {
    for (const name of required) {
      if (runs.has(name)) problems.push(...checkProblem(runs.get(name), 'required check'));
      else if (contexts.has(name)) problems.push(...statusProblem(contexts.get(name), 'required status'));
      else problems.push(`required check ${name} never reported on the head`);
    }
  } else {
    if (!runs.size && !contexts.size) problems.push('no checks reported on the head');
    for (const run of runs.values()) problems.push(...checkProblem(run, 'check'));
    for (const status of contexts.values()) problems.push(...statusProblem(status, 'status'));
  }
  return { pr, problems };
}

// The issue body: The tracker appends this payload to the revert issue's description.
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

async function github(api, token, path) {
  const response = await fetch(`${api}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
  });
  if (!response.ok) throw new Error(`GET ${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

async function pages(api, token, path, key) {
  const items = [];
  for (let page = 1; ; page += 1) {
    const body = await github(api, token, `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const batch = key ? body[key] : body;
    items.push(...batch);
    if (batch.length < 100) return items;
  }
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

async function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const dryRun = argv.includes('--dry-run');
  const repo = arg('--repo') ?? process.env.GITHUB_REPOSITORY;
  const sha = arg('--sha') ?? process.env.GITHUB_SHA;
  const token = process.env.GITHUB_TOKEN;
  const api = process.env.GITHUB_API_URL ?? 'https://api.github.com';
  const server = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
  const required = (process.env.REQUIRED_CHECKS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!repo || !sha || !token) throw new Error('GITHUB_REPOSITORY, GITHUB_SHA and GITHUB_TOKEN are required');
  const runUrl = process.env.GITHUB_RUN_ID ? `${server}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;

  const { default_branch: branch } = await github(api, token, `/repos/${repo}`);
  const { commit } = await github(api, token, `/repos/${repo}/commits/${sha}`);
  const pulls = await github(api, token, `/repos/${repo}/commits/${sha}/pulls`);
  const merged = pulls.find((p) => p.merged_at && p.merge_commit_sha === sha && p.base?.ref === branch);
  const head = merged?.head.sha;
  const checkRuns = head ? await pages(api, token, `/repos/${repo}/commits/${head}/check-runs?filter=all`, 'check_runs') : [];
  const statuses = head ? await pages(api, token, `/repos/${repo}/commits/${head}/statuses`) : [];
  const { pr, problems } = verdict({ sha, branch, pulls, checkRuns, statuses, required });

  const where = pr ? `PR #${pr.number} head ${pr.head.sha}` : 'no merged pull request';
  if (!problems.length) {
    console.log(`${repo}@${sha}: verified (${where}; required: ${required.join(', ') || 'every check'}).`);
    return 0;
  }
  const payload = report({ repo, sha, server, runUrl, commit, pr, problems });
  console.log(`${repo}@${sha}: unverified (${where}).\n- ${problems.join('\n- ')}`);
  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }
  const webhook = process.env.MAIN_MONITOR_WEBHOOK;
  if (!webhook) throw new Error('MAIN_MONITOR_WEBHOOK is not set, so no revert issue was opened');
  const status = await deliver({ webhook, repo, sha, payload });
  console.log(`::warning title=Unverified commit on main::${sha} needs a revert; the tracker ${status} the revert issue.`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Unverified commit \`${sha}\` (${where}); the tracker ${status} the revert issue.\n\n- ${problems.join('\n- ')}\n`);
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
