import { describe, expect, it } from 'vitest';
import { createComponentBody } from '@cueframe/sdk/zod';
import { SCAFFOLD_COMPONENT_MANIFEST_V4 } from './scaffoldManifest.js';

// The public contract's native manifest schema, reached through the body
// `cueframe push` sends (its version-4 source arm): the zod barrel exports
// operation bodies, not models.
const ComponentManifestV4 = createComponentBody.shape.source.options[1].shape.manifest;

describe('scaffold manifest', () => {
  it('is a manifest the public contract accepts', () => {
    expect(ComponentManifestV4.safeParse(SCAFFOLD_COMPONENT_MANIFEST_V4).success).toBe(true);
  });
});
