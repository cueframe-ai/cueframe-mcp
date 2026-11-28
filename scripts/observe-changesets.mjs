import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Changesets 2.31.1 emits this summary only for subprocesses that returned success.
// No summary (including interruption), an unfamiliar format, or a skipped package is unknown.
export function publishedFromSummary(output, planned, exitCode) {
  // Changesets writes failed-package names to stdout but their heading to stderr;
  // merged stream ordering is not reliable. A failed batch cannot confirm any package here.
  if (exitCode !== 0) return [];
  const lines = output.split(/\r?\n/);
  const marker = '🦋  success packages published successfully:';
  if (lines.filter(line => line === marker).length !== 1) return [];
  const start = lines.indexOf(marker) + 1;
  const found = [];
  for (const line of lines.slice(start)) {
    if (!line.startsWith('🦋  ') || line.startsWith('🦋  info ') || line.startsWith('🦋  warn ') || line.startsWith('🦋  error ')) break;
    const name = line.slice('🦋  '.length);
    if (!planned.includes(name) || found.includes(name)) return [];
    found.push(name);
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const planned = (process.env.UNPUBLISHED || '').split(/\s+/).filter(Boolean);
  const child = spawn('pnpm', ['changeset', 'publish', '--no-git-tag'], { env: { ...process.env, FORCE_COLOR: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let overflow = false;
  child.stdout.on('data', chunk => { process.stdout.write(chunk); if (stdout.length + chunk.length > 1_000_000) overflow = true; else stdout += chunk.toString(); });
  child.stderr.on('data', chunk => process.stderr.write(chunk));
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('close', (code, signal) => {
    const confirmed = overflow || signal ? [] : publishedFromSummary(stdout, planned, code);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `confirmed=${JSON.stringify(confirmed)}\n`);
    process.exitCode = code === 0 && !signal ? 0 : 1;
  });
}
