#!/usr/bin/env node
// No npm configuration, user token, or authenticated registry client is consulted.
import { readFileSync } from 'node:fs';

let failed = false;
for (const directory of ['api-contract', 'sdk', 'skills', 'cli']) {
  const pkg = JSON.parse(readFileSync(new URL(`../packages/${directory}/package.json`, import.meta.url)));
  const label = `${pkg.name}@${pkg.version}`;
  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${pkg.version}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`anonymous metadata HTTP ${response.status}`);
    const metadata = await response.json();
    if (metadata.name !== pkg.name || metadata.version !== pkg.version) throw new Error('metadata identity differs');
    const url = new URL(metadata.dist?.tarball);
    if (url.origin !== 'https://registry.npmjs.org') throw new Error('unexpected tarball origin');
    const tarball = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30_000) });
    if (!tarball.ok) throw new Error(`anonymous tarball HTTP ${tarball.status}`);
    console.log(`ok ${label}: anonymous metadata and tarball accessible`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${label}: ${error.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
