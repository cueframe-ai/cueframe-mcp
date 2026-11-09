#!/usr/bin/env node
// Changesets: every pull request that changes a published package
// adds a changeset (`.changeset/*.md`) naming its bump; the Version packages pull request applies it. This
// check fails a branch that
//   - changes a file that reaches a package's tarball without a changeset naming that package;
//   - edits a published package's `version` by hand (only `changeset version`, on the Version packages branch, does that);
//   - adds a changeset that cannot be parsed or names an unknown package or bump; or
//   - enters Changesets prerelease mode (`.changeset/pre.json`): no prereleases, ever; or
//   - writes a skip-ci marker in a changeset summary (it reaches the Version packages pull request's body
//     and so, through a squash or a "title and description" merge, the merge commit that must publish).
//
// The Changesets "Version packages" pull request is the one branch
// that changes `version`: an edit is accepted when it equals what the base's pending changesets plan, and
// only when every planned package is released. That branch needs no changeset of its own.
//
// "Reaches a package's tarball": anything under the package's directory, plus the inputs another package
// bundles at build time. The CLI bundles the SDK (tsup noExternal) and copies the skills, so an SDK or
// skills change ships a new CLI too. The root skills/ tree is @cueframe/skills's content, and api/ is
// @cueframe/api-contract's. Excluded, because they never ship: test files (*.test.*), vitest configs and
// each package's CHANGELOG.md (written by the Version packages pull request itself).
//
// Baseline: `--base <rev>` / CHANGESET_BASE (CI passes the pull request's base sha, or the push's `before`),
// else the merge-base with origin/main. Everything in base...HEAD counts, so each commit of a PR is covered.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Published package → the path prefixes whose files reach its tarball. */
export const PACKAGES = {
  '@cueframe/api-contract': ['packages/api-contract/', 'api/'],
  '@cueframe/sdk': ['packages/sdk/'],
  '@cueframe/skills': ['packages/skills/', 'skills/'],
  cueframe: ['packages/cli/', 'packages/sdk/', 'packages/skills/', 'skills/'],
};
export const PACKAGE_JSONS = ['packages/api-contract/package.json', 'packages/sdk/package.json', 'packages/skills/package.json', 'packages/cli/package.json'];
const BUMPS = new Set(['patch', 'minor', 'major']);
// GitHub skips push and pull_request workflows for a head commit whose message has any of these.
export const SKIP_MARKER = /\[(skip ci|ci skip|no ci|skip actions|actions skip)\]/i;

/** False for files that never reach a tarball: tests, vitest configs and the release-written CHANGELOG. */
export function shipsFile(path) {
  if (/\.test\.[cm]?[jt]sx?$/.test(path)) return false;
  if (/(^|\/)vitest\.config\.[cm]?[jt]s$/.test(path)) return false;
  if (/^packages\/[^/]+\/CHANGELOG\.md$/.test(path)) return false;
  return true;
}

/** The published packages whose tarballs the changed files reach, sorted. */
export function affectedPackages(changedFiles) {
  const hit = new Set();
  for (const file of changedFiles.filter(shipsFile)) {
    for (const [name, prefixes] of Object.entries(PACKAGES)) if (prefixes.some((p) => file.startsWith(p))) hit.add(name);
  }
  return [...hit].sort();
}

