#!/usr/bin/env node
// Checks anonymous npm access to the current version of every published package: its version metadata
// and its tarball. No npm configuration, user token, or authenticated registry client is consulted.
//
// It checks once and does not wait. The publish job does not run it: `npm publish` exiting 0 means the
// registry accepted the version, and npm may take a few minutes to serve a new version, so checking right
// after a publish races npm. Run it later instead, for example against the previous day's versions, or
// before a consumer installs a new version from the registry.
//
// `--unpublished` instead prints the versions npm does not have yet (the release plan of publish-npm.yml).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REGISTRY = 'https://registry.npmjs.org';

/** One anonymous check. Resolves `null` when served, else `{url, reason}`. */
async function checkOne({ name, version }, fetchImpl) {
  let url = `${REGISTRY}/${encodeURIComponent(name)}/${version}`;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return { url, reason: `anonymous metadata HTTP ${response.status}` };
    const metadata = await response.json();
    if (metadata.name !== name || metadata.version !== version) return { url, reason: 'metadata identity differs' };
    let tarball;
    try {
      tarball = new URL(metadata.dist?.tarball);
    } catch {
      return { url, reason: 'metadata has no tarball URL' };
    }
    if (tarball.origin !== REGISTRY) return { url, reason: `unexpected tarball origin ${tarball.origin}` };
    url = tarball.href;
    const head = await fetchImpl(url, { method: 'HEAD', signal: AbortSignal.timeout(30_000) });
    if (!head.ok) return { url, reason: `anonymous tarball HTTP ${head.status}` };
    return null;
  } catch (error) {
    return { url, reason: error.message };
  }
}

/**
 * Checks every package once. Returns `{missing: [{name, version, url, reason}]}`; empty means all are
 * served anonymously.
 */
export async function checkPackages(packages, { fetch: fetchImpl = globalThis.fetch, logger = console } = {}) {
  const missing = [];
  for (const pkg of packages) {
    const problem = await checkOne(pkg, fetchImpl);
    if (problem) {
      missing.push({ ...pkg, ...problem });
      logger.error(`FAIL ${pkg.name}@${pkg.version}: ${problem.reason} at ${problem.url}`);
    } else {
      logger.log(`ok ${pkg.name}@${pkg.version}: anonymous metadata and tarball accessible`);
    }
  }
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
  const { missing } = await checkPackages(publishedPackages());
  process.exitCode = missing.length ? 1 : 0;
}
