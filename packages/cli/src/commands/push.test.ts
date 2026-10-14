import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pushCommand, syncCommand } from './push';
import { components, ApiError } from '@cueframe/sdk';
import { createComponentBody, updateComponentBody } from '@cueframe/sdk/zod';
import * as sdkClient from '../remote/sdkClient.js';
import { scaffoldDefinition, scaffoldTemplate } from '../internal/componentSource.js';
import { DEFAULT_COMPONENT_MANIFEST_V4 } from '../internal/componentManifest.js';

function setupSpies() {
  vi.spyOn(sdkClient, 'initSdk').mockImplementation(() => {});
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('__exit__');
  }) as any);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const stderrChunks: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((s: any) => {
    stderrChunks.push(typeof s === 'string' ? s : String(s));
    return true;
  }) as any);
  return { exitSpy, stderrChunks };
}

function run(fn: () => Promise<unknown>, exitSpy: ReturnType<typeof vi.spyOn>): Promise<number> {
  return fn()
    .catch((e: any) => {
      if (e?.message !== '__exit__') throw e;
    })
    .then(() => {
      const last = exitSpy.mock.calls.at(-1);
      return last === undefined ? 0 : (last[0] as number);
    });
}

const TEMPLATE = scaffoldTemplate('my-badge');

const CONFIG_TS = `import { z } from 'zod';
import component from './index';
const paramsSchema = z.object({}).passthrough();
export const config = {
  id: 'my-badge',
  component,
  name: 'My Badge',
  category: 'ui-blocks',
  kind: 'component',
  version: '0.2.0',
  paramsSchema,
};
export default config;
`;