/** Parse a changeset file: `{ releases: {name: bump}, summary, problems }`. */
export function parseChangeset(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n?---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { releases: {}, summary: '', problems: ['has no `---` frontmatter naming packages and bumps'] };
  const releases = {};
  const problems = [];
  for (const line of m[1].split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const entry = /^["']?([^"':]+)["']?\s*:\s*["']?([a-z]+)["']?$/.exec(line);
    if (!entry) { problems.push(`cannot read frontmatter line \`${line}\``); continue; }
    if (!BUMPS.has(entry[2])) { problems.push(`${entry[1]}: bump \`${entry[2]}\` is not patch, minor or major`); continue; }
    releases[entry[1]] = entry[2];
  }
  const summary = m[2].trim();
  if (!summary) problems.push('has no summary (the text after the frontmatter becomes the CHANGELOG entry)');
  const marker = SKIP_MARKER.exec(text);
  if (marker) problems.push(`contains the skip marker \`${marker[0]}\`: it would reach the Version packages pull request and skip its release; describe it in words`);
  return { releases, summary, problems };
}

/**
 * Problems for one branch, from the changed paths, the changesets it adds, its `version` edits and
 * `planned` (package → version the base's pending changesets plan; only needed when versions changed).
 */
export function changesetProblems({ changedFiles, changesets, versionEdits, planned = new Map() }) {
  const problems = [];
  if (changedFiles.includes('.changeset/pre.json')) problems.push('.changeset/pre.json: Changesets prerelease mode is not allowed (normal versions only)');
  const released = new Set();
  for (const edit of versionEdits) {
    if (edit.name && planned.get(edit.name) === edit.to) released.add(edit.name);
    else problems.push(`${edit.file}: version ${edit.from} -> ${edit.to} edited by hand; add a changeset instead (the Version packages pull request bumps it)`);
  }
  if (released.size > 0) {
    for (const [name, version] of planned) {
      if (!released.has(name)) problems.push(`${name}: the pending changesets plan ${version}, but this release branch does not apply it; regenerate it with \`changeset version\``);
    }
  }
  const named = new Set(released);
  for (const changeset of changesets) {
    for (const problem of changeset.problems) problems.push(`${changeset.file}: ${problem}`);
    for (const name of Object.keys(changeset.releases)) {
      if (!(name in PACKAGES)) problems.push(`${changeset.file}: ${name} is not a published package of this repository`);
      named.add(name);
    }
  }
  for (const name of affectedPackages(changedFiles)) {
    if (!named.has(name)) problems.push(`${name} has no changeset: files that ship in it changed. Run \`pnpm changeset\` and name ${name} with its bump`);
  }
  return problems;
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

function resolveBase(root, requested) {
  const verify = (rev) => { try { return git(root, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]).trim(); } catch { return null; } };
  if (requested && !/^0+$/.test(requested)) {
    const sha = verify(requested);
    if (sha) return sha;
    console.warn(`warning: base ${requested} is not a reachable commit; using the merge-base with origin/main`);
  }
  const originMain = verify('origin/main');
  if (!originMain) throw new Error('no base: pass --base <rev> or fetch origin/main');
  return git(root, ['merge-base', 'HEAD', originMain]).trim();
}

/** Run the check for the branch at `root` against `base`. */
export async function checkChangesets(root, { base = process.env.CHANGESET_BASE } = {}) {
  const baseSha = resolveBase(root, base);
  const changedFiles = git(root, ['diff', '--name-only', '--no-renames', `${baseSha}...HEAD`]).split('\n').filter(Boolean);
  const changesets = changedFiles
    .filter((f) => /^\.changeset\/[^/]+\.md$/.test(f) && f !== '.changeset/README.md' && existsSync(resolve(root, f)))
    .map((file) => ({ file, ...parseChangeset(readFileSync(resolve(root, file), 'utf8')) }));
  const versionEdits = [];
  for (const file of PACKAGE_JSONS.filter((f) => changedFiles.includes(f))) {
    let from = null;
    try { from = JSON.parse(git(root, ['show', `${baseSha}:${file}`])).version; } catch { /* new package */ }
    const current = existsSync(resolve(root, file)) ? JSON.parse(readFileSync(resolve(root, file), 'utf8')) : null;
    const to = current?.version ?? null;
    if (from !== null && to !== null && from !== to) versionEdits.push({ file, name: current.name, from, to });
  }
  const planned = versionEdits.length ? await plannedAt(root, baseSha) : new Map();
  return { base: baseSha, changedFiles, changesets, problems: changesetProblems({ changedFiles, changesets, versionEdits, planned }) };
}

/**
 * The versions planned by the changesets pending at `rev` that this branch consumes (deletes), read from a
 * temporary worktree of `rev`. A changeset still present at HEAD is not part of this release: a Version
 * packages pull request merged after main gained another changeset leaves that one pending for the next.
 */
async function plannedAt(root, rev) {
  if (!existsSync(resolve(root, '.changeset/config.json'))) return new Map();
  const dir = mkdtempSync(join(tmpdir(), 'cf-plan-'));
  try {
    git(root, ['worktree', 'add', '--quiet', '--detach', dir, rev]);
    if (!existsSync(join(dir, '.changeset/config.json'))) return new Map();
    for (const name of readdirSync(join(dir, '.changeset'))) {
      if (name.endsWith('.md') && name !== 'README.md' && existsSync(resolve(root, '.changeset', name))) rmSync(join(dir, '.changeset', name));
    }
    const { plannedVersions } = await import('./release-plan.mjs');
    return await plannedVersions(dir);
  } finally {
    try { git(root, ['worktree', 'remove', '--force', dir]); } catch { rmSync(dir, { recursive: true, force: true }); }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--base');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { base, changedFiles, changesets, problems } = await checkChangesets(root, i === -1 ? {} : { base: process.argv[i + 1] });
  if (problems.length) {
    console.error(problems.map((p) => `FAIL ${p}`).join('\n'));
    process.exitCode = 1;
  } else {
    const affected = affectedPackages(changedFiles);
    console.log(`ok   ${changedFiles.length} files changed since ${base.slice(0, 9)}; ${affected.length ? `${affected.join(', ')} covered by ${changesets.length} changeset(s)` : 'no published package affected'}`);
  }
}
