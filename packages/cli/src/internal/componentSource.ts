import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createComponentBody } from '@cueframe/sdk/zod';
import { BLANK_COMPONENT_SOURCE_V4, type ComponentCreateRequestSource } from '@cueframe/sdk';
import { componentDir, type Workspace } from './workspace.js';
import { readComponentManifest } from './componentManifest.js';


const retired = (message: string) => Object.assign(new Error(message), { code: 'component_source_retired' });
const invalid = (message: string) => Object.assign(new Error(message), { code: 'invalid_component_definition' });

/**
 * The contract's blank native source (BlankComponentSourceV4), renamed to `id`: its componentId and
 * its template root's data-composition-id change together, as the contract describes.
 */
export function blankComponentSource(id: string): ComponentCreateRequestSource {
  const root = `data-composition-id="${BLANK_COMPONENT_SOURCE_V4.componentId}"`;
  if (BLANK_COMPONENT_SOURCE_V4.template.split(root).length !== 2) {
    throw invalid(`The contract's blank component template does not carry exactly one ${root}.`);
  }
  const blank = structuredClone(BLANK_COMPONENT_SOURCE_V4);
  return { ...blank, componentId: id, template: blank.template.replace(root, `data-composition-id="${id}"`) };
}

/**
 * The workspace's native (version 4) source: template.html, definition.json and the
 * cueframe.json manifest, checked against the contract's source schema. The server's
 * admission (template lint, determinism, declarations) runs on push.
 */
export function readComponentSource(ws: Workspace, id: string): ComponentCreateRequestSource {
  const dir = componentDir(ws, id);
  const templatePath = join(dir, 'template.html');
  if (!existsSync(templatePath)) {
    if (existsSync(join(dir, 'index.tsx'))) {
      throw retired(`Component "${id}" is a version-3 TSX source, which CueFrame no longer accepts. Author it as a native template.html (cueframe new component ${id} --force scaffolds one) and declare its definition.json and manifest.`);
    }
    throw Object.assign(new Error(`Component "${id}" has no template.html at ${dir}. Scaffold it first: cueframe new component ${id}`), { code: 'no_component_source' });
  }
  const definitionPath = join(dir, 'definition.json');
  if (!existsSync(definitionPath)) {
    throw invalid(`Component "${id}" needs an explicit definition.json before publishing. Declare its inputSchema, defaults, timing, brandBindings and capabilities.`);
  }
  let definition: unknown;
  try { definition = JSON.parse(readFileSync(definitionPath, 'utf8')); }
  catch { throw invalid(`Invalid JSON in ${definitionPath}`); }
  const source = { version: 4, componentId: id, template: readFileSync(templatePath, 'utf8'), manifest: readComponentManifest(ws, id), definition };
  const parsed = createComponentBody.shape.source.safeParse(source);
  if (!parsed.success) throw invalid(`Invalid native component source: ${parsed.error.message}`);
  return parsed.data;
}
