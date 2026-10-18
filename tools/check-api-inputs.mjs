#!/usr/bin/env node
// Proves api/{openapi,scene-schema,scene-examples}.json came from ONE private sync before any generator touches them.
//
// The sync manifest is the independent witness: it records the sha256 of each file as the sync wrote it, and
// the toolkit ships those files as written (openapi.json carries the kernel's own scene components, which
// resolve as they are).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SYNCED_FILES = ['openapi.json', 'scene-schema.json', 'scene-examples.json'];

const sha = (text) => createHash('sha256').update(text).digest('hex');

/**
 * Check the api/ inputs under `root` against their sync manifest.
 * Returns `{ ok, problems, manifest }`; `problems` name the offending file first so a reader can act on it.
 */
export function checkApiInputs(root) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(resolve(root, 'api/contract-manifest.json'), 'utf8'));
  } catch (error) {
    return { ok: false, problems: [`api/contract-manifest.json: unreadable (${error.message}); re-run the private contract sync`], manifest: null };
  }
  if (![1, 2].includes(manifest.schemaVersion) || typeof manifest.kernelVersion !== 'string' || !/^[0-9a-f]{40}$/.test(manifest.privateCommit ?? '')) {
    return { ok: false, problems: ['api/contract-manifest.json is not a sync manifest; re-run the private contract sync'], manifest };
  }
  if (manifest.schemaVersion === 2) {
    const source = manifest.privateSource;
    const digest = (value) => /^[0-9a-f]{64}$/.test(value ?? '');
    const valid = source?.baseCommit === manifest.privateCommit && digest(source.lockfileSha256) &&
      (source.kind === 'commit' || (source.kind === 'working-tree' &&
        ['sha256', 'patchSha256', 'untrackedSha256'].every((key) => digest(source[key]))));
    if (!valid) return { ok: false, problems: ['api/contract-manifest.json: invalid source snapshot provenance; re-run the private contract sync'], manifest };
  }
  if (manifest.kernelArtifact?.version !== manifest.kernelVersion || !/^[0-9a-f]{64}$/.test(manifest.kernelArtifact?.sha256 ?? '')) {
    return { ok: false, problems: ['api/contract-manifest.json: missing or invalid verified kernel artifact identity; re-run the private contract sync'], manifest };
  }
  const provenance = `kernel ${manifest.kernelVersion}, commit ${manifest.privateCommit.slice(0, 9)}`;
  const problems = [];
  for (const name of SYNCED_FILES) {
    const expected = manifest.files?.[name];
    if (!expected) { problems.push(`${name}: not in the sync manifest`); continue; }
    let text;
    try { text = readFileSync(resolve(root, 'api', name), 'utf8'); } catch { problems.push(`${name}: missing`); continue; }
    if (sha(text) !== expected) {
      problems.push(`${name}: sha256 ${sha(text).slice(0, 12)}… does not match the sync manifest (${expected.slice(0, 12)}…). The three api/*.json files must come from one run of the private sync (${provenance}).`);
    }
  }
  return { ok: problems.length === 0, problems, manifest };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { ok, problems, manifest } = checkApiInputs(ROOT);
  if (!ok) { console.error(problems.join('\n')); process.exit(1); }
  console.log(`api inputs verified: kernel ${manifest.kernelVersion}, private ${manifest.privateCommit.slice(0, 9)}`);
}
