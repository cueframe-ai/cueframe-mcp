#!/usr/bin/env node
/**
 * Compare the checked-in api/openapi.json against the spec production serves,
 * the same comparison .github/workflows/spec-drift.yml runs.
 *
 * Needs the oasdiff CLI: `brew install oasdiff` (verified against oasdiff
 * 1.32.1, the version the CI action's image pins).
 *
 * The live spec goes through the same depth cap that produced the published
 * copy's scene components, applied to PRODUCTION'S OWN scene schema. Prod emits
 * the scene layers as anonymous recursive $refs; orval cannot generate an SDK
 * from those, so the published copy carries depth-capped named components.
 * Comparing the two untransformed reports that deliberate substitution as
 * breaking on every run, forever. Deriving the canonical from prod rather than
 * from the repo keeps the gate able to see a real change to the scene schema.
 *
 * Base is the transformed live spec because that is the contract clients
 * already hold, so a breaking result means the repo copy promises something
 * production does not serve.
 *
 * `--emit-base <path>` writes the transformed live spec and stops, which is how
 * the workflow feeds it to the pinned oasdiff action.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { sceneCanonicalFromSpec, vendorSceneSchema } from './vendor-scene-schema.mjs';

const ATTEMPTS = 3;
const specUrl = process.env.CUEFRAME_SPEC_URL ?? 'https://api.cueframe.ai/v1/openapi.json';
const revision = 'api/openapi.json';

async function fetchSpec(url) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (response.ok) return await response.json();
      if (attempt === ATTEMPTS) throw new Error(`${url} returned ${response.status} ${response.statusText}`);
      console.error(`${url} returned ${response.status}, retrying (${attempt}/${ATTEMPTS})`);
    } catch (error) {
      if (attempt === ATTEMPTS) throw error;
      console.error(`${url} failed: ${error.message}, retrying (${attempt}/${ATTEMPTS})`);
    }
    await sleep(attempt * 1000);
  }
}

function oasdiff(...args) {
  const result = spawnSync('oasdiff', args, { stdio: 'inherit' });
  if (result.error?.code === 'ENOENT') {
    console.error('oasdiff is not installed. Run: brew install oasdiff');
    process.exit(2);
  }
  return result.status ?? 2;
}

const spec = await fetchSpec(specUrl);
const live = JSON.stringify(vendorSceneSchema(spec, sceneCanonicalFromSpec(spec)), null, 2) + '\n';

if (process.argv.includes('--emit-base')) {
  const emitTo = process.argv[process.argv.indexOf('--emit-base') + 1];
  if (!emitTo) throw new Error('--emit-base needs a path');
  writeFileSync(emitTo, live);
  console.log(`wrote the vendored live spec to ${emitTo}`);
  process.exit(0);
}

const directory = mkdtempSync(join(tmpdir(), 'spec-drift-'));
const base = join(directory, 'prod-openapi.json');
writeFileSync(base, live);

console.log(`base:     ${specUrl} (scene schema depth-capped)\nrevision: ${revision}\n`);
oasdiff('diff', base, revision, '--format', 'text');
const status = oasdiff('breaking', base, revision, '--fail-on', 'ERR');
rmSync(directory, { recursive: true, force: true });
process.exit(status);
