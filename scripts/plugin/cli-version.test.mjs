// The CLI pin that skills and docs write (`npx -y cueframe@<major.minor>`) is the CLI this repo
// ships. cli-version.json was hand-maintained and fell behind when the CLI went to 0.9.0: skills
// 0.3.1 showed `new component --category`, which 0.8.x rejects and 0.9.0 requires, while pinning 0.8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
const { cli } = JSON.parse(read('scripts/plugin/cli-version.json'));
const cliPackage = JSON.parse(read('packages/cli/package.json'));
// `npx -y cueframe@<major.minor>` in a convention is a placeholder, not a pin.
const pinOf = (text) => [...text.matchAll(/npx -y cueframe(@[^\s`]+)?/g)].map((m) => m[1] ?? '(unpinned)').filter((pin) => !pin.startsWith('@<'));

test('cli-version.json pins the major.minor of the cueframe CLI package in this repo', () => {
  assert.equal(cliPackage.name, 'cueframe');
  const [major, minor] = cliPackage.version.split('.');
  assert.equal(cli, `${major}.${minor}`, `scripts/plugin/cli-version.json says ${cli}; packages/cli is ${cliPackage.version}`);
});

test('every skill and user-facing doc runs the CLI at that pin', () => {
  const skills = readdirSync(new URL('skills/', root), { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => `skills/${x.name}/SKILL.md`);
  const docs = ['README.md', 'AGENTS.md', 'llms-install.md', 'packages/cli/README.md', 'examples/claude/README.md', 'glama/server.mjs'];
  const wrong = [];
  for (const file of [...skills, ...docs]) for (const pin of pinOf(read(file))) if (pin !== `@${cli}`) wrong.push(`${file}: cueframe${pin}`);
  assert.deepEqual(wrong, [], `expected npx -y cueframe@${cli}`);
});
