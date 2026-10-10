import { describe, it, expect, vi, afterEach } from 'vitest';
import { CLIENT_HEADER, osFromNodePlatform, parseClientHeader } from '@cueframe/sdk/client-identity';
import { loginCommand } from './login.js';

declare const __CLI_VERSION__: string;

vi.mock('open', () => ({ default: async () => undefined }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cueframe login', () => {
  it('names the CLI on the device flow, not only on /v1', async () => {
    const sent: Headers[] = [];
    vi.stubGlobal('fetch', async (input: unknown, init?: { headers?: HeadersInit }) => {
      sent.push(new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)));
      // Ending the command at the first leg keeps the assertion on the request.
      return new Response(JSON.stringify({ message: 'stop here' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('__exit__');
    }) as never);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(loginCommand({ target: 'prod', json: true })).rejects.toThrow('__exit__');

    expect(sent).toHaveLength(1);
    expect(parseClientHeader(sent[0].get(CLIENT_HEADER))).toEqual({
      surface: 'cli',
      version: __CLI_VERSION__,
      os: osFromNodePlatform(process.platform),
    });
  });
});
