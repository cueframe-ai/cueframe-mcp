import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ComponentManifestV2 } from '@cueframe/sdk';
import type { Workspace } from './workspace.js';
import { SCAFFOLD_COMPONENT_MANIFEST_V2 } from './scaffoldManifest.js';

// The server validates every manifest on push (POST /v1/components); the CLI
// carries no copy of that contract and reads the manifest as written.
export const DEFAULT_COMPONENT_MANIFEST_V2 = SCAFFOLD_COMPONENT_MANIFEST_V2;

export function readComponentManifestV2(ws: Workspace, id: string): ComponentManifestV2 {
  const path = join(ws.root, 'cueframe.json');
  if (!existsSync(path)) {
    throw Object.assign(new Error('No cueframe.json workspace manifest was found.'), {
      code: 'no_component_manifest',
    });
  }
  const workspace = JSON.parse(readFileSync(path, 'utf8')) as {
    components?: Record<string, { manifest?: unknown }>;
  };
  const manifest = workspace.components?.[id]?.manifest;
  if (manifest === undefined || manifest === null) {
    throw Object.assign(
      new Error(`Component "${id}" has no contract-v2 manifest at cueframe.json components.${id}.manifest.`),
      { code: 'no_component_manifest' },
    );
  }
  return manifest as ComponentManifestV2;
}
