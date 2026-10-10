import { afterEach, describe, expect, it, vi } from 'vitest';
import { projects } from '@cueframe/sdk';
import * as sdkClient from '../remote/sdkClient.js';
import { projectCreateCommand } from './project.js';

describe('projectCreateCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('binds the requested brand kit when creating a project', async () => {
    vi.spyOn(sdkClient, 'initSdk').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const create = vi.spyOn(projects, 'createProject').mockResolvedValue({
      id: 'project_1',
      name: 'Yosemite Peregrines',
    } as never);

    await projectCreateCommand({
      name: 'Yosemite Peregrines',
      target: 'prod',
      aspect: '16:9',
      fps: 30,
      resolution: 'fhd',
      brandKitId: 'brand_1',
      json: true,
    });

    expect(create).toHaveBeenCalledWith({
      name: 'Yosemite Peregrines',
      format: { aspectRatio: '16:9', fps: 30, resolution: 'fhd' },
      brandKitId: 'brand_1',
    });
  });
});
