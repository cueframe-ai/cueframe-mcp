
import { ApiError } from "@cueframe/sdk";

export const ExitCode = {
  Success: 0,
  UserError: 2,
  ApiClientError: 3,
  ApiServerError: 4,
  NetworkError: 5,
  PaymentRequired: 6,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export function exitCodeForError(err: unknown): ExitCodeValue {
  if (err instanceof ApiError) {
    if (err.status === 402) return ExitCode.PaymentRequired;
    if (err.status >= 500) return ExitCode.ApiServerError;
    if (err.status >= 400) return ExitCode.ApiClientError;
  }
  const declared = (err as { exitCode?: unknown } | null)?.exitCode;
  if (typeof declared === 'number') return declared as ExitCodeValue;
  return ExitCode.NetworkError;
}

export function exitCodeForStatus(status: number): ExitCodeValue {
  if (status === 402) return ExitCode.PaymentRequired;
  if (status >= 500) return ExitCode.ApiServerError;
  if (status >= 400) return ExitCode.ApiClientError;
  return ExitCode.Success;
}

export function exitWith(code: ExitCodeValue): never {
  process.exit(code);
}
