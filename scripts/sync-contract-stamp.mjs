#!/usr/bin/env node
// Restamp api/contract-manifest.json's `contractVersion` with packages/api-contract/package.json's version.
//
// The stamp names the package version of the checkout the private contract sync ran against. A pull request
// never edits `version` (Changesets), so the sync stamps the released version and
// the pull request adds a changeset; `pnpm check:contract-version` and the package build both require the
// stamp to equal package.json. The Version packages pull request runs `changeset version`, which moves package.json
// but not the stamp, then this script (`pnpm release:version`), so it carries both and the publish build passes.
//
// Writes only `contractVersion`, and only when the manifest already carries one (an unstamped manifest stays
// unstamped). Same formatting as the private sync: two-space JSON and a trailing newline.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function syncContractStamp(root) {
  const manifestPath = resolve(root, 'api/contract-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const { version } = JSON.parse(readFileSync(resolve(root, 'packages/api-contract/package.json'), 'utf8'));
  if (manifest.contractVersion === undefined) return { changed: false, version, reason: 'unstamped' };
  if (manifest.contractVersion === version) return { changed: false, version, reason: 'already' };
  const previous = manifest.contractVersion;
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, contractVersion: version }, null, 2)}\n`);
  return { changed: true, version, previous };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = syncContractStamp(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  if (result.changed) console.log(`api/contract-manifest.json: contractVersion ${result.previous} -> ${result.version}`);
  else if (result.reason === 'already') console.log(`api/contract-manifest.json: contractVersion already ${result.version}`);
  else console.log('api/contract-manifest.json carries no contractVersion; left unstamped');
}
