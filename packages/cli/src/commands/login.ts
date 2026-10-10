
import open from 'open';
import { createAuthClient } from 'better-auth/client';
import { deviceAuthorizationClient } from 'better-auth/client/plugins';
import { saveAuth, resolveApiUrl } from '../remote/auth.js';
import { clientHeaders } from '../remote/sdkClient.js';
import { ExitCode, exitWith } from '../remote/exitCodes.js';
import { emitResult, spinner as oraSpinner, info } from '../remote/output.js';

interface DeviceCodeResult {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  interval: number;
  expires_in: number;
}

interface DeviceTokenSuccess {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface DeviceTokenError {
  error: 'authorization_pending' | 'slow_down' | 'access_denied' | 'expired_token' | string;
  error_description?: string;
}

export async function loginCommand(opts: { target: string; url?: string; json?: boolean }) {
  const apiUrl = resolveApiUrl(opts.target);
  const authClient = createAuthClient({
    baseURL: apiUrl,
    // The session the server writes here is the only record of which client
    // signed in, so the device flow names the CLI exactly as /v1 calls do.
    fetchOptions: { headers: clientHeaders() },
    plugins: [deviceAuthorizationClient()],
  });

  const start = oraSpinner('Requesting device code…', opts.json);
  let device: DeviceCodeResult;
  try {
    const { data, error } = await (authClient as any).device.code({
      client_id: 'cueframe-cli',
      scope: 'openid profile email',
    });
    if (error || !data) {
      start.fail(`Could not start login: ${error?.message ?? 'unknown error'}`);
      exitWith(ExitCode.NetworkError);
    }
    device = data as DeviceCodeResult;
  } catch (err) {
    start.fail(`Could not start login: ${err instanceof Error ? err.message : String(err)}`);
    exitWith(ExitCode.NetworkError);
  }
  start.succeed('Device code issued');

  const verifyUri = device.verification_uri_complete ?? device.verification_uri;
  info('', opts);
  info(`  Visit: ${verifyUri}`, opts);
  info(`  Code:  ${device.user_code}`, opts);
  info('', opts);

  try {
    await open(verifyUri);
  } catch {
  }

  const poll = oraSpinner('Waiting for approval in browser…', opts.json);
  const deadline = Date.now() + device.expires_in * 1000;
  let intervalMs = device.interval * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const { data, error } = await (authClient as any).device.token({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: device.device_code,
        client_id: 'cueframe-cli',
      });

      if (data?.access_token) {
        const token = (data as DeviceTokenSuccess).access_token;
        saveAuth(token, opts.target, opts.url);
        poll.succeed(`Logged in. Token saved for target "${opts.target}".`);
        emitResult(opts, { ok: true, target: opts.target, apiUrl }, () => {});
        return;
      }

      const err = (data ?? error) as DeviceTokenError | undefined;
      const code = err?.error;
      if (code === 'authorization_pending') {
      } else if (code === 'slow_down') {
        intervalMs += 5000;
      } else if (code === 'access_denied') {
        poll.fail('Access denied in the browser.');
        exitWith(ExitCode.UserError);
      } else if (code === 'expired_token') {
        poll.fail('Device code expired before approval. Run `cueframe login` again.');
        exitWith(ExitCode.UserError);
      } else if (code) {
        poll.fail(`Login failed: ${err?.error_description ?? code}`);
        exitWith(ExitCode.ApiClientError);
      }
    } catch {
    }
  }

  poll.fail('Timed out waiting for approval. Run `cueframe login` again.');
  exitWith(ExitCode.UserError);
}
