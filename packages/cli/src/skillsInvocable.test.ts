import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { SKILLS_DIR } from '@cueframe/skills/dir';


const VERBS = [
  'analyze', 'api', 'auth', 'clips', 'composition', 'describe', 'export', 'init',
  'install', 'keys', 'list', 'login', 'new', 'project', 'push', 'render', 'schema',
  'sessions', 'sync', 'upload',
];

const BARE = new RegExp(
  String.raw`(?<!npx -y )(?<![\w./-])cueframe (?=(${VERBS.join('|')})\b)`,
  'g',
);

const skillsDir = SKILLS_DIR;

describe('shipped skills are executable verbatim', () => {
  const files = readdirSync(skillsDir)
    .map((name) => [name, join(skillsDir, name, 'SKILL.md')] as const)
    .filter(([, path]) => existsSync(path));

  it('finds the skills to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s invokes the CLI as `npx -y cueframe …`', (_name, path) => {
    const md = readFileSync(path, 'utf8');
    const bare = md.match(BARE) ?? [];
    const lines = md
      .split('\n')
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => new RegExp(BARE.source).test(line))
      .map(([n, line]) => `  ${n}: ${line.trim()}`);

    expect(bare.length, `bare \`cueframe\` invocations:\n${lines.join('\n')}`).toBe(0);
  });

  /**
   * `cueframe install` wires the MCP server AND drops these files. A skill that walks
   * an agent through `npx -y cueframe …` or a raw `curl /v1` without ever naming MCP
   * routes it onto the fallback path and leaves it there — which is how a September
   * session found the broken CLI push and then the undocumented REST contract edges
   * instead of the maintained tool surface. Naming MCP is the whole bar; this
   * does not police where in the file it is said.
   */
  it.each(files)('%s names MCP if it routes an agent to the CLI or raw REST', (_name, path) => {
    const md = readFileSync(path, 'utf8');
    const routesElsewhere = /npx -y cueframe (?!install\b)/.test(md) || /curl\b[^\n]*\/v1\//.test(md);
    if (!routesElsewhere) return;
    expect(/\bMCP\b/.test(md), `${path} teaches the CLI or raw REST but never mentions MCP`).toBe(true);
  });

  it.each(files)('%s can resolve its relative Markdown references in an installed skill tree', (_name, path) => {
    const md = readFileSync(path, 'utf8');
    const links = [...md.matchAll(/\]\(([^\s)]+\.md)(?:#[^)]*)?\)/g)].map((match) => match[1]);
    for (const link of links.filter((link) => !link.includes('://'))) {
      expect(existsSync(resolve(dirname(path), link)), `${path} links to missing ${link}`).toBe(true);
    }
  });
});
