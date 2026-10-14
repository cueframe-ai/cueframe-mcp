#!/usr/bin/env node
// The version of @cueframe/api-contract must move with the contract it publishes.
//
// Every consumer of the contract (the application repository's MCP generators, packages/plane, third
// parties) reads it from the npm package, and an npm version is immutable; so a change to any of the five
// api/*.json files the package ships that is not accompanied by a bump of packages/api-contract/package.json
// would publish as "the same 1.x.y" with different bytes behind it — or, with the publish guard, not publish
// at all and leave consumers on a stale contract with no signal. This check fails that tree.
//
// Baseline rule (what the working tree is compared against), in order:
//   1. `--base <rev>` / CONTRACT_BASELINE, when it resolves to a commit. CI passes the pull request's base
//      sha or the push's `before` sha, so every commit of a PR or a multi-commit push is covered. An
//      all-zero or unknown revision (a force-push's lost `before`) falls through with a warning.
//   2. Off `main` (a branch or a detached HEAD) with `origin/main` known: the merge-base with origin/main.
//      A branch bumps the version once, however many commits touch api/.
//   3. On `main` (or with no origin/main): the previous commit, HEAD~1 — unless the watched files have
//      uncommitted changes, in which case HEAD, because main lands one commit at a time and the change under
//      test is the one not yet committed. A root commit with no parent passes vacuously.
//
// "Changed" means any byte of api/*.json differs between the baseline and the working tree; the manifest's
// sha256s are a subset of that (public-surface.json is not in the manifest), and the
// package ships bytes, not digests.
//
// Also enforced here, so `pnpm check` catches it before the build does: when the sync manifest carries a
// `contractVersion` (the private sync stamps the version of the checkout it ran against), it must equal the
// package version.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONTRACT_FILES = [
  'openapi.json',
  'public-surface.json',
  'scene-schema.json',
  'scene-examples.json',
  'contract-manifest.json',
];
export const PACKAGE_JSON = 'packages/api-contract/package.json';
const WATCHED = [...CONTRACT_FILES.map((name) => `api/${name}`), PACKAGE_JSON];

function git(root, args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (allowFailure) return null;
    throw new Error(`git ${args.join(' ')} failed: ${error.stderr?.trim() || error.message}`);
  }
}

const revParse = (root, rev) => git(root, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`], { allowFailure: true })?.trim() ?? null;

/** Pick the baseline revision per the rule above. Returns `{ rev, reason, warnings }`; `rev` null means "no baseline". */
export function selectBaseline(root, requested) {
  const warnings = [];
  if (requested) {
    // 40 zeros is the SHA-1 "no previous commit" sentinel of a push event; 64 the SHA-256 one.
    const sha = /^0{40}(0{24})?$/.test(requested) ? null : revParse(root, requested);
    if (sha) return { rev: sha, reason: `requested ${requested}`, warnings };
    warnings.push(`requested baseline ${requested} is not a reachable commit; falling back to the branch rule`);
  }
  const branch = git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true })?.trim() ?? null;
  const originMain = revParse(root, 'origin/main');
  if (branch !== 'main' && originMain) {
    const mergeBase = git(root, ['merge-base', 'HEAD', originMain], { allowFailure: true })?.trim();
    if (mergeBase) return { rev: mergeBase, reason: `merge-base of HEAD and origin/main (${branch ?? 'detached HEAD'})`, warnings };
  }
  const dirty = git(root, ['status', '--porcelain', '--', ...WATCHED]).trim() !== '';
  if (dirty) return { rev: 'HEAD', reason: 'HEAD (uncommitted changes to api/ or the package)', warnings };
  const parent = revParse(root, 'HEAD~1');
  if (parent) {
    const why = branch === 'main'
      ? 'previous commit on main'
      : `no origin/main to compute a merge-base against; ${branch ? `branch ${branch}` : 'detached HEAD'}`;
    return { rev: parent, reason: `HEAD~1 (${why})`, warnings };
  }
  return { rev: null, reason: 'HEAD has no parent; nothing to compare against', warnings };
}

const atRev = (root, rev, path) => git(root, ['show', `${rev}:${path}`], { allowFailure: true });
const inTree = (root, path) => (existsSync(resolve(root, path)) ? readFileSync(resolve(root, path), 'utf8') : null);
const versionOf = (text) => (text === null ? null : JSON.parse(text).version);
// Byte equality through blob ids: openapi.json is 1.7 MB, over execFileSync's default buffer, and hashing
// is what git does anyway. A file absent on either side has no blob and so counts as changed.
const blobAtRev = (root, rev, path) => git(root, ['rev-parse', '--verify', '--quiet', `${rev}:${path}`], { allowFailure: true })?.trim() ?? null;
const blobInTree = (root, path) => (existsSync(resolve(root, path)) ? git(root, ['hash-object', '--', path]).trim() : null);

/**
 * Compare the working tree under `root` against the baseline. Returns `{ ok, problems, warnings, baseline,
 * changed, version }`; `problems` is empty when the tree is acceptable.
 */
export function checkContractVersion(root, { base = process.env.CONTRACT_BASELINE } = {}) {
  const problems = [];
  const baseline = selectBaseline(root, base);
  const currentPackage = inTree(root, PACKAGE_JSON);
  if (currentPackage === null) {
    return { ok: false, problems: [`${PACKAGE_JSON} is missing`], warnings: baseline.warnings, baseline, changed: [], version: null };
  }
  const version = { current: versionOf(currentPackage), baseline: null };

  // The sync's own stamp, when present, must name this package version.
  const syncManifest = inTree(root, 'api/contract-manifest.json');
  const stamped = syncManifest === null ? undefined : JSON.parse(syncManifest).contractVersion;
  if (stamped !== undefined && stamped !== version.current) {
    problems.push(
      `api/contract-manifest.json records contractVersion ${stamped} but ${PACKAGE_JSON} is ${version.current}; ` +
        'bump the package or re-run the private sync against this checkout',
    );
  }

  const changed = [];
  if (baseline.rev) {
    for (const name of CONTRACT_FILES) {
      if (blobAtRev(root, baseline.rev, `api/${name}`) !== blobInTree(root, `api/${name}`)) changed.push(name);
    }
    version.baseline = versionOf(atRev(root, baseline.rev, PACKAGE_JSON));
    if (changed.length > 0 && version.baseline === version.current) {
      problems.push(
        `api/${changed.join(', api/')} changed since ${baseline.reason} but ${PACKAGE_JSON} is still ${version.current}; ` +
          'bump the version (the contract publishes under it) and record the change in CHANGELOG.md',
      );
    }
  }
  return { ok: problems.length === 0, problems, warnings: baseline.warnings, baseline, changed, version };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // `--root <dir>` points the check at another checkout (the tests use a scratch repository); `--base <rev>`
  // overrides the baseline rule (CI passes the event's base sha).
  const flag = (name) => { const i = process.argv.indexOf(name); return i === -1 ? undefined : process.argv[i + 1]; };
  const ROOT = resolve(flag('--root') ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  const base = flag('--base');
  const { ok, problems, warnings, baseline, changed, version } = checkContractVersion(ROOT, base ? { base } : {});
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  if (!ok) { console.error(problems.join('\n')); process.exit(1); }
  const summary = baseline.rev
    ? changed.length
      ? `api/${changed.join(', api/')} changed and the package moved ${version.baseline} -> ${version.current}`
      : `api/ unchanged since ${baseline.reason}`
    : baseline.reason;
  console.log(`contract version ok: @cueframe/api-contract ${version.current}; ${summary}`);
}
