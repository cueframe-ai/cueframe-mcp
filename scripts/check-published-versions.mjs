#!/usr/bin/env node
// The publish loop skips a package whose version is already on npm. So a package whose content
// changed without a version bump never ships, and nothing says so. This check packs each publishable
// package exactly as `pnpm publish` would, fetches the published tarball of the same version (when one
// exists) and compares the two file by file. Tar metadata is ignored and only paths and bytes count.
// A difference fails the check: bump the package. Run it after `pnpm build`, since the tarballs ship dist/.
// It needs network access to registry.npmjs.org and uses no npm credentials.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLISHED_PACKAGES = ['packages/api-contract', 'packages/sdk', 'packages/skills', 'packages/cli'];

function files(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const path = join(d, entry);
      if (statSync(path).isDirectory()) walk(path);
      else out.set(relative(dir, path), readFileSync(path));
    }
  };
  walk(dir);
  return out;
}

/** Paths that differ between two extracted package trees (added, removed or changed). */
export function differingFiles(local, published) {
  const names = new Set([...local.keys(), ...published.keys()]);
  return [...names].filter((name) => !local.get(name)?.equals(published.get(name) ?? Buffer.alloc(0)) || !published.has(name)).sort();
}

async function publishedTarball(name, version) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`, { signal: AbortSignal.timeout(30_000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${name}@${version}: registry HTTP ${response.status}`);
  const url = new URL((await response.json()).dist.tarball);
  if (url.origin !== 'https://registry.npmjs.org') throw new Error(`${name}@${version}: unexpected tarball origin ${url.origin}`);
  const tarball = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!tarball.ok) throw new Error(`${name}@${version}: tarball HTTP ${tarball.status}`);
  return Buffer.from(await tarball.arrayBuffer());
}

function extract(tgz, into) {
  mkdirSync(into, { recursive: true });
  execFileSync('tar', ['-xzf', tgz, '-C', into]);
  return files(join(into, 'package'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const scratch = mkdtempSync(join(tmpdir(), 'cf-published-'));
  let failed = false;
  try {
    for (const dir of PUBLISHED_PACKAGES) {
      const { name, version } = JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8'));
      const published = await publishedTarball(name, version);
      if (!published) { console.log(`new  ${name}@${version}: not on npm yet; the publish loop will ship it`); continue; }
      const work = join(scratch, name.replace(/[@/]/g, '_'));
      mkdirSync(work, { recursive: true });
      execFileSync('pnpm', ['pack', '--pack-destination', work], { cwd: join(ROOT, dir), stdio: ['ignore', 'pipe', 'inherit'] });
      const localTgz = readdirSync(work).find((file) => file.endsWith('.tgz'));
      writeFileSync(join(work, 'published.tgz'), published);
      const changed = differingFiles(extract(join(work, localTgz), join(work, 'local')), extract(join(work, 'published.tgz'), join(work, 'published')));
      if (changed.length) {
        failed = true;
        console.error(`FAIL ${name}@${version} is already on npm with different content (${changed.slice(0, 8).join(', ')}${changed.length > 8 ? ', …' : ''}); bump ${dir}/package.json`);
      } else {
        console.log(`ok   ${name}@${version}: matches the published tarball`);
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  process.exitCode = failed ? 1 : 0;
}
