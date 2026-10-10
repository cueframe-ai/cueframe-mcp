
import ora, { type Ora } from 'ora';
import pino from 'pino';
import { formatError } from './sdkClient.js';

export interface JsonOpt {
  json?: boolean;
}

export const SCHEMA_VERSION = 'v1' as const;

const logger = pino({
  level: 'trace',
  base: { schemaVersion: SCHEMA_VERSION },
  messageKey: 'event',
  timestamp: () => `,"ts":${Date.now()}`,
  formatters: {
    level: () => ({ _: 0 }),
  },
});

export function spinner(text: string, json: boolean | undefined): Ora {
  return ora({ text, isSilent: !!json }).start();
}

export function emitEvent(
  opts: JsonOpt,
  event: string,
  payload: Record<string, unknown> = {},
): void {
  if (!opts.json) return;
  logger.info(payload, event);
}

export function emitResult(
  opts: JsonOpt,
  payload: unknown,
  human: () => void,
): void {
  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  human();
}

export function emitError(
  opts: JsonOpt,
  phase: string,
  err: unknown,
  exitCode: number,
): void {
  const message = err instanceof Error ? err.message : String(err);
  const code =
    typeof (err as { code?: unknown })?.code === 'string'
      ? (err as { code: string }).code
      : undefined;
  const status = (err as { status?: number })?.status;
  if (opts.json) {
    logger.info(
      {
        phase,
        message,
        ...(code ? { code } : {}),
        ...(typeof status === 'number' ? { status } : {}),
        exitCode,
      },
      'error',
    );
  } else {
    process.stderr.write(`✖ ${phase}: ${formatError(err)}\n`);
  }
}

export function emitErrorJson(
  opts: JsonOpt,
  phase: string,
  err: unknown,
  exitCode: number,
): void {
  if (!opts.json) return;
  emitError(opts, phase, err, exitCode);
}

export function info(line: string, opts: JsonOpt): void {
  if (!opts.json) console.log(line);
}
