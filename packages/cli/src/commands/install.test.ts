import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { SKILLS_DIR } from '@cueframe/skills/dir';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';


const detectGlobalAgents = vi.fn();
const upsertServer = vi.fn();
vi.mock('add-mcp', () => ({
  detectGlobalAgents,
  upsertServer,
  agents: {
    'claude-code': {
      name: 'claude-code',
      displayName: 'Claude Code',
      supportedTransports: ['stdio', 'http', 'sse'],
    },
    cursor: {
      name: 'cursor',
      displayName: 'Cursor',
      supportedTransports: ['stdio', 'http', 'sse'],
    },
    'claude-desktop': {
      name: 'claude-desktop',
      displayName: 'Claude Desktop',
      supportedTransports: ['stdio'],
    },
  },
}));

const state = vi.hoisted(() => ({ home: '' }));
vi.mock('node:os', async (io) => ({
  ...(await io<typeof import('node:os')>()),
  homedir: () => state.home,
}));
vi.mock('os', async (io) => ({
  ...(await io<typeof import('node:os')>()),
  homedir: () => state.home,
}));

const homes: string[] = [];
state.home = mkdtempSync(join(tmpdir(), 'cf-install-boot-'));
homes.push(state.home);

const { installCommand } = await import('./install.js');
const CANONICAL_SKILLS_DIR = SKILLS_DIR;
const runInstall = (opts: Parameters<typeof installCommand>[0]) =>
  installCommand(opts, CANONICAL_SKILLS_DIR);

