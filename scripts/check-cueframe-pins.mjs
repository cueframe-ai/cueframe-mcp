#!/usr/bin/env node
// Consumers pin published normal versions only. This check fails the tree when
//   - any tracked package.json declares a prerelease `version` (`-ea…`, `-rc`, `-dev`, …);
//   - any @cueframe/* (or `cueframe`) dependency, pnpm override or catalog entry has a prerelease, a
//     `file:`/`link:`/tarball/git/URL source or a dist-tag instead of a version; or
//   - such a pin names a version npm does not have (`npm view <pkg>@<spec> version`).
// `workspace:` ranges point at a package in this workspace and are left to pnpm; `catalog:` ranges are
// checked through the catalog entries they read. The registry lookup uses whatever npm credentials the
// environment has (restricted packages need a read token); a lookup that cannot read the registry fails.
// The same file runs in cueframe, cueframe-private and cueframe-mcp; keep the copies identical.
import { execFile, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
export const isCueframe = (name) => name === 'cueframe' || name.startsWith('@cueframe/');
const PRERELEASE = /\d+\.\d+\.\d+-[0-9A-Za-z]/;
const LOCAL_OR_REMOTE = /^(file:|link:|portal:|git\+|git:|github:|gitlab:|bitbucket:|https?:|\.{0,2}\/)|\.tgz$|\.tar(\.gz)?$|^[\w.-]+\/[\w.-]+(#.*)?$/;

/** Why `spec` is not an acceptable registry pin, or null when it is. */
export function specProblem(spec) {
  const s = String(spec).trim();
  if (LOCAL_OR_REMOTE.test(s)) return `${s} is not a registry version (local, tarball, git or URL source)`;
  if (PRERELEASE.test(s)) return `${s} is a prerelease`;
  if (/^[A-Za-z][\w.-]*$/.test(s)) return `${s} is a dist-tag, not a version`;
  if (!/\d/.test(s)) return `${s} is not a pin`;
  return null;
}

/** Split `npm:@cueframe/x@1.2.3` into the aliased name and spec; null for anything else. */
function alias(spec) {
  const m = /^npm:((?:@[^/@]+\/)?[^@]+)@(.+)$/.exec(spec);
  return m ? { name: m[1], spec: m[2] } : null;
}

function addEntries(out, where, entries) {
  for (const [key, raw] of Object.entries(entries ?? {})) {
    if (typeof raw !== 'string') continue;
    // An override key may carry a selector (`a>@cueframe/kernel`, `@cueframe/kernel@1`); the target is the last name.
    const target = key.split('>').pop().replace(/(.)@[^/]*$/, '$1');
    const aliased = alias(raw);
    const name = aliased && isCueframe(aliased.name) ? aliased.name : target;
    const spec = aliased && isCueframe(aliased.name) ? aliased.spec : raw;
    if (!isCueframe(name)) continue;
    if (spec.startsWith('workspace:') || spec.startsWith('catalog:')) continue;
    out.push({ where, name, spec });
  }
}

/** Every @cueframe pin and every package version in the given parsed manifests and workspace files. */
export function collectPins({ packageJsons, workspaces = [] }) {
  const out = [];
  for (const { path, json } of packageJsons) {
    if (typeof json.version === 'string' && json.name) out.push({ where: `${path} version`, name: json.name, spec: json.version, kind: 'version' });
    for (const field of DEP_FIELDS) addEntries(out, `${path} ${field}`, json[field]);
    addEntries(out, `${path} pnpm.overrides`, json.pnpm?.overrides);
    addEntries(out, `${path} overrides`, json.overrides);
    addEntries(out, `${path} resolutions`, json.resolutions);
  }
  for (const { path, yaml } of workspaces) {
    addEntries(out, `${path} catalog`, yaml?.catalog);
    for (const [name, entries] of Object.entries(yaml?.catalogs ?? {})) addEntries(out, `${path} catalogs.${name}`, entries);
    addEntries(out, `${path} overrides`, yaml?.overrides);
  }
  return out;
}

const execFileAsync = promisify(execFile);
/** Versions npm has for `name` matching `spec`; [] when none. Throws when the registry cannot be read. */
export async function npmVersions(name, spec) {
  try {
    const { stdout } = await execFileAsync('npm', ['view', `${name}@${spec}`, 'version', '--json'], { timeout: 60_000 });
    if (!stdout.trim()) return [];
    return [].concat(JSON.parse(stdout));
  } catch (error) {
    const text = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    if (/E404|No match found|is not in this registry/.test(text)) return [];
    throw new Error(/E40[13]/.test(text) ? `${text.match(/E40[13][^\n]*/)[0]}` : text.trim().split('\n')[0] || error.message);
  }
}

/** Problems with the collected pins; `resolve(name, spec)` returns the matching published versions. */
export async function pinProblems(pins, { resolve = npmVersions } = {}) {
  const problems = [];
  const lookups = [];
  for (const pin of pins) {
    if (pin.kind === 'version') {
      // Only the prerelease rule applies: a package's own version is published by the merge, not before it.
      if (PRERELEASE.test(pin.spec)) problems.push(`${pin.where.replace(/ version$/, '')}: ${pin.name} version ${pin.spec} is a prerelease`);
      continue;
    }
    const problem = specProblem(pin.spec);
    if (problem) { problems.push(`${pin.where}: ${pin.name} ${problem}`); continue; }
    lookups.push(pin);
  }
  const results = await Promise.all(lookups.map(async (pin) => {
    try {
      const versions = await resolve(pin.name, pin.spec);
      return versions.length ? null : `${pin.where}: ${pin.name}@${pin.spec} is not on npm`;
    } catch (error) {
      return `${pin.where}: ${pin.name}@${pin.spec}: cannot read the registry (${error.message})`;
    }
  }));
  return [...problems, ...results.filter(Boolean)];
}

async function main(root) {
  const { parse } = await import('yaml');
  const tracked = execFileSync('git', ['ls-files', '-z', '--', '*package.json', 'pnpm-workspace.yaml'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const packageJsons = tracked.filter((p) => p.endsWith('package.json') && !p.includes('node_modules/')).map((path) => ({ path, json: JSON.parse(readFileSync(resolve(root, path), 'utf8')) }));
  const workspaces = tracked.filter((p) => p.endsWith('pnpm-workspace.yaml')).map((path) => ({ path, yaml: parse(readFileSync(resolve(root, path), 'utf8')) }));
  const pins = collectPins({ packageJsons, workspaces });
  const problems = await pinProblems(pins);
  if (problems.length) {
    console.error(problems.map((p) => `FAIL ${p}`).join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`ok   ${pins.filter((p) => p.kind !== 'version').length} @cueframe pins are published normal versions; no package declares a prerelease`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
}
