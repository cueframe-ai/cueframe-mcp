
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, parse as parsePath } from 'node:path';
import { z } from 'zod';

export const DEFAULT_COMPONENTS_DIR = 'cueframe/components';

export const CACHE_DIR_NAME = '.cueframe';

export const MANIFEST_FILENAME = 'cueframe.json';

export const CueframeManifest = z
  .object({
    componentsDir: z.string().min(1).default(DEFAULT_COMPONENTS_DIR),
  })
  .passthrough();

export type CueframeManifest = z.infer<typeof CueframeManifest>;

export interface Workspace {
  root: string;
  manifest: CueframeManifest;
}

export function defaultManifest(): CueframeManifest {
  return CueframeManifest.parse({});
}

export function findWorkspace(startDir: string): Workspace | null {
  let dir = startDir;
  const fsRoot = parsePath(dir).root;
  for (;;) {
    const manifestPath = join(dir, MANIFEST_FILENAME);
    if (existsSync(manifestPath)) {
      const raw = readFileSync(manifestPath, 'utf8');
      const manifest = CueframeManifest.parse(JSON.parse(raw));
      return { root: dir, manifest };
    }
    if (dir === fsRoot) return null;
    dir = dirname(dir);
  }
}

export function componentsRoot(ws: Workspace): string {
  return join(ws.root, ws.manifest.componentsDir);
}

export function componentDir(ws: Workspace, id: string): string {
  return join(componentsRoot(ws), id);
}

export function cacheDir(ws: Workspace): string {
  return join(ws.root, CACHE_DIR_NAME);
}

export function listComponents(ws: Workspace): string[] {
  const dir = componentsRoot(ws);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((entry) => {
      const candidate = join(dir, entry);
      if (!statSync(candidate).isDirectory()) return false;
      return (
        existsSync(join(candidate, 'index.tsx')) && existsSync(join(candidate, 'config.ts'))
      );
    })
    .sort();
}
