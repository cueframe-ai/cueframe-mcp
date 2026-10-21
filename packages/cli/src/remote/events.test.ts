import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLI_EVENTS } from './events';

const SRC = join(__dirname, '..');
const sources = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('events.ts'))
  .map((file) => readFileSync(join(SRC, file), 'utf8'))
  .join('\n');

describe('CLI_EVENTS', () => {
  it('names only events some command emits', () => {
    // The compiler proves every emitted event is declared; this proves every declared one is emitted.
    const unemitted = CLI_EVENTS.filter((event) => !sources.includes(`'${event}'`));
    expect(unemitted).toEqual([]);
  });
});
