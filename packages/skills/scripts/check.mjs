#!/usr/bin/env node
// dist/skills must be the root skills/ tree, file for file and byte for byte: a stale dist would
// publish skills that differ from what the plugin ships. A missing dist (a fresh clone running
// `pnpm check` before `pnpm build`) is built first; a dist that exists but differs fails.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { build, DIST_SKILLS, ROOT_SKILLS } from './build.mjs';
import { SKILLS_DIR } from '../skills-dir.js';

const listFiles = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
};

if (!existsSync(DIST_SKILLS)) {
  console.log('@cueframe/skills: dist/skills is missing; building it first');
  build();
}

const errors = [];
if (realpathSync(SKILLS_DIR) !== realpathSync(DIST_SKILLS)) errors.push(`skills-dir.js resolves to ${SKILLS_DIR}, expected ${DIST_SKILLS}`);
const want = listFiles(ROOT_SKILLS);
const have = listFiles(DIST_SKILLS);
for (const f of want) if (!have.includes(f)) errors.push(`dist/skills lacks ${f}`);
for (const f of have) if (!want.includes(f)) errors.push(`dist/skills has ${f}, which is not under skills/`);
for (const f of want) {
  if (!have.includes(f)) continue;
  if (!readFileSync(join(ROOT_SKILLS, f)).equals(readFileSync(join(DIST_SKILLS, f)))) errors.push(`dist/skills/${f} differs from skills/${f}`);
}
const skills = readdirSync(DIST_SKILLS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
for (const name of skills) if (!statSync(join(DIST_SKILLS, name, 'SKILL.md'), { throwIfNoEntry: false })?.isFile()) errors.push(`dist/skills/${name}: missing SKILL.md`);

if (errors.length) {
  console.error(`@cueframe/skills: dist/skills is stale; run \`pnpm --filter @cueframe/skills build\`\n${errors.join('\n')}`);
  process.exit(1);
}
console.log(`@cueframe/skills: dist/skills equals skills/ (${skills.length} skills, ${want.length} files)`);
