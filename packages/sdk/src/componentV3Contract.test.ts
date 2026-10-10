import { expect, it } from 'vitest';
import { CompositionOp } from './generated/zod/models/compositionOp.zod';
import { ComponentSourceResponse } from './generated/zod/models/componentSourceResponse.zod';
import { CompositionReadResponse } from './generated/zod/models/compositionReadResponse.zod';

const pin = 'a'.repeat(64), destination = 'b'.repeat(64);
const execution = { version: 3, componentId: 'title', sourceVersionId: pin, params: { title: 'Hello', nested: { enabled: true, stops: [1, null] } }, seed: 'stable' };

it('round trips a complete V3 repin and rejects incomplete destination admissions', () => {
  const op = { type: 'component.repin-v3', componentId: 'title', from: pin, to: destination, expectedCompositionEtag: 'etag', changes: [{ placementId: 'clip', before: execution, after: { ...execution, sourceVersionId: destination } }] };
  expect(CompositionOp.parse(op)).toEqual(op);
  expect(CompositionOp.safeParse({ ...op, changes: [{ ...op.changes[0], after: { ...execution, sourceVersionId: 'invalid' } }] }).success).toBe(false);
  expect(CompositionOp.safeParse({ ...op, expectedCompositionEtag: undefined }).success).toBe(false);
});

it('preserves immutable source snapshots and unresolved historical discovery metadata', () => {
  const manifest = { version: 2, assets: {}, graphics: { api: 'canvas2d', required: true, accelerationPreference: 'software-allowed' }, alphaPolicy: 'allows-opaque' };
  const snapshot = { version: 3, componentId: 'title', tsxSource: 'export default () => null', manifest, definition: { inputSchema: { type: 'object' }, defaults: {}, brandBindings: [], timing: { defaultDuration: { frames: 90, fps: 30 } }, capabilities: [{ kind: 'clip' }] } };
  const response = { id: 'title', source: 'installed', tsxSource: snapshot.tsxSource, propSchema: {}, manifest, metadataStatus: 'unresolved', sourceVersionId: pin, sourceSnapshot: snapshot };
  expect(ComponentSourceResponse.parse(response)).toEqual(response);
  expect(ComponentSourceResponse.safeParse({ ...response, sourceSnapshot: { ...snapshot, definition: undefined } }).success).toBe(false);
});

it('preserves dependency-read tokens, revisions and brand authority in composition reads', () => {
  const response = { composition: { v: 1, format: { aspectRatio: '16:9' }, tracks: [] }, composition_id: 'composition', revision: 7, dependencies: { mode: 'guarded', basis: [{ key: 'clip:clip', token: 'immutable-token' }], absentClipToken: 'null' }, expectedBrandIdentity: pin };
  expect(CompositionReadResponse.parse(response)).toMatchObject(response);
  expect(CompositionReadResponse.safeParse({ ...response, dependencies: { ...response.dependencies, absentClipToken: 'undefined' } }).success).toBe(false);
});
