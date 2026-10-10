import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILLS_DIR } from '@cueframe/skills/dir';

const cliDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = SKILLS_DIR;
const outputDir = resolve(cliDir, 'dist/skills');

// `@cueframe/skills` also carries the files the OpenAI/Codex directory wants per skill. The CLI
// installs skills into the other hosts, which read SKILL.md (and references/) only, so those two
// generated files are not bundled.
const OPENAI_DIRECTORY_ONLY = new Set(['agents/openai.yaml', 'assets/icon.svg']);

if (!existsSync(sourceDir)) {
  throw new Error(`Canonical skills not found in @cueframe/skills: ${sourceDir}`);
}

const skills = readdirSync(sourceDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (skills.length === 0) throw new Error(`No canonical skills found in @cueframe/skills: ${sourceDir}`);

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
for (const skill of skills) {
  const from = resolve(sourceDir, skill);
  const to = resolve(outputDir, skill);
  cpSync(from, to, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (src) => !OPENAI_DIRECTORY_ONLY.has(relative(from, src).split(sep).join('/')),
  });
  for (const dir of ['agents', 'assets']) {
    const emptied = resolve(to, dir);
    if (existsSync(emptied) && readdirSync(emptied).length === 0) rmSync(emptied, { recursive: true });
  }
}

console.log(`Packaged ${skills.length} canonical skill(s) from @cueframe/skills in dist/skills`);
