import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createComponentBody } from '@cueframe/sdk/zod';
import type { ComponentCreateRequestSource } from '@cueframe/sdk';
import { componentDir, type Workspace } from './workspace.js';
import { readComponentManifestV2 } from './componentManifest.js';

export type LocalSourceV3 = ComponentCreateRequestSource;

/** An explicit declaration for the blank text scaffold only, never a migration default. */
export function scaffoldDefinition(text: string): LocalSourceV3['definition'] {
  return {
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, additionalProperties: false },
    defaults: { text },
    timing: { defaultDuration: { frames: 90, fps: 30 } },
    brandBindings: [],
    capabilities: [{ kind: 'clip' }],
  };
}

/** Preserve the complete authored definition; the generated API schema is the validator. */
export function readComponentSource(ws: Workspace, id: string, tsxSource: string): LocalSourceV3 {
  const file = join(componentDir(ws, id), 'definition.json');
  if (!existsSync(file)) {
    throw Object.assign(new Error(`Component "${id}" needs an explicit v3 definition.json before publishing. Declare its inputSchema, defaults, timing, brandBindings and capabilities; do not overwrite existing source with a new scaffold.`), { code: 'invalid_component_definition' });
  }
  let definition: unknown;
  try { definition = JSON.parse(readFileSync(file, 'utf8')); }
  catch { throw Object.assign(new Error(`Invalid JSON in ${file}`), { code: 'invalid_component_definition' }); }
  const source = { version: 3, componentId: id, tsxSource, manifest: readComponentManifestV2(ws, id), definition };
  const parsed = createComponentBody.shape.source.safeParse(source);
  if (!parsed.success) {
    throw Object.assign(new Error(`Invalid component v3 source: ${parsed.error.message}`), { code: 'invalid_component_definition' });
  }
  return parsed.data;
}
