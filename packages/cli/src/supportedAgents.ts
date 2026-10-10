import { agents } from 'add-mcp';

export interface SupportedAgent {
  id: string;
  label: string;
}

const HEADLINE_ORDER = [
  'claude-code',
  'cursor',
  'codex',
  'vscode',
  'windsurf',
  'zed',
  'antigravity',
  'github-copilot-cli',
] as const;

function rank(id: string): number {
  const i = HEADLINE_ORDER.indexOf(id as (typeof HEADLINE_ORDER)[number]);
  return i === -1 ? HEADLINE_ORDER.length : i;
}

export const SUPPORTED_AGENTS: readonly SupportedAgent[] = Object.entries(agents)
  .filter(([id, a]) => id !== 'gemini-cli' && (a.supportedTransports ?? []).includes('http'))
  .map(([id, a]) => ({ id, label: a.displayName ?? id }))
  .sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));

export function supportedAgentsSentence(headline = 4): string {
  const labels = SUPPORTED_AGENTS.map((a) => a.label);
  const head = labels.slice(0, headline).join(', ');
  const rest = labels.length - headline;
  return rest > 0 ? `${head} — and ${rest} more` : head;
}
