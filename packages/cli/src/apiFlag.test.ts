import { afterEach, expect, it, vi } from 'vitest';
import { main } from './index.js';
import { apiCommand } from './commands/api.js';

vi.mock('./commands/api.js', () => ({ apiCommand: vi.fn() }));
const originalArgv = process.argv;
afterEach(() => {
  process.argv = originalArgv;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('registers and forwards the opt-in API request timeout from the actual CLI', async () => {
  vi.stubGlobal('__CLI_VERSION__', 'test');
  process.argv = ['node', 'cueframe', '--json', 'api', 'GET', '/v1/registry/items', '--timeout-ms', '170000'];
  await main();
  expect(apiCommand).toHaveBeenCalledWith('GET', '/v1/registry/items', expect.objectContaining({ timeoutMs: '170000', json: true }));
});
