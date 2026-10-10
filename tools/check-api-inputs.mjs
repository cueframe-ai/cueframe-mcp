#!/usr/bin/env node
// Proves api/{openapi,scene-schema,scene-examples}.json came from ONE private sync before any generator touches them.
//
// Vendoring rewrites api/openapi.json's scene components FROM api/scene-schema.json, so comparing the two
// afterwards proves nothing. The sync manifest is the independent witness: it records the sha256 of each
// file as the sync wrote it — openapi.json BEFORE the toolkit vendors the scene schema into it.
//
// Scope: the three api inputs against the manifest, nothing more. The vendored SceneShotSpecV2LayerDepth* /
// SceneShotSpecV2JsonValue components in openapi.json are vendoring OUTPUT, regenerated from scene-schema.json by
// the next step of generate:api-consumers and gated by check:api-consumer-drift; this check discards them and
// proves only the sync's un-vendored content.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isVendoredSceneSpec, unvendoredSerializations } from './vendor-scene-schema.mjs';

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
  const provenance = `kernel ${manifest.kernelVersion}, commit ${manifest.privateCommit.slice(0, 9)}`;
  const problems = [];
  for (const name of SYNCED_FILES) {
    const expected = manifest.files?.[name];
    if (!expected) { problems.push(`${name}: not in the sync manifest`); continue; }
    let text;
    try { text = readFileSync(resolve(root, 'api', name), 'utf8'); } catch { problems.push(`${name}: missing`); continue; }
    if (name === 'openapi.json') {
      // The sync records openapi.json BEFORE vendoring. A freshly synced file hashes as is; a vendored one is
      // compared through its un-vendored serializations (vendoring re-appends SceneShotSpecV2, so the
      // sync's position for it has to be recovered by trial — see tools/vendor-scene-schema.mjs).
      const spec = JSON.parse(text);
      let matched = !isVendoredSceneSpec(spec) && sha(text) === expected;
      if (!matched && isVendoredSceneSpec(spec)) {
        try {
          for (const { text: candidate } of unvendoredSerializations(spec)) {
            if (sha(candidate) === expected) { matched = true; break; }
          }
        } catch (error) {
          // A half-vendored document (the chain present, the root gone) is a problem to report, not a crash.
          problems.push(`${name}: ${error.message}`);
          continue;
        }
      }
      if (!matched) {
        problems.push(`${name}: sha256 of the un-vendored document does not match the sync manifest (${expected.slice(0, 12)}…). The three api/*.json files must come from one run of the private sync (${provenance}).`);
      }
      continue;
    }
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
