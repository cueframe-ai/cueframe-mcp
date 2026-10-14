import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Workspace } from './workspace.js';

// The server admits every manifest on push (POST /v1/components); the CLI
// carries no copy of that contract and reads the manifest as written.
/** The manifest as written; readComponentSource validates it with the rest of the source. */
export function readComponentManifest(ws: Workspace, id: string): unknown {
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
      new Error(`Component "${id}" has no native (version 4) manifest at cueframe.json components.${id}.manifest.`),
      { code: 'no_component_manifest' },
    );
  }
  return manifest;
}
