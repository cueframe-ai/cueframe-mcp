#!/usr/bin/env node
// The repository's root skills/ directory is the single source of truth: it is what the plugin
// hosts, the plugin validators and `npx skills add` read. This package publishes a copy of it as
// dist/skills so programs can import the tree from npm (`SKILLS_DIR` from `@cueframe/skills/dir`).
// Nothing is filtered on the way in; a consumer installing skills into a host other than ChatGPT
// or Codex drops agents/openai.yaml and assets/icon.svg itself, as the CLI's build does.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT_SKILLS = resolve(PKG, '../../skills');
export const DIST_SKILLS = resolve(PKG, 'dist/skills');

export function build() {
  if (!existsSync(ROOT_SKILLS)) throw new Error(`root skills directory not found: ${ROOT_SKILLS}`);
  const skills = readdirSync(ROOT_SKILLS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  if (skills.length === 0) throw new Error(`no skills under ${ROOT_SKILLS}`);
  rmSync(resolve(PKG, 'dist'), { recursive: true, force: true });
  mkdirSync(DIST_SKILLS, { recursive: true });
  cpSync(ROOT_SKILLS, DIST_SKILLS, { recursive: true, verbatimSymlinks: true });
  return skills;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const skills = build();
  console.log(`@cueframe/skills: copied ${skills.length} skills from skills/ into dist/skills`);
}
