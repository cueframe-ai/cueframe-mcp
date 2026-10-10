import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const snapshot = read('../glama/tools.json');
const examples = read('../skills/cueframe-compose-loop/references/builtin-requests.json');
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
for (const example of examples) {
  test(`documented hosted request: ${example.name}`, () => {
    const tool = snapshot.tools.find(tool => tool.name === example.tool);
    assert.ok(tool, `Missing generated MCP tool: ${example.tool}`);
    const validate = ajv.compile(tool.inputSchema);
    assert.ok(validate(example.arguments), JSON.stringify(validate.errors));
    if (example.tool === 'resolve_builtin_component') {
      for (const field of ['collection', 'id', 'revision']) {
        assert.ok(tool.inputSchema.properties[field], `Missing resolver input ${field}`);
        const missing = { ...example.arguments };
        delete missing[field];
        assert.equal(validate(missing), false, `${field} must be required`);
      }
    }
    if (example.tool === 'apply_template') {
      assert.deepEqual(Object.keys(example.arguments.body.media), Array.from({length: 8}, (_, i) => `image${i + 1}`));
      for (const binding of Object.values(example.arguments.body.media)) assert.deepEqual(binding, { sample: true });
    }
    if (example.tool === 'wait_job') {
      assert.equal(validate({ kind: 'verify', jobId: 'wrong-field' }), false);
    }
  });
}

test('workflow guide requires explicit samples and server-side catalog paging', () => {
  const guide = readFileSync(new URL('../skills/cueframe-compose-loop/references/builtin-insertion.md', import.meta.url), 'utf8');
  const composing = readFileSync(new URL('../skills/composing-video/SKILL.md', import.meta.url), 'utf8');
  assert.match(guide, /Select pinned samples explicitly/);
  assert.doesNotMatch(guide, /Omit media overrides/);
  assert.doesNotMatch(composing, /NO input params/);
});
