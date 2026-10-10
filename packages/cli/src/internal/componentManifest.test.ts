import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultManifest, type Workspace } from './workspace.js';
import { DEFAULT_COMPONENT_MANIFEST_V2, readComponentManifestV2 } from './componentManifest.js';

/**
 * Every field the component-source response can carry in one manifest: named
 * asset slots of each kind, declared mime types, all three mediaDemand modes,
 * the webgl scene-shot graphics block and the sceneShot capability. A manifest
 * the API returns must survive the round trip API -> cueframe.json -> push
 * untouched; the server validates it on push.
 */
const API_MANIFEST = {
  version: 2,
  assets: {
    backdrop: {
      kind: 'image',
      required: true,
      mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      mediaDemand: { mode: 'original' },
    },
    plate: {
      kind: 'video',
      required: false,
      mimeTypes: ['video/mp4', 'video/webm'],
      mediaDemand: { mode: 'tier', tier: 2048 },
    },
    grade: {
      kind: 'data',
      required: false,
      mediaDemand: {
        mode: 'auto',
        maxProjectedWidthRatio: 1.5,
        maxProjectedHeightRatio: 1.5,
        minVisibleSourceWidthRatio: 1,
        minVisibleSourceHeightRatio: 1,
      },
    },
    vo: { kind: 'audio', required: false },
  },
  graphics: { api: 'webgl', required: true, accelerationPreference: 'hardware-preferred' },
  alphaPolicy: 'allows-opaque',
  sceneShot: { version: 2 },
};

const dirs: string[] = [];

function workspaceWith(manifest: unknown): Workspace {
  const root = mkdtempSync(join(tmpdir(), 'cf-manifest-'));
  dirs.push(root);
  writeFileSync(
    join(root, 'cueframe.json'),
    JSON.stringify({ componentsDir: 'cueframe/components', components: { badge: { manifest } } }),
  );
  return { root, manifest: defaultManifest() };
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('readComponentManifestV2 reads the manifest the server validates on push', () => {
  it('returns a manifest exactly as the API returns one', () => {
    const ws = workspaceWith(API_MANIFEST);
    expect(readComponentManifestV2(ws, 'badge')).toEqual(API_MANIFEST);
  });

  it('returns the manifest the CLI itself stamps', () => {
    const ws = workspaceWith(DEFAULT_COMPONENT_MANIFEST_V2);
    expect(readComponentManifestV2(ws, 'badge')).toEqual(DEFAULT_COMPONENT_MANIFEST_V2);
  });

  it('passes a manifest the server would refuse through unchanged; the server is the judge', () => {
    const manifest = { ...API_MANIFEST, assets: { '': { kind: 'image', required: true } } };
    const ws = workspaceWith(manifest);
    expect(readComponentManifestV2(ws, 'badge')).toEqual(manifest);
  });

  it('refuses a component with no manifest at all', () => {
    const ws = workspaceWith(undefined);
    expect(() => readComponentManifestV2(ws, 'badge')).toThrow(/contract-v2 manifest/);
    try {
      readComponentManifestV2(ws, 'badge');
    } catch (error) {
      expect((error as { code?: string }).code).toBe('no_component_manifest');
    }
  });
});
