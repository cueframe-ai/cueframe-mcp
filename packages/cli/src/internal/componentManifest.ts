import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { createComponentBody } from '@cueframe/sdk/zod';
import type { Workspace } from './workspace.js';

const refusal = (code: string, message: string) => Object.assign(new Error(message), { code });

/** cueframe.json's entry for one component, as written. */
function componentEntry(ws: Workspace, id: string): Record<string, unknown> {
  const path = join(ws.root, 'cueframe.json');
  if (!existsSync(path)) throw refusal('no_component_manifest', 'No cueframe.json workspace manifest was found.');
  let workspace: { components?: Record<string, Record<string, unknown>> };
  try {
    workspace = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw refusal('invalid_workspace_manifest', `cueframe.json is not valid JSON: ${(error as Error).message}`);
  }
  const entry = workspace.components?.[id];
  if (!entry) throw refusal('no_component_manifest', `Component "${id}" has no entry at cueframe.json components.${id}.`);
  return entry;
}

// The server admits every manifest on push (POST /v1/components); the CLI
// carries no copy of that contract and reads the manifest as written.
/** The manifest as written; readComponentSource validates it with the rest of the source. */
export function readComponentManifest(ws: Workspace, id: string): unknown {
  const manifest = componentEntry(ws, id).manifest;
  if (manifest === undefined || manifest === null) {
    throw refusal('no_component_manifest', `Component "${id}" has no native (version 4) manifest at cueframe.json components.${id}.manifest.`);
  }
  return manifest;
}

const ComponentMetadata = z.object({
  name: createComponentBody.shape.name,
  category: createComponentBody.shape.category,
  ejectedFrom: createComponentBody.shape.ejectedFrom,
});
export type ComponentMetadata = z.infer<typeof ComponentMetadata>;

/** The catalog metadata `push` sends: cueframe.json components.<id>.name and .category, both required. */
export function readComponentMetadata(ws: Workspace, id: string): ComponentMetadata {
  const { name, category, ejectedFrom } = componentEntry(ws, id);
  const parsed = ComponentMetadata.safeParse({ name, category, ejectedFrom });
  if (!parsed.success) {
    throw refusal(
      'invalid_component_metadata',
      `Component "${id}" needs a name and a category in cueframe.json components.${id}: ` +
        `"name" is the catalog title, "category" one of ${createComponentBody.shape.category.options.join(', ')}. ` +
        parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
    );
  }
  return parsed.data;
}
