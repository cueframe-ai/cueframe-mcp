
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { ExitCode, type ExitCodeValue } from './exitCodes.js';

const CONFIG_DIR = join(homedir(), '.cueframe');
const AUTH_FILE = join(CONFIG_DIR, 'auth.json');

// The public targets. Any other host is reached through CUEFRAME_API_URL, which wins below.
const API_URLS: Record<string, string> = {
  local: 'http://127.0.0.1:3211',
  prod: 'https://api.cueframe.ai',
};

const DEFAULT_TARGET = 'prod';

export function resolveApiUrl(target: string = DEFAULT_TARGET): string {
  return process.env.CUEFRAME_API_URL ?? API_URLS[target] ?? API_URLS.prod;
}

interface AuthConfig {
  targets: Record<
    string,
    {
      apiKey: string;
      apiUrl: string;
    }
  >;
}

export class AuthStoreError extends Error {
  readonly exitCode: ExitCodeValue = ExitCode.UserError;
  constructor(readonly code: 'auth_missing' | 'auth_config_corrupt' | 'auth_invalid', message: string) {
    super(message);
    this.name = 'AuthStoreError';
  }
}

export function assertStaticApiKey(apiKey: string): void {
  if (!/^cf_(?:live|test)_[A-Za-z0-9_-]{8,}$/.test(apiKey)) {
    throw new AuthStoreError(
      'auth_invalid',
      'Invalid API key. Expected a key beginning with cf_live_ or cf_test_.',
    );
  }
}

function loadConfig(): AuthConfig {
  if (!existsSync(AUTH_FILE)) {
    return { targets: {} };
  }
  const raw = readFileSync(AUTH_FILE, 'utf-8');
  try {
    return JSON.parse(raw) as AuthConfig;
  } catch {
    throw new AuthStoreError(
      'auth_config_corrupt',
      `${AUTH_FILE} is corrupt and cannot be parsed. Delete it and re-run \`cueframe login\`.`,
    );
  }
}

function saveConfig(config: AuthConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(AUTH_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function saveAuth(
  apiKey: string,
  target: string = 'prod',
  apiUrl?: string,
): void {
  const config = loadConfig();
  const defaultUrl = API_URLS[target] ?? API_URLS.prod;
  config.targets[target] = {
    apiKey,
    apiUrl: apiUrl ?? defaultUrl,
  };
  saveConfig(config);
}

export function loadAuth(target: string = 'prod'): {
  apiKey: string;
  apiUrl: string;
} {
  const envKey = process.env.CUEFRAME_API_KEY;

  const envUrl = process.env.CUEFRAME_API_URL;
  if (envKey) {
    return {
      apiKey: envKey,
      apiUrl: envUrl ?? API_URLS[target] ?? API_URLS.prod,
    };
  }

  const config = loadConfig();
  const auth = config.targets[target];
  if (!auth) {
    throw new AuthStoreError(
      'auth_missing',
      `No auth configured for target "${target}". Run \`cueframe login --target ${target}\` (browser sign-in) or \`cueframe auth <api-key> --target ${target}\` (CI / headless).`,
    );
  }
  return auth;
}
