// Static instruction regressions and evaluation-case integrity; not model behavior evaluations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
const skills = readdirSync(new URL('skills/', root), { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name);
const router = read('hooks/session-inject.md');

test('all independently installed skills preserve scope, lane and metering safeguards', () => {
  assert.equal(skills.length, 18);
  for (const skill of skills) {
    const text = read(`skills/${skill}/SKILL.md`);
    for (const phrase of ['User intent and acceptance criteria override', 'current source revisions remain mandatory', 'preserve the chosen local/hosted lane', 'Do not silently install, authenticate, switch projects or upload local content', 'check `get_account`, entitlements, balance and quotes', 'preserve unrelated timing, media, audio and shared brand-kit state', 'No restarted intake, new approval pause, paid judge or final export by default', 'scores never override acceptance failures']) assert.ok(text.includes(phrase), `${skill}: missing ${phrase}`);
    assert.doesNotMatch(text, /7\.5|narration first, always|standards win|checklist wins|preserve the MEANING of K1|Even a 30s piece must|if there.s no product on it, it.s slop|product\/human is the opening shot, not a title card/);
  }
});

test('Claude and Cursor route the same narrow workflows without hypothetical skills', () => {
  assert.equal(read('rules/cueframe.mdc').replace(/^---\n[\s\S]*?\n---\n/, '').trim(), router.trim());
  const twoD = router.split('\n').find((line) => line.includes('custom 2D'));
  assert.match(twoD, /cueframe-component-authoring/);
  assert.doesNotMatch(twoD, /cueframe-scene-shot/);
  assert.match(router.split('\n').find((line) => line.includes('device, camera or 3D')), /cueframe-scene-shot/);
  assert.match(router, /existing-project.*cueframe-compose-loop/);
  assert.doesNotMatch(router, /cueframe-refresh-sections|cueframe-type-motion/);
});

test('direct authoring and selected hosted Director remain separate execution lanes', () => {
  const text = read('skills/cueframe-storyboard/SKILL.md');
  assert.match(text, /\*\*Direct authoring:\*\*/);
  assert.match(text, /\*\*Hosted Director, when available and selected:\*\*/);
  assert.match(text, /Relay its compose\/render quote before/);
  assert.match(text, /A local project does not require hosted registration/);
});

test('styling preserves layout and isolated corrections cannot mutate a shared kit', () => {
  const text = read('skills/rebrand-a-video/SKILL.md');
  assert.match(text, /Do not upsert a shared kit for one local correction/);
  assert.match(text, /Styling preserves layout; a full redesign requires explicit scope/);
  assert.match(text, /rebuild only for an explicitly requested redesign/);
});

test('fixed hosted caption judge limitations do not become creative requirements', () => {
  for (const skill of ['composing-video', 'cueframe-compose-loop', 'video-craft-standards']) {
    const text = read(`skills/${skill}/SKILL.md`);
    assert.match(text, /caption criterion|caption criteria/);
    assert.match(text, /do not add captions solely|not a reason to add captions/i);
    assert.match(text, /do not change judge behavior|does not repair the judge/);
  }
});

test('evaluation fixtures cover creative intent, scope and capability routes with real skills', () => {
  const cases = JSON.parse(read('tools/fixtures/skill-routing-cases.json'));
  assert.deepEqual(cases.map((x) => x.id), ['narrated-explainer', 'silent-brand-study', 'recorded-interview', 'one-title-change', 'local-only', 'hosted-director', 'two-dimensional', 'three-dimensional', 'missing-capability']);
  for (const scenario of cases) {
    assert.ok(scenario.request && scenario.expect.length && scenario.reject.length);
    for (const skill of scenario.skills) assert.ok(existsSync(new URL(`skills/${skill}/SKILL.md`, root)), `${scenario.id}: unknown skill ${skill}`);
  }
});

test('skills name only composition ops the shipped contract defines', () => {
  const ops = new Set(JSON.parse(read('api/openapi.json')).components.schemas.CompositionOp.oneOf.map((op) => op.properties.type.const));
  // An op as skills write it: a backticked camelCase verb op, or a dotted op (`clip.update`, `captions.fromComposition`).
  const opName = /`((?:apply|set|add|remove|update|load|materialize|move|duplicate|cut|ripple|reorder)[A-Z][A-Za-z0-9]*|(?:clip|scene|captions|component)\.(?:add|remove|update|set[A-Z][A-Za-z0-9]*|from[A-Z][A-Za-z0-9]*|repin-v\d+))`/g;
  const unknown = [];
  for (const skill of skills) {
    for (const [, name] of read(`skills/${skill}/SKILL.md`).matchAll(opName)) if (!ops.has(name)) unknown.push(`${skill}: ${name}`);
  }
  assert.deepEqual(unknown, []);
});

test('skills teach no retired version-3 component authoring', () => {
  // Inline TSX/JSX sources, the `custom` primitive and Remotion imports are refused at admission.
  const retired = /jsxSource|tsxSource|"primitiveId":\s*"custom"|primitiveId:\s*['"]custom['"]|from\s+['"](?:remotion|@remotion\/[^'"]+)['"]|\bRemotion\b/;
  const found = skills.filter((skill) => retired.test(read(`skills/${skill}/SKILL.md`)));
  assert.deepEqual(found, []);
});

test('skill code blocks hold no version-3 component code', () => {
  // A fenced block is code an agent copies: TSX modules, React components and @cueframe/animate imports are refused.
  const retired = /@cueframe\/animate|\.tsx\b|import React\b|export default function\b/;
  const found = [];
  for (const skill of skills) {
    for (const [block] of read(`skills/${skill}/SKILL.md`).matchAll(/```[\s\S]*?```/g)) if (retired.test(block)) found.push(`${skill}: ${block.split('\n')[0]}`);
  }
  assert.deepEqual(found, []);
});

test('skills name only tools an agent can call', () => {
  // Hosted: the snapshot of the server's tools/list (glama/tools.json, refreshed from the MCP package).
  const hosted = JSON.parse(read('glama/tools.json')).tools.map((tool) => tool.name);
  // The Director's own tools, which the hosted tools/list does not serve (cueframe-public:
  // packages/mcp/src/internalLoopTools.ts and apps/studio/src/llm/desktopToolNames.ts).
  const director = ['render_frame', 'verify_composition', 'commit_session', 'view_style_reference', 'get_context', 'search_library',
    'analyze_transcript', 'get_app_state', 'open_component_preview', 'update_component_preview', 'render_component_preview_frame',
    'close_component_preview', 'commit_component_preview', 'read_component', 'edit_component', 'get_scene_contract'];
  const known = new Set([...hosted, ...director]);
  // A tool as skills write it: a backticked snake_case name led by a tool verb.
  const toolName = /`((?:get|list|create|update|delete|apply|preview|search|import|generate|describe|validate|wait|cancel|retry|resolve|score|extract|prepare|select|register|new|start|verify|open|commit|close|read|edit|repin|publish|finalize|suggest|derive|view|analyze|consult|resume|render_component|render_frame)_[a-z0-9_]+)`/g;
  const docs = skills.flatMap((skill) => {
    const dir = new URL(`skills/${skill}/references/`, root);
    const refs = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.md')).map((name) => `skills/${skill}/references/${name}`) : [];
    return [`skills/${skill}/SKILL.md`, ...refs];
  });
  const unknown = docs.flatMap((file) => [...read(file).matchAll(toolName)].map(([, name]) => name).filter((name) => !known.has(name)).map((name) => `${file}: ${name}`));
  assert.deepEqual([...new Set(unknown)], []);
});
