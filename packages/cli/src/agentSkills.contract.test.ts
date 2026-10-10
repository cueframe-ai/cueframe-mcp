import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SKILLS_DIR } from '@cueframe/skills/dir';

const AGENT_SKILLS_DIR = SKILLS_DIR;
const skill = (name: string) => readFileSync(join(AGENT_SKILLS_DIR, name, 'SKILL.md'), 'utf8');
const skillNames = readdirSync(AGENT_SKILLS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

describe('canonical Eve skill contract', () => {
  it('owns connection setup as one loadable skill', () => {
    const path = join(AGENT_SKILLS_DIR, 'cueframe-connect', 'SKILL.md');
    expect(existsSync(path)).toBe(true);
    expect(skill('cueframe-connect')).toContain('https://api.cueframe.ai/v1/mcp');
  });

  it('routes connection setup without copying its instructions', () => {
    const consumers = skillNames.filter(
      (name) => name !== 'cueframe-connect' && skill(name).includes('`cueframe-connect`'),
    );
    expect(consumers.length).toBeGreaterThan(0);

    for (const name of skillNames.filter((name) => name !== 'cueframe-connect')) {
      expect(skill(name), name).not.toContain('<!-- cueframe:connect -->');
      expect(skill(name), name).not.toContain('claude mcp add');
    }
  });
});
