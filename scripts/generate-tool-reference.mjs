#!/usr/bin/env node
// Renders catalog/tool-reference.json (exported from the @cueframe/mcp catalog) as the skills' tool
// reference, skills/cueframe-connect/references/tools.md. With --check it writes nothing and fails on drift.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REFERENCE = resolve(ROOT, 'catalog/tool-reference.json');
export const DOC = resolve(ROOT, 'skills/cueframe-connect/references/tools.md');

const lanes = (tool, side) => tool.surfaces.filter((name) => name.startsWith(`${side}.`)).map((name) => name.slice(side.length + 1)).join(', ') || '-';

export function render(reference) {
  const { package: pkg, version, commit } = reference.source;
  const rows = reference.tools.map((tool) => `| \`${tool.name}\` | ${tool.access} | ${lanes(tool, 'hosted')} | ${lanes(tool, 'desktop')} |`);
  return [
    '# CueFrame tool reference',
    '',
    `Generated from the ${pkg} ${version} catalog (commit ${commit.slice(0, 9)}). Do not edit it by hand.`,
    '',
    'Every CueFrame tool by its catalog name. A host may show it with a connection prefix (`mcp__cueframe__get_account`, `cueframe-read__get_account`); the name after the last `__` is the catalog name. **read** tools change no state, though some are metered; **write** tools change state, and a composition write takes the revision it edits.',
    '',
    'Hosted surfaces: `api` is the MCP server at `https://api.cueframe.ai/v1/mcp`; `editor` and `compose` are the hosted Director\'s editor and compose sessions. Desktop surfaces: `director` is the desktop app\'s agent, `plan` its planning mode, `external` an outside MCP client connected to the desktop app, and `cli` the Director running as a CLI agent such as Claude Code. A tool is callable only on the surfaces listed for it; list your host\'s tools for what this connection serves.',
    '',
    '| Tool | Access | Hosted | Desktop |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const doc = render(JSON.parse(readFileSync(REFERENCE, 'utf8')));
  let current = null;
  try { current = readFileSync(DOC, 'utf8'); } catch {}
  if (process.argv.includes('--check')) {
    if (current !== doc) {
      console.error(`${relative(ROOT, DOC)} is stale; run node scripts/generate-tool-reference.mjs`);
      process.exit(1);
    }
    console.log(`${relative(ROOT, DOC)} matches ${relative(ROOT, REFERENCE)}`);
  } else if (current !== doc) {
    mkdirSync(dirname(DOC), { recursive: true });
    writeFileSync(DOC, doc);
    console.log(`wrote ${relative(ROOT, DOC)}`);
  }
}
