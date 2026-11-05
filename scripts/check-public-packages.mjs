#!/usr/bin/env node
// Proves anonymous npm access to the current version of every published package: its version metadata
// and its tarball. No npm configuration, user token, or authenticated registry client is consulted.
//
// npm says a newly published version "may take a few minutes" to be served, so after a publish this
// polls each package that is not served yet every 15 s, for up to 10 min, and fails only for a package
// still missing then (naming the package, version and URL). The 2026-11-04 publish run 41939613726
// checked 0.03 s after its last publish and failed on 404s for versions that were live minutes later.
// A wrong identity or a tarball outside registry.npmjs.org fails at once: waiting cannot fix it.
// PUBLIC_PACKAGES_TIMEOUT_SECONDS overrides the 10 min (0 checks once).
// `--unpublished` instead prints the versions npm does not have yet (the release plan of publish-npm.yml).
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const REGISTRY = 'https://registry.npmjs.org';
export const INTERVAL_MS = 15_000;
export const TIMEOUT_MS = 10 * 60_000;

class Permanent extends Error {}

/** One anonymous check. Resolves `null` when served, else `{url, reason, permanent}`. */
async function checkOnce({ name, version }, fetchImpl) {
  const metadataUrl = `${REGISTRY}/${encodeURIComponent(name)}/${version}`;
  let url = metadataUrl;
  try {
    const response = await fetchImpl(metadataUrl, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return { url, reason: `anonymous metadata HTTP ${response.status}` };
    const metadata = await response.json();
    if (metadata.name !== name || metadata.version !== version) throw new Permanent('metadata identity differs');
    let tarball;
    try {
      tarball = new URL(metadata.dist?.tarball);
    } catch {
      throw new Permanent('metadata has no tarball URL');
    }
    if (tarball.origin !== REGISTRY) throw new Permanent(`unexpected tarball origin ${tarball.origin}`);
    url = tarball.href;
    const head = await fetchImpl(url, { method: 'HEAD', signal: AbortSignal.timeout(30_000) });
    if (!head.ok) return { url, reason: `anonymous tarball HTTP ${head.status}` };
    return null;
  } catch (error) {
    return { url, reason: error.message, permanent: error instanceof Permanent };
  }
}

/**
 * Waits until npm serves every package's metadata and tarball anonymously, or the timeout passes.
 * Returns `{missing: [{name, version, url, reason}]}`; an empty list means all are served.
 */
export async function waitForPackages(packages, options = {}) {
  const {
    fetch: fetchImpl = globalThis.fetch,
    sleep = (ms) => delay(ms),
    now = () => Date.now(),
    intervalMs = INTERVAL_MS,
    timeoutMs = TIMEOUT_MS,
    logger = console,
  } = options;
  const deadline = now() + timeoutMs;
  let pending = [...packages];
  const failed = [];
  for (;;) {
    const still = [];
    for (const pkg of pending) {
      const problem = await checkOnce(pkg, fetchImpl);
      const label = `${pkg.name}@${pkg.version}`;
      if (!problem) logger.log(`ok ${label}: anonymous metadata and tarball accessible`);
      else if (problem.permanent) failed.push({ ...pkg, url: problem.url, reason: problem.reason });
      else still.push({ ...pkg, url: problem.url, reason: problem.reason });
    }
    pending = still;
    if (pending.length === 0 || now() + intervalMs > deadline) break;
    for (const p of pending) logger.log(`waiting for ${p.name}@${p.version}: ${p.reason} (${p.url})`);
    await sleep(intervalMs);
  }
  const missing = [...failed, ...pending.map(({ name, version, url, reason }) => ({ name, version, url, reason }))];
  for (const m of missing) logger.error(`FAIL ${m.name}@${m.version}: ${m.reason} at ${m.url}`);
  return { missing };
}

/**
 * The packages whose current version npm does not have (metadata 404): what the next publish ships. Any
 * other answer fails, so a registry outage cannot look like "nothing to publish".
 */
export async function unpublishedPackages(packages, { fetch: fetchImpl = globalThis.fetch } = {}) {
  const out = [];
  for (const { name, version } of packages) {
    const response = await fetchImpl(`${REGISTRY}/${encodeURIComponent(name)}/${version}`, { signal: AbortSignal.timeout(30_000) });
    if (response.status === 404) out.push({ name, version });
    else if (!response.ok) throw new Error(`${name}@${version}: registry HTTP ${response.status}`);
  }
  return out;
}

export function publishedPackages() {
  return ['api-contract', 'sdk', 'skills', 'cli'].map((directory) => {
    const pkg = JSON.parse(readFileSync(new URL(`../packages/${directory}/package.json`, import.meta.url)));
    return { name: pkg.name, version: pkg.version };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === '--unpublished') {
  // Prints `name@version` for each package npm does not have yet, space-separated (empty when none).
  const list = await unpublishedPackages(publishedPackages());
  console.log(list.map((p) => `${p.name}@${p.version}`).join(' '));
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const seconds = process.env.PUBLIC_PACKAGES_TIMEOUT_SECONDS;
  const timeoutMs = seconds === undefined || seconds === '' ? TIMEOUT_MS : Number(seconds) * 1000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new Error(`bad PUBLIC_PACKAGES_TIMEOUT_SECONDS ${seconds}`);
  const { missing } = await waitForPackages(publishedPackages(), { timeoutMs });
  process.exitCode = missing.length ? 1 : 0;
}