describe('cueframe install', () => {
  let logs: string[];

  beforeEach(() => {
    state.home = mkdtempSync(join(tmpdir(), "cf-install-home-"));
    homes.push(state.home);
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      logs.push(a.map(String).join(' '));
    });
    detectGlobalAgents.mockReset().mockResolvedValue(['claude-code', 'cursor']);
    upsertServer.mockReset().mockImplementation((agent: string) => ({
      success: true,
      path: `/fake/${agent}/config.json`,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const d of homes.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('--dry-run writes nothing and wires no agent', async () => {
    await runInstall({ json: false, dryRun: true });

    expect(existsSync(join(state.home, '.claude', 'skills'))).toBe(false);
    expect(existsSync(join(state.home, '.agents', 'skills'))).toBe(false);
    expect(upsertServer).not.toHaveBeenCalled();
  });

  it('a real run wires every detected agent and copies the skills', async () => {
    await runInstall({ json: false });

    expect(upsertServer).toHaveBeenCalled();
    const skillsDir = join(state.home, '.claude', 'skills');
    expect(existsSync(skillsDir)).toBe(true);
    expect(readdirSync(skillsDir).length).toBeGreaterThan(0);
    expect(readdirSync(join(state.home, '.agents', 'skills'))).toEqual(readdirSync(skillsDir));
  });

  it('names only the agents it actually wired — never a hardcoded tool list', async () => {
    detectGlobalAgents.mockResolvedValue(['claude-code']);
    await runInstall({ json: false });

    const out = logs.join('\n');
    expect(out).toContain('claude-code');
    expect(out).not.toMatch(/cursor/i);
    expect(out).not.toMatch(/codex/i);
  });

  it('prints the manual fallback when no agent is detected', async () => {
    detectGlobalAgents.mockResolvedValue([]);
    await runInstall({ json: false });

    const out = logs.join('\n');
    expect(out).toContain('claude mcp add');
    expect(out).toContain('custom connector');
  });

  it('stamps the install date so the agent can tell the copy is stale', async () => {
    await runInstall({ json: false });

    const dir = join(state.home, '.claude', 'skills');
    const name = readdirSync(dir)[0];
    const md = readFileSync(join(dir, name, 'SKILL.md'), 'utf8');
    const today = new Date().toISOString().slice(0, 10);

    expect(md).toContain(`Installed ${today}`);
    expect(md).toContain('npx -y cueframe install');
    expect(md).toContain('Locally edited or untracked packages are preserved');
  });

  it('keeps frontmatter first — it is the trigger index, not ours to reorder', async () => {
    await runInstall({ json: false });

    const dir = join(state.home, '.claude', 'skills');
    const name = readdirSync(dir)[0];
    const md = readFileSync(join(dir, name, 'SKILL.md'), 'utf8');

    expect(md.startsWith('---\n')).toBe(true);
    const fmEnd = md.indexOf('\n---\n') + '\n---\n'.length;
    expect(md.indexOf('Installed ')).toBeGreaterThan(fmEnd - 1);
  });

  it('installs the complete Eve skill package, including supporting files', async () => {
    const fixture = mkdtempSync(join(tmpdir(), 'cf-install-skills-'));
    homes.push(fixture);
    const source = join(fixture, 'packaged-skill');
    mkdirSync(join(source, 'references'), { recursive: true });
    writeFileSync(join(source, 'SKILL.md'), '---\nname: packaged-skill\ndescription: Test.\n---\n');
    writeFileSync(join(source, 'references', 'checklist.md'), '# Checklist\n');

    await installCommand({ json: false }, fixture);

    expect(
      readFileSync(
        join(state.home, '.claude', 'skills', 'packaged-skill', 'references', 'checklist.md'),
        'utf8',
      ),
    ).toBe('# Checklist\n');
  });

  it('does not overwrite a skill the user already has — the one destructive write is guarded', async () => {
    await runInstall({ json: false });
    const dir = join(state.home, '.claude', 'skills');
    const name = readdirSync(dir)[0];
    const dest = join(dir, name, 'SKILL.md');
    writeFileSync(dest, 'MY OWN EDITS', 'utf8');

    logs.length = 0;
    await runInstall({ json: false });

    expect(readFileSync(dest, 'utf8')).toBe('MY OWN EDITS');
    expect(logs.join('\n')).toContain('preserved (locally changed or untracked');
  });

  it('--force replaces an existing skill', async () => {
    await runInstall({ json: false });
    const dir = join(state.home, '.claude', 'skills');
    const name = readdirSync(dir)[0];
    const dest = join(dir, name, 'SKILL.md');
    writeFileSync(dest, 'MY OWN EDITS', 'utf8');

    await runInstall({ json: false, force: true });

    expect(readFileSync(dest, 'utf8')).not.toBe('MY OWN EDITS');
    expect(readFileSync(dest, 'utf8')).toContain('Installed ');
    const backups = join(state.home, '.claude', 'cueframe-skill-backups');
    expect(readdirSync(backups).some((entry) =>
      readFileSync(join(backups, entry, 'SKILL.md'), 'utf8') === 'MY OWN EDITS',
    )).toBe(true);
  });

  it('detects agents BEFORE it creates ~/.claude — that dir IS add-mcp’s claude-code probe', async () => {
    let claudeDirAtDetection: boolean | null = null;
    detectGlobalAgents.mockImplementation(async () => {
      claudeDirAtDetection = existsSync(join(state.home, '.claude'));
      return [];
    });

    await runInstall({ json: false });

    expect(claudeDirAtDetection).toBe(false);
    expect(existsSync(join(state.home, '.claude', 'skills'))).toBe(true);
  });

  it('never tells the user to run a bare `cueframe` — the install leaves no binary', async () => {
    await runInstall({ json: false });

    const out = logs.join('\n');
    expect(out).toContain('npx -y cueframe login');
    expect(out).not.toMatch(/(?<!npx -y )\bcueframe (login|render|upload|install)\b/);
    expect(out).toMatch(/no `cueframe` binary/i);
  });

  it('installs shared skills for non-Claude users without claiming they need no skills', async () => {
    detectGlobalAgents.mockResolvedValue(['cursor']);
    await runInstall({ json: false });

    expect(logs.join('\n')).toContain('~/.agents/skills and ~/.claude/skills');
    expect(logs.join('\n')).not.toMatch(/nothing else to install/i);
  });

  it('reports current packages in JSON without replacing them on another install', async () => {
    await runInstall({ json: true });
    logs.length = 0;
    await runInstall({ json: true });
    const result = JSON.parse(logs[0]);
    expect(result.skills).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.unchanged.length).toBeGreaterThan(0);
    expect(result.backups).toEqual([]);
    expect(result.skillDirectories).toContain(join(state.home, '.agents', 'skills'));
  });

  it('omits that caveat when Claude Code really was wired', async () => {
    detectGlobalAgents.mockResolvedValue(['claude-code']);
    await runInstall({ json: false });

    expect(logs.join('\n')).not.toMatch(/only Claude Code reads/i);
  });

  it('never sends an http transport to a stdio-only agent', async () => {
    detectGlobalAgents.mockResolvedValue(['claude-code', 'claude-desktop']);
    await runInstall({ json: false });

    const targets = upsertServer.mock.calls.map((c) => c[0]);
    expect(targets).toContain('claude-code');
    expect(targets).not.toContain('claude-desktop');
  });
});
