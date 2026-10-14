import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kernelComponentProblems } from './check-kernel-components.mjs';

const artifact = { info: { version: '0.7.0' }, components: { schemas: { Format: { type: 'object', properties: { fps: { type: 'number' } } } } } };

test('a spec carrying the pinned kernel components verbatim passes', () => {
  const spec = { components: { schemas: { Format: structuredClone(artifact.components.schemas.Format), Other: {} } } };
  assert.deepEqual(kernelComponentProblems(spec, artifact, '0.7.0'), []);
});

test('a kernel component that differs from the pinned kernel fails, naming it', () => {
  const spec = { components: { schemas: { Format: { type: 'object' } } } };
  assert.match(kernelComponentProblems(spec, artifact, '0.7.0')[0], /components\.schemas\.Format differs from @cueframe\/kernel 0\.7\.0/);
});

test('a manifest kernelVersion other than the pinned kernel fails', () => {
  const spec = { components: { schemas: { Format: structuredClone(artifact.components.schemas.Format) } } };
  assert.match(kernelComponentProblems(spec, artifact, '0.6.0')[0], /pinned @cueframe\/kernel is 0\.7\.0.*kernelVersion 0\.6\.0/);
});
