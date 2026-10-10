
import { emitError } from './output.js';
import { ExitCode, exitWith } from './exitCodes.js';
import type { JsonOpt } from './output.js';

function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
}

export function assertCleanIdentifier(
  value: string,
  label: string,
  opts: JsonOpt,
): void {
  if (value.length === 0) {
    fail(`${label} is empty.`, opts);
  }
  if (hasControlChar(value)) {
    fail(
      `${label} contains a control character (newline, tab, or null byte). ` +
        `Identifiers must be plain text — check for a stray copy-paste artifact.`,
      opts,
    );
  }
}

function fail(message: string, opts: JsonOpt): never {
  emitError(opts, 'preflight', new Error(message), ExitCode.UserError);
  exitWith(ExitCode.UserError);
}
