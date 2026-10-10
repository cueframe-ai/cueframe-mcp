import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCENE_MAX_OPENAPI_GROUP_DEPTH } from './scene-schema-openapi.mjs';
import { sceneCanonicalFromSpec, vendorSceneSchema } from './vendor-scene-schema.mjs';

const canonical = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  description: 'A scene shot.',
  type: 'object',
  properties: { layers: { type: 'array', items: { $ref: '#/$defs/__schema0' } } },
  $defs: {
    __schema0: {
      anyOf: [
        { type: 'object', properties: { kind: { const: 'group' }, children: { type: 'array', items: { $ref: '#/$defs/__schema0' } } } },
        { type: 'object', properties: { kind: { const: 'text' }, params: { additionalProperties: { $ref: '#/$defs/__schema1' } } } },
      ],
    },
    __schema1: { anyOf: [{ type: 'null' }, { type: 'array', items: { $ref: '#/$defs/__schema1' } }] },
  },
};

// The shape production serves: the recursion hoisted into anonymous components.
const live = () => ({
  openapi: '3.1.0',
  components: {
    schemas: {
      Project: { type: 'object' },
      SceneShotSpecV2: {
        description: 'A scene shot.',
        type: 'object',
        properties: { layers: { type: 'array', items: { $ref: '#/components/schemas/__schema0' } } },
      },
      __schema0: { anyOf: [{ properties: { children: { items: { $ref: '#/components/schemas/__schema0' } } } }] },
      __schema1: { anyOf: [{ $ref: '#/components/schemas/__schema1' }] },
    },
  },
});

test('the anonymous recursion becomes depth-capped named components', () => {
  const schemas = vendorSceneSchema(live(), canonical).components.schemas;

  assert.deepEqual(
    Object.keys(schemas).filter((name) => name.startsWith('__schema')),
    [],
    'the recursion carriers must not survive; nothing references them once the layers are named',
  );
  assert.deepEqual(schemas.Project, { type: 'object' }, 'unrelated components are untouched');

  const depths = Array.from({ length: SCENE_MAX_OPENAPI_GROUP_DEPTH + 1 }, (_, d) => `SceneShotSpecV2LayerDepth${d}`);
  for (const name of depths) assert.ok(schemas[name], `${name} is missing`);
  assert.equal(schemas.SceneShotSpecV2.properties.layers.items.$ref, '#/components/schemas/SceneShotSpecV2LayerDepth0');
  assert.equal(
    JSON.stringify(schemas.SceneShotSpecV2LayerDepth0).includes('SceneShotSpecV2LayerDepth1'),
    true,
    'each layer must descend to the next',
  );

  const deepest = schemas[`SceneShotSpecV2LayerDepth${SCENE_MAX_OPENAPI_GROUP_DEPTH}`];
  assert.equal(
    deepest.anyOf.some((arm) => arm?.properties?.kind?.const === 'group'),
    false,
    'the deepest layer drops the group arm, which is what terminates the recursion',
  );
  assert.equal(JSON.stringify(deepest).includes('SceneShotSpecV2LayerDepth'), false);
  assert.ok(schemas.SceneShotSpecV2JsonValue);
});

test('vendoring an already-vendored spec changes nothing', () => {
  const once = vendorSceneSchema(live(), canonical);
  assert.deepEqual(vendorSceneSchema(once, canonical), once);
});

test('the input spec is not mutated', () => {
  const input = live();
  vendorSceneSchema(input, canonical);
  assert.deepEqual(input, live());
});

// The gate derives the canonical from the spec under test, so a change to the
// live scene schema has to reach the vendored output. Deriving it from a fixed
// source instead made both sides identical by construction and the gate blind.
test('a new layer arm in the spec changes the vendored components', () => {
  const sceneOf = (spec) => {
    const schemas = vendorSceneSchema(spec, sceneCanonicalFromSpec(spec)).components.schemas;
    return Object.fromEntries(Object.entries(schemas).filter(([name]) => name.startsWith('SceneShotSpecV2')));
  };

  const widened = live();
  widened.components.schemas.__schema0.anyOf.push({
    type: 'object',
    properties: { kind: { const: 'hologram' } },
  });

  assert.notDeepEqual(sceneOf(widened), sceneOf(live()));
  assert.equal(JSON.stringify(sceneOf(widened)).includes('hologram'), true);
  assert.equal(JSON.stringify(sceneOf(live())).includes('hologram'), false);
});

test('deriving a canonical from an already-vendored spec fails loudly', () => {
  const vendored = vendorSceneSchema(live(), canonical);
  assert.throws(() => sceneCanonicalFromSpec(vendored), /does not carry the generator's scene schema/);
});

// ---- the inverse ---------------------------------------------------------------------------
import { createHash } from 'node:crypto';
import { isVendoredSceneSpec, unvendorSceneSchema, unvendoredSerializations } from './vendor-scene-schema.mjs';

// The form the private contract sync writes: the generator's SceneShotSpecV2 (refs to the
// recursion carriers) with the carriers themselves deleted, sitting mid-way through the
// components — NOT at the end, where vendoring would leave it.
const synced = () => {
  const { __schema0: _l, __schema1: _p, ...keep } = live().components.schemas;
  const { SceneShotSpecV2, Project } = keep;
  return {
    openapi: '3.1.0',
    components: { schemas: { Project, SceneShotSpecV2, Render: { type: 'object' }, Media: { type: 'string' } } },
  };
};
const sha = (text) => createHash('sha256').update(text).digest('hex');
const serialize = (doc) => `${JSON.stringify(doc, null, 2)}\n`;

test('unvendor(vendor(x)) deep-equals x', () => {
  const vendored = vendorSceneSchema(synced(), canonical);
  assert.equal(isVendoredSceneSpec(vendored), true);
  assert.equal(isVendoredSceneSpec(synced()), false);
  const back = unvendorSceneSchema(vendored);
  assert.deepEqual(back, synced());
  assert.deepEqual(Object.keys(back.components.schemas).filter((n) => n.startsWith('__schema')), [], 'the carriers stay deleted, as the sync leaves them');
  assert.equal(JSON.stringify(vendored), JSON.stringify(vendorSceneSchema(synced(), canonical)), 'the vendored input is not mutated');
});

test('one of the un-vendored serializations reproduces the synced bytes, position included', () => {
  const expected = serialize(synced());
  const vendored = vendorSceneSchema(synced(), canonical);
  const candidates = [...unvendoredSerializations(vendored)];
  assert.equal(candidates.length, Object.keys(synced().components.schemas).length, 'one candidate per slot');
  const hit = candidates.find(({ text }) => sha(text) === sha(expected));
  assert.ok(hit, 'no candidate hashes to the synced document');
  assert.equal(hit.text, expected);
  assert.equal(hit.index, 1, 'SceneShotSpecV2 was the second component in the synced form');
});

test('un-vendoring a spec that was never vendored fails loudly', () => {
  assert.throws(() => unvendorSceneSchema(synced()), /does not carry the vendored scene components/);
});
