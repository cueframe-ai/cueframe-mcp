import { describe, expect, it } from 'vitest';
import { assertStaticApiKey, AuthStoreError } from './auth.js';

describe('assertStaticApiKey', () => {
  it.each([
    'cf_live_12345678',
    'cf_test_abcdefgh',
    'cf_live_key-with_mixed-separators',
  ])('accepts a static CueFrame key: %s', (key) => {
    expect(() => assertStaticApiKey(key)).not.toThrow();
  });

  it.each(['status', 'live_12345678', 'cf_live_', ''])('refuses a value that would corrupt stored auth: %s', (key) => {
    let thrown: unknown;
    try {
      assertStaticApiKey(key);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AuthStoreError);
    expect(thrown).toMatchObject({ code: 'auth_invalid', exitCode: 2 });
  });
});
