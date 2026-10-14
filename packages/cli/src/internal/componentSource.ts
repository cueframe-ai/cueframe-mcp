import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createComponentBody } from '@cueframe/sdk/zod';
import type { ComponentCreateRequestSource } from '@cueframe/sdk';
import { componentDir, type Workspace } from './workspace.js';
import { readComponentManifest } from './componentManifest.js';


const retired = (message: string) => Object.assign(new Error(message), { code: 'component_source_retired' });
const invalid = (message: string) => Object.assign(new Error(message), { code: 'invalid_component_definition' });

/** An explicit declaration for the blank scaffold only, never a migration default. */
export function scaffoldDefinition(): ComponentCreateRequestSource['definition'] {
  return {
    inputSchema: { type: 'object' },
    defaults: {},
    timing: { defaultDuration: { frames: 90, fps: 30 } },
    brandBindings: [],
    capabilities: [{ kind: 'clip' }],
  };
}

/**
 * The blank native template: one HyperFrames sub-composition whose script ends in one
 * `__cfScene.mount(...)`. `data-composition-variables` projects the definition's scalar
 * inputs and the manifest's slots; the scaffold declares neither, so it is `[]`.
 */
export function scaffoldTemplate(id: string): string {
  return [
    `<template><div id="root" data-composition-id="${id}" data-width="1920" data-height="1080" data-no-timeline data-composition-variables='[]'><div data-cf-scene></div></div><script>`,
    'const { h, MediaTileScene } = __cfScene;',
    'function Component() { return h(MediaTileScene, { streams: {}, tiles: [] }); }',
    `__cfScene.mount({ root: document.getElementById('root'), component: Component, variables: __hyperframes.getVariables() });`,
    '</script></template>',
    '',
  ].join('\n');
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
