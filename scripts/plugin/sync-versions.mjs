#!/usr/bin/env node
// packages/skills/package.json is the one version authority for the plugin: every host manifest is
// stamped from it, so the plugin a host installs and the @cueframe/skills package carry one version.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const VERSION_SOURCE = 'packages/skills/package.json';
export const STAMPED_MANIFESTS = ['plugin.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json', 'gemini-extension.json'];
// validate.mjs imports the two constants above; only a direct run stamps anything.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { version } = JSON.parse(readFileSync(resolve(ROOT, VERSION_SOURCE), 'utf8'));
  for (const rel of STAMPED_MANIFESTS) {
    const path = resolve(ROOT, rel);
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    if (manifest.version !== version) { manifest.version = version; writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`); console.log(`${rel} → ${version}`); }
  }
  console.log(`plugin manifests at ${version}`);
}
