import { describe, it, expect } from 'vitest';
import { agents } from 'add-mcp';
import { SUPPORTED_AGENTS, supportedAgentsSentence } from './supportedAgents.js';

describe('supportedAgents', () => {
  it('is non-empty and has unique ids', () => {
    expect(SUPPORTED_AGENTS.length).toBeGreaterThan(0);
    const ids = SUPPORTED_AGENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes the three tools the landing page names', () => {
    const ids = SUPPORTED_AGENTS.map((a) => a.id);
    expect(ids).toContain('claude-code');
    expect(ids).toContain('cursor');
    expect(ids).toContain('codex');
    expect(ids).toContain('antigravity');
    expect(ids).not.toContain('gemini-cli');
  });

  it('leads with the most recognisable names', () => {
    expect(SUPPORTED_AGENTS[0].id).toBe('claude-code');
    expect(SUPPORTED_AGENTS[1].id).toBe('cursor');
  });

  it('every listed agent really speaks http — we wire {type:"http"}', () => {
    for (const a of SUPPORTED_AGENTS) {
      expect(agents[a.id as keyof typeof agents].supportedTransports).toContain('http');
    }
  });

  it('excludes stdio-only agents — claude-desktop must not be advertised', () => {
    expect(SUPPORTED_AGENTS.map((a) => a.id)).not.toContain('claude-desktop');
  });

  it('every entry carries a human label, never a bare registry key', () => {
    for (const a of SUPPORTED_AGENTS) {
      expect(a.label.length).toBeGreaterThan(0);
    }
    expect(SUPPORTED_AGENTS.find((a) => a.id === 'claude-code')?.label).toBe('Claude Code');
  });

  it('formats a sentence that counts the remainder', () => {
    const s = supportedAgentsSentence(2);
    expect(s).toContain('Claude Code');
    expect(s).toMatch(/and \d+ more$/);
  });
});
