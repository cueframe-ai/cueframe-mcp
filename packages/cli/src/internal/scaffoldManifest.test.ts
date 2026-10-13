import { describe, expect, it } from 'vitest';
import { createComponentBody } from '@cueframe/sdk/zod';
import { SCAFFOLD_COMPONENT_MANIFEST_V2 } from './scaffoldManifest.js';

// The public contract's ComponentManifestV2 schema, reached through the body
// `cueframe push` sends (its version-3 source arm): the zod barrel exports
// operation bodies, not models.
const ComponentManifestV2 = createComponentBody.shape.source.options[0].shape.manifest;

describe('scaffold manifest', () => {
  it('is a manifest the public contract accepts', () => {
    expect(ComponentManifestV2.safeParse(SCAFFOLD_COMPONENT_MANIFEST_V2).success).toBe(true);
  });
});
