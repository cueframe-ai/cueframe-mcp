#!/usr/bin/env node
// The plugin's own checks (`pnpm check:plugin`, part of `pnpm check`): every skill is well-formed and
// pins the CLI, the generated cards and manifest versions are current, the host manifests agree with
// each other and point at the hosted server, and the session-start hook emits valid JSON. The Claude
// Code validator (`claude plugin validate … --strict`, run in CI) covers the marketplace and plugin
// manifests and the skills directory; it does not read hooks/hooks.json or .mcp.json, which is why
// those are checked here.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { renderCard, icon } from './sync-openai-yaml.mjs';
import { STAMPED_MANIFESTS, VERSION_SOURCE } from './sync-versions.mjs';
import { validateMcp } from './host-config.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const errors = [];
const { cli } = JSON.parse(readFileSync(resolve(HERE, 'cli-version.json'), 'utf8'));
const skillsDir = resolve(ROOT, 'skills');
const skills = readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
if (skills.length === 0) errors.push('no skills');
for (const name of skills) {
  const file = join(skillsDir, name, 'SKILL.md');
  if (!existsSync(file)) { errors.push(`${name}: missing SKILL.md`); continue; }
  const text = readFileSync(file, 'utf8');
  if (text.includes('\r\n')) errors.push(`${name}: CRLF line endings`);
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) { errors.push(`${name}: missing frontmatter`); continue; }
  const meta = YAML.parse(fm[1]);
  if (meta?.name !== name) errors.push(`${name}: frontmatter name is ${meta?.name}`);
  if (typeof meta?.description !== 'string' || !meta.description) errors.push(`${name}: missing description`);
  if (!/^#\s+.+$/m.test(text.slice(fm[0].length))) errors.push(`${name}: missing # title`);
  for (const m of text.matchAll(/npx -y cueframe(@[^\s`]+)?/g)) {
    if (m[1] !== `@${cli}`) errors.push(`${name}: "${m[0]}" must be "npx -y cueframe@${cli}"`);
  }
  for (const m of text.matchAll(/\]\((\.\.?\/[^)#]+)/g)) {
    if (!existsSync(resolve(dirname(file), m[1]))) errors.push(`${name}: broken relative link ${m[1]}`);
  }
  // Generated beside the skill by scripts/plugin/sync-openai-yaml.mjs; both must be current.
  const card = join(skillsDir, name, 'agents/openai.yaml');
  if (!existsSync(card)) errors.push(`${name}: missing agents/openai.yaml; run pnpm build:plugin`);
  else {
    try { if (readFileSync(card, 'utf8') !== renderCard(name, text)) errors.push(`${name}: agents/openai.yaml is stale; run pnpm build:plugin`); }
    catch (e) { errors.push(`${name}: ${e.message}`); }
  }
  const skillIcon = join(skillsDir, name, 'assets/icon.svg');
  if (!existsSync(skillIcon) || !readFileSync(skillIcon).equals(readFileSync(icon))) errors.push(`${name}: assets/icon.svg missing or not a copy of assets/icon.svg; run pnpm build:plugin`);
}
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
for (const f of walk(skillsDir)) if (statSync(f).size > 1_048_576) errors.push(`${f}: over 1 MiB`);
const pkgVersion = JSON.parse(readFileSync(resolve(ROOT, VERSION_SOURCE), 'utf8')).version;
for (const rel of STAMPED_MANIFESTS) {
  const v = JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8')).version;
  if (v !== pkgVersion) errors.push(`${rel}: version ${v} != ${VERSION_SOURCE} ${pkgVersion}; run pnpm build:plugin`);
}
const marketplace = JSON.parse(readFileSync(resolve(ROOT, '.claude-plugin/marketplace.json'), 'utf8'));
if (marketplace.plugins?.[0]?.source !== './') errors.push('.claude-plugin/marketplace.json: plugins[0].source must be "./"');
const codexMarketplace = JSON.parse(readFileSync(resolve(ROOT, '.agents/plugins/marketplace.json'), 'utf8'));
if (codexMarketplace.plugins?.[0]?.source?.path !== './') errors.push('.agents/plugins/marketplace.json: plugins[0].source.path must be "./"');
for (const [p, key] of [['.mcp.json', 'url'], ['mcp.json', 'url'], ['gemini-extension.json', 'httpUrl']]) {
  const url = JSON.parse(readFileSync(resolve(ROOT, p), 'utf8')).mcpServers?.cueframe?.[key];
  if (url !== 'https://api.cueframe.ai/v1/mcp') errors.push(`${p}: mcpServers.cueframe.${key} is ${url}`);
}
const codex = JSON.parse(readFileSync(resolve(ROOT, '.codex-plugin/plugin.json'), 'utf8'));
for (const [rel, host] of [['mcp.json', 'portable'], ['.mcp.json', 'claude']]) {
  errors.push(...validateMcp(JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8')), host).map((error) => `${rel}: ${error}`));
}
if (codex.skills !== './skills/' || codex.mcpServers !== './mcp.json') errors.push('.codex-plugin/plugin.json must declare skills ./skills/ and mcpServers ./mcp.json');
// OpenAI reads the directory listing from root plugin.json → extensions["com.openai"].interface; .codex-plugin/plugin.json is the
// compatibility fallback and the two are not merged, so they must be identical (byte-identical as serialised: key order included).
const rootPlugin = JSON.parse(readFileSync(resolve(ROOT, 'plugin.json'), 'utf8'));
if (rootPlugin.$schema !== 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json') errors.push('plugin.json: invalid portable plugin schema');
for (const key of ['name', 'version', 'description', 'homepage', 'repository', 'license']) {
  if (rootPlugin[key] !== codex[key]) errors.push(`plugin.json: ${key} must equal .codex-plugin/plugin.json`);
}
const openai = rootPlugin.extensions?.['com.openai']?.interface;
if (!openai) errors.push('plugin.json: missing extensions["com.openai"].interface');
else if (JSON.stringify(openai) !== JSON.stringify(codex.interface)) errors.push('plugin.json extensions["com.openai"].interface must equal .codex-plugin/plugin.json interface');
for (const rel of ['plugin.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
  const repo = JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8')).repository;
  if (repo !== 'https://github.com/cueframe-ai/cueframe-mcp') errors.push(`${rel}: repository is ${repo}`);
}
for (const rel of [codex.interface?.logo, codex.interface?.composerIcon, JSON.parse(readFileSync(resolve(ROOT, '.cursor-plugin/plugin.json'), 'utf8')).logo]) {
  if (!rel || !existsSync(resolve(ROOT, rel))) errors.push(`manifest logo path does not exist: ${rel}`);
}
const skillsSh = JSON.parse(readFileSync(resolve(ROOT, 'skills.sh.json'), 'utf8'));
const grouped = [...(skillsSh.groupings ?? []).flatMap((g) => g.skills)].sort();
if (JSON.stringify(grouped) !== JSON.stringify(skills)) errors.push(`skills.sh.json lists ${JSON.stringify(grouped)}; skills/ has ${JSON.stringify(skills)}`);
const hooks = JSON.parse(readFileSync(resolve(ROOT, 'hooks/hooks.json'), 'utf8'));
for (const entry of hooks.hooks?.SessionStart ?? []) for (const h of entry.hooks) {
  const m = h.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+)"/);
  if (!m || !existsSync(resolve(ROOT, m[1]))) errors.push(`hooks.json references a missing script: ${h.command}`);
}
const inject = readFileSync(resolve(ROOT, 'hooks/session-inject.md'), 'utf8');
if (inject.split('\n').length > 25) errors.push(`hooks/session-inject.md is ${inject.split('\n').length} lines; the router must stay at or under 25`);
const rule = readFileSync(resolve(ROOT, 'rules/cueframe.mdc'), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
if (rule.trim() !== inject.trim()) errors.push('rules/cueframe.mdc body must equal hooks/session-inject.md');
// The hook must print one JSON object whose additionalContext is the router text.
try {
  const out = execFileSync('bash', [resolve(ROOT, 'hooks/session-start.sh')], { encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_ROOT: ROOT } });
  const ctx = JSON.parse(out).hookSpecificOutput?.additionalContext;
  if (typeof ctx !== 'string' || ctx.trim() !== inject.trim()) errors.push('hooks/session-start.sh: additionalContext does not equal hooks/session-inject.md');
} catch (e) { errors.push(`hooks/session-start.sh did not emit valid JSON: ${e.message.split('\n')[0]}`); }
// Skills refer to each other by name and may be installed one at a time (`npx skills add`): every name mentioned must exist.
// The allowlist holds cueframe-* tokens that are not skills: this repository, a sibling repo, and the hypothetical recipe
// name cueframe-product-video uses as an example of how to add a sibling skill.
const known = new Set(skills);
const notSkills = ['cueframe-mcp', 'cueframe-templates', 'cueframe-podcast-clip'];
for (const name of skills) {
  const text = readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');
  for (const m of text.matchAll(/\b(cueframe-[a-z-]+|composing-video|video-craft-standards|launch-video|brand-reel|make-a-social-reel|clip-a-talking-head|add-music-bed|rebrand-a-video|extracting-brand-kits|every-format-from-one-edit)\b/g)) {
    if (!known.has(m[1]) && !notSkills.includes(m[1])) errors.push(`${name}: mentions skill "${m[1]}" which does not exist in skills/`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`plugin ok: ${skills.length} skills, cli pinned to ${cli}, manifests at ${pkgVersion}`);
