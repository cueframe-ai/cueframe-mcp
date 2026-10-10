
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agents, detectGlobalAgents, upsertServer, type AgentType } from 'add-mcp';
import { resolveApiUrl } from '../remote/auth.js';
import { emitResult, emitError } from '../remote/output.js';
import { ExitCode, exitWith } from '../remote/exitCodes.js';
import { installSkillPackages } from './skillInstallation.js';

const MCP_SERVER_NAME = 'cueframe';

const BUNDLED_SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'skills');

function supportsHttp(agent: AgentType): boolean {
  return (agents[agent]?.supportedTransports ?? []).includes('http');
}

interface WireOutcome {
  agent: AgentType;
  wired: boolean;
  path?: string;
  error?: string;
}

async function wireMcp(mcpUrl: string): Promise<WireOutcome[]> {
  const detected = await detectGlobalAgents();
  return detected.map((agent) => {
    if (!supportsHttp(agent)) {
      return {
        agent,
        wired: false,
        error: 'speaks stdio only — CueFrame’s MCP server is remote HTTP',
      };
    }
    try {
      const res = upsertServer(agent, MCP_SERVER_NAME, { type: 'http', url: mcpUrl });
      return { agent, wired: res.success, path: res.path, error: res.error };
    } catch (err) {
      return { agent, wired: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export async function installCommand(opts: {
  json?: boolean;
  target?: string;
  dryRun?: boolean;
  force?: boolean;
}, skillsDir = BUNDLED_SKILLS_DIR) {
  const mcpUrl = `${resolveApiUrl(opts.target)}/v1/mcp`;
  const skillDirectories = [join(homedir(), '.agents', 'skills'), join(homedir(), '.claude', 'skills')];

  if (opts.dryRun) {
    const detected = await detectGlobalAgents();
    emitResult(
      opts,
      { ok: true, dryRun: true, mcpUrl, wouldWire: detected, serverName: MCP_SERVER_NAME, skillDirectories },
      () => {
        console.log(`Would wire MCP server "${MCP_SERVER_NAME}" → ${mcpUrl} into:`);
        if (detected.length === 0) console.log('  (no agents detected on this machine)');
        for (const a of detected) console.log(`  → ${a}`);
        console.log('Would install/refresh CueFrame skills in ~/.agents/skills and ~/.claude/skills');
        console.log('Dry run — nothing was written.');
      },
    );
    return;
  }

  if (!existsSync(skillsDir)) {
    emitError(opts, 'install', new Error('Bundled skills/ directory not found'), ExitCode.UserError);
    exitWith(ExitCode.UserError);
  }
  const wired = await wireMcp(mcpUrl);
  const { installed: skills, unchanged, skipped, backups } = installSkillPackages(skillsDir, skillDirectories, opts);

  if (skills.length === 0 && unchanged.length === 0 && skipped.length === 0 && wired.length === 0) {
    emitError(
      opts,
      'install',
      new Error('No agents detected and no skills found — nothing to install'),
      ExitCode.UserError,
    );
    exitWith(ExitCode.UserError);
  }

  emitResult(
    opts,
    { ok: true, mcpUrl, agents: wired, skills, unchanged, skipped, backups, skillDirectories },
    () => {
      console.log(`✓ CueFrame MCP server (${mcpUrl})`);
      if (wired.length === 0) {
        console.log('  No agents detected on this machine. Add it manually:');
        console.log(`    claude mcp add --transport http ${MCP_SERVER_NAME} ${mcpUrl}`);
        console.log(`  …or add the MCP server ${mcpUrl} as a custom connector.`);
      } else {
        for (const w of wired) {
          console.log(w.wired ? `  → wired ${w.agent}` : `  ✗ ${w.agent}: ${w.error ?? 'failed'}`);
        }
      }
      console.log(`✓ Installed/refreshed ${skills.length} CueFrame skill copies in ~/.agents/skills and ~/.claude/skills`);
      if (unchanged.length > 0) console.log(`  ${unchanged.length} already current`);
      if (skipped.length > 0) {
        console.log(`  ${skipped.length} preserved (locally changed or untracked; review before --force)`);
        for (const path of skipped) console.log(`    ${path}`);
      }
      for (const backup of backups) console.log(`  Backup: ${backup.path}`);
      console.log('');
      console.log('Next: ask your agent to make a video — it opens a browser to authorize on');
      console.log('first call. No API key needed.');
      console.log('Restart your agent session to load the MCP server and skills.');
      console.log('');
      console.log('This installed no `cueframe` binary — npx leaves nothing on your PATH.');
      console.log('Prefer the terminal? Every command runs as `npx -y cueframe …`:');
      console.log('    npx -y cueframe login');
    },
  );
}
