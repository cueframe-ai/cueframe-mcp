#!/usr/bin/env node
// Tags the released commit once per published package, with the tag names `changeset publish` would create
// (`<name>@<version>`, for example `@cueframe/sdk@0.17.2`). The publish job runs `changeset publish
// --no-git-tag` because it cannot write to the repository; this runs in a later job with a GitHub App token.
//
// Usage: GH_TOKEN=... GITHUB_REPOSITORY=owner/repo GITHUB_SHA=<sha> node scripts/tag-release.mjs name@version...
// A tag that already points at the commit is accepted (a re-run is safe); one that points elsewhere fails.
import { fileURLToPath } from 'node:url';

const API = 'https://api.github.com';

function splitSpec(spec) {
  const at = spec.lastIndexOf('@');
  if (at <= 0 || !/^\d+\.\d+\.\d+$/.test(spec.slice(at + 1))) throw new Error(`${spec}: expected name@version`);
  return spec;
}

export async function tagRelease(specs, { repository, sha, token, fetch: fetchImpl = globalThis.fetch, logger = console }) {
  if (!token) throw new Error('no GitHub token: the tag job needs the release App token');
  if (!/^[0-9a-f]{40}$/.test(sha ?? '')) throw new Error(`not a commit sha: ${sha}`);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw new Error(`not a repository: ${repository}`);
  const tags = specs.map(splitSpec);
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': '2022-11-28',
  };
  for (const tag of tags) {
    const ref = `refs/tags/${tag}`;
    const created = await fetchImpl(`${API}/repos/${repository}/git/refs`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ ref, sha }),
    });
    if (created.ok) {
      logger.log(`tagged ${tag} at ${sha}`);
      continue;
    }
    const body = await created.json().catch(() => ({}));
    if (created.status !== 422) throw new Error(`${tag}: HTTP ${created.status} ${body.message ?? ''}`.trim());
    const existing = await fetchImpl(`${API}/repos/${repository}/git/ref/${encodeURIComponent(`tags/${tag}`)}`, { headers });
    if (!existing.ok) throw new Error(`${tag}: HTTP 422 ${body.message ?? ''}, and the existing tag cannot be read (HTTP ${existing.status})`);
    const found = (await existing.json()).object?.sha;
    if (found !== sha) throw new Error(`${tag} already points at ${found}, not ${sha}`);
    logger.log(`${tag} already at ${sha}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const specs = process.argv.slice(2).flatMap((a) => a.split(/\s+/)).filter(Boolean);
  if (specs.length === 0) throw new Error('nothing to tag');
  await tagRelease(specs, { repository: process.env.GITHUB_REPOSITORY, sha: process.env.GITHUB_SHA, token: process.env.GH_TOKEN });
}
