
import { createClient, ApiError, adviseError } from '@cueframe/sdk';
import { CLIENT_HEADER, formatClientHeader, osFromNodePlatform } from '@cueframe/sdk/client-identity';
import { loadAuth } from './auth.js';

declare const __CLI_VERSION__: string;

/** Names the CLI to the server, which cannot tell one HTTP client from another. */
export function clientHeaders(): Record<string, string> {
  return {
    [CLIENT_HEADER]: formatClientHeader({
      surface: 'cli',
      version: __CLI_VERSION__,
      os: osFromNodePlatform(process.platform),
    }),
  };
}

export function initSdk(target: string, options: { timeoutMs?: number } = {}): void {
  const { apiKey, apiUrl } = loadAuth(target);
  createClient({ baseUrl: apiUrl, apiKey, headers: clientHeaders(), ...options });
}

export function formatError(err: unknown): string {
  const head =
    err instanceof ApiError
      ? `${err.message} (${err.code}${err.status ? `, ${err.status}` : ''})`
      : err instanceof Error
        ? err.message
        : String(err);
  const advice = adviseError(err);
  return advice ? `${head}\n  → ${advice}` : head;
}

export { ApiError };