describe('cueframe push / sync', () => {
  const dirs: string[] = [];
  let spies: ReturnType<typeof setupSpies>;

  function workspace(opts: { manifest?: Record<string, unknown> } = {}): string {
    const root = mkdtempSync(join(tmpdir(), 'cf-push-'));
    dirs.push(root);
    writeFileSync(
      join(root, 'cueframe.json'),
      JSON.stringify(opts.manifest ?? {
        componentsDir: 'cueframe/components',
        components: { 'my-badge': { manifest: DEFAULT_COMPONENT_MANIFEST_V4 } },
      }),
    );
    const cdir = join(root, 'cueframe', 'components', 'my-badge');
    mkdirSync(cdir, { recursive: true });
    writeFileSync(join(cdir, 'template.html'), TEMPLATE);
    writeFileSync(join(cdir, 'config.ts'), CONFIG_TS);
    writeFileSync(join(cdir, 'definition.json'), JSON.stringify(scaffoldDefinition()));
    return root;
  }

  function bareDir(): string {
    const d = mkdtempSync(join(tmpdir(), 'cf-push-bare-'));
    dirs.push(d);
    return d;
  }

  function inDir(root: string) {
    vi.spyOn(process, 'cwd').mockReturnValue(root);
  }

  beforeEach(() => {
    spies = setupSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('push CREATES with the native source, ownership, and the version-4 manifest', async () => {
    inDir(workspace());
    vi.spyOn(components, 'getComponent').mockRejectedValue(
      new ApiError(404, { code: 'not_found', message: 'no such component' }),
    );
    const create = vi.spyOn(components, 'createComponent').mockResolvedValue({ id: 'my-badge' } as any);
    const update = vi.spyOn(components, 'updateComponent').mockResolvedValue({ id: 'my-badge' } as any);

    const code = await run(() => pushCommand('my-badge', { target: 'prod' }), spies.exitSpy);
    expect(code).toBe(0);
    expect(update).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    const body = create.mock.calls[0][0];
    expect(createComponentBody.safeParse(body)).toMatchObject({ success: true });
    expect(body.componentId).toBe('my-badge');
    expect(body.source && 'template' in body.source && body.source.template).toBe(TEMPLATE);
    expect(body.source?.version).toBe(4);
    expect(body.source?.definition).toEqual(scaffoldDefinition());
    expect(body).not.toHaveProperty('tsxSource');
    expect(body.origin).toBe('customer-owned');
    expect(body.source?.manifest).toEqual(DEFAULT_COMPONENT_MANIFEST_V4);
    expect(body.name).toBe('My Badge');
    expect(body.category).toBe('ui-blocks');
  });

  it('push UPDATES in place when the component already exists', async () => {
    inDir(workspace());
    vi.spyOn(components, 'getComponent').mockResolvedValue({ id: 'my-badge' } as any);
    const create = vi.spyOn(components, 'createComponent').mockResolvedValue({ id: 'my-badge' } as any);
    const update = vi.spyOn(components, 'updateComponent').mockResolvedValue({ id: 'my-badge' } as any);

    const code = await run(() => pushCommand('my-badge', { target: 'prod' }), spies.exitSpy);
    expect(code).toBe(0);
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toBe('my-badge');
    expect(updateComponentBody.safeParse(update.mock.calls[0][1])).toMatchObject({ success: true });
    const updated = update.mock.calls[0][1].source;
    expect(updated && 'template' in updated && updated.template).toBe(TEMPLATE);
    expect(update.mock.calls[0][1].origin).toBe('customer-owned');
    expect(update.mock.calls[0][1].source?.manifest).toEqual(DEFAULT_COMPONENT_MANIFEST_V4);
  });

  it('push carries ejectedFrom from the manifest when present', async () => {
    inDir(
      workspace({
        manifest: {
          componentsDir: 'cueframe/components',
          components: {
            'my-badge': {
              ejectedFrom: 'catalog:my-badge',
              primitiveVersion: '0.1.0',
              manifest: DEFAULT_COMPONENT_MANIFEST_V4,
            },
          },
        },
      }),
    );
    vi.spyOn(components, 'getComponent').mockRejectedValue(
      new ApiError(404, { code: 'not_found', message: 'no such component' }),
    );
    const create = vi.spyOn(components, 'createComponent').mockResolvedValue({ id: 'my-badge' } as any);

    const code = await run(() => pushCommand('my-badge', { target: 'prod' }), spies.exitSpy);
    expect(code).toBe(0);
    expect(create.mock.calls[0][0].ejectedFrom).toBe('catalog:my-badge');
  });

  it('sync pushes ALL components in the workspace', async () => {
    const root = workspace();
    const cdir2 = join(root, 'cueframe', 'components', 'lower-third');
    mkdirSync(cdir2, { recursive: true });
    writeFileSync(join(cdir2, 'template.html'), scaffoldTemplate('lower-third'));
    writeFileSync(join(cdir2, 'definition.json'), JSON.stringify(scaffoldDefinition()));
    writeFileSync(join(cdir2, 'config.ts'), CONFIG_TS.replace('my-badge', 'lower-third'));
    const workspaceManifestPath = join(root, 'cueframe.json');
    const workspaceManifest = JSON.parse(readFileSync(workspaceManifestPath, 'utf8'));
    workspaceManifest.components['lower-third'] = { manifest: DEFAULT_COMPONENT_MANIFEST_V4 };
    writeFileSync(workspaceManifestPath, JSON.stringify(workspaceManifest));
    inDir(root);

    vi.spyOn(components, 'getComponent').mockRejectedValue(
      new ApiError(404, { code: 'not_found', message: 'no such component' }),
    );
    const create = vi.spyOn(components, 'createComponent').mockResolvedValue({ id: 'x' } as any);

    const code = await run(() => syncCommand({ target: 'prod' }), spies.exitSpy);
    expect(code).toBe(0);
    expect(create).toHaveBeenCalledTimes(2);
    const ids = create.mock.calls.map((c) => c[0].componentId).sort();
    expect(ids).toEqual(['lower-third', 'my-badge']);
  });

  it('refuses to push a component without a version-4 manifest', async () => {
    inDir(workspace({ manifest: { componentsDir: 'cueframe/components' } }));
    const create = vi.spyOn(components, 'createComponent').mockResolvedValue({ id: 'my-badge' } as any);

    const code = await run(() => pushCommand('my-badge', { target: 'prod' }), spies.exitSpy);

    expect(code).toBe(2);
    expect(create).not.toHaveBeenCalled();
    expect(spies.stderrChunks.join('')).toContain('native (version 4) manifest');
  });

  it('refuses an old workspace without a definition before any API call', async () => {
    const root = workspace();
    rmSync(join(root, 'cueframe/components/my-badge/definition.json'));
    inDir(root);
    const get = vi.spyOn(components, 'getComponent');
    const create = vi.spyOn(components, 'createComponent');
    const code = await run(() => pushCommand('my-badge', { target: 'prod' }), spies.exitSpy);
    expect(code).toBe(2);
    expect(get).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(spies.stderrChunks.join('')).toContain('explicit definition.json');
  });

  it('refuses a version-3 TSX component as retired before any API call', async () => {
    const root = workspace();
    const cdir = join(root, 'cueframe/components/my-badge');
    rmSync(join(cdir, 'template.html'));
    writeFileSync(join(cdir, 'index.tsx'), 'export default function MyBadge() { return null; }\n');
    inDir(root);
    const get = vi.spyOn(components, 'getComponent');
    const code = await run(() => pushCommand('my-badge', { target: 'prod' }), spies.exitSpy);
    expect(code).toBe(2);
    expect(get).not.toHaveBeenCalled();
    expect(spies.stderrChunks.join('')).toContain('version-3 TSX source');
  });

  it('push with no workspace → UserError (exit 2) telling the user to run init', async () => {
    inDir(bareDir());
    const code = await run(() => pushCommand('my-badge', { target: 'prod' }), spies.exitSpy);
    expect(code).toBe(2);
    expect(spies.stderrChunks.join('')).toMatch(/cueframe init/);
  });

  it('push with no id → UserError (exit 2)', async () => {
    inDir(workspace());
    const code = await run(() => pushCommand(undefined, { target: 'prod' }), spies.exitSpy);
    expect(code).toBe(2);
  });
});
