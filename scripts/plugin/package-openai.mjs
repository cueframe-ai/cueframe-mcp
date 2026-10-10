#!/usr/bin/env node
// Generate from canonical sources; never copy hooks or the repository wholesale.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateMcp } from './host-config.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const ARTIFACT = resolve(ROOT, 'dist/plugins/openai');
const digest = (data) => createHash('sha256').update(data).digest('hex');
function walk(root, dir = root) {
  return readdirSync(dir).sort().flatMap((name) => {
    const path = join(dir, name), stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`symlinks are not allowed: ${path}`);
    return stat.isDirectory() ? walk(root, path) : [relative(root, path).replaceAll('\\', '/')];
  });
}
export function sourceFiles(root = ROOT) {
  return ['plugin.json', 'mcp.json', '.codex-plugin/plugin.json', 'LICENSE', 'NOTICE',
    'assets/logo-400.png', ...walk(root, join(root, 'skills'))].sort();
}
export function validateArtifact(root, files = walk(root)) {
  const errors = validateMcp(JSON.parse(readFileSync(join(root, 'mcp.json'), 'utf8')), 'portable');
  for (const file of files) if (/(^|\/)(hooks|\.app\.json)(\/|$)/.test(file)) errors.push(`OpenAI submission contains forbidden file: ${file}`);
  for (const file of ['plugin.json', '.codex-plugin/plugin.json']) {
    const manifest = JSON.parse(readFileSync(join(root, file), 'utf8'));
    const overlay = manifest.extensions?.['com.openai'];
    if ('hooks' in manifest || (overlay && 'hooks' in overlay) || 'apps' in manifest || (overlay && 'apps' in overlay)) errors.push(`${file}: submission must not declare hooks or apps`);
    const ui = overlay?.interface ?? manifest.interface;
    for (const path of [ui?.logo, ui?.composerIcon, manifest.skills, manifest.mcpServers].filter(Boolean)) {
      if (!path.startsWith('./') || relative(root, resolve(root, path)).startsWith('..') || !existsSync(resolve(root, path))) errors.push(`${file}: invalid packaged path ${path}`);
    }
  }
  for (const file of files.filter((name) => name.endsWith('.md'))) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const link of text.matchAll(/\]\((\.\.?\/[^)#]+)(?:#[^)]*)?\)/g)) {
      const target = resolve(dirname(join(root, file)), link[1]);
      if (relative(root, target).startsWith('..') || !existsSync(target)) errors.push(`${file}: unresolved packaged reference ${link[1]}`);
    }
  }
  return errors;
}
export function packageOpenai({ source = ROOT, output = ARTIFACT, check = false } = {}) {
  const files = sourceFiles(source);
  const expected = new Map(files.map((file) => [file, readFileSync(join(source, file))]));
  const manifest = { format: 1, sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(),
    sourceDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: source, encoding: 'utf8' }).trim().length > 0,
    version: JSON.parse(readFileSync(join(source, 'packages/skills/package.json'), 'utf8')).version,
    files: Object.fromEntries(files.map((file) => [file, digest(expected.get(file))])) };
  expected.set('release-manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  if (check) {
    if (!existsSync(output)) throw new Error('OpenAI artifact missing; run pnpm build:plugin:openai');
    const actual = walk(output);
    if (JSON.stringify(actual.sort()) !== JSON.stringify([...expected.keys()].sort())) throw new Error('OpenAI artifact has missing or unexpected files');
    for (const [file, data] of expected) if (!readFileSync(join(output, file)).equals(data)) throw new Error(`OpenAI artifact stale: ${file}`);
  } else {
    if (existsSync(output) && walk(output).some((file) => !expected.has(file))) throw new Error('OpenAI output contains unexpected files; use a fresh output directory');
    for (const [file, data] of expected) { mkdirSync(dirname(join(output, file)), { recursive: true }); writeFileSync(join(output, file), data); }
  }
  const errors = validateArtifact(output);
  if (errors.length) throw new Error(errors.join('\n'));
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  packageOpenai({ check: process.argv.includes('--check') });
  console.log(`OpenAI artifact ${process.argv.includes('--check') ? 'verified' : 'generated'}: ${ARTIFACT}`);
}
