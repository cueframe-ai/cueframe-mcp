import { describe, it, expect } from 'vitest';
import { deriveIdempotencyKey } from './idempotency';

describe('deriveIdempotencyKey', () => {
  it('produces a stable sha256-hex string', async () => {
    const key = await deriveIdempotencyKey('compose', ['p1', 'sug_x', 'auto']);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic across calls with the same inputs', async () => {
    const a = await deriveIdempotencyKey('compose', ['p1', 'sug_x', 'auto']);
    const b = await deriveIdempotencyKey('compose', ['p1', 'sug_x', 'auto']);
    expect(a).toBe(b);
  });

  it('changes when any part changes', async () => {
    const base = await deriveIdempotencyKey('compose', ['p1', 'sug_x', 'auto']);
    const diffProject = await deriveIdempotencyKey('compose', ['p2', 'sug_x', 'auto']);
    const diffSug = await deriveIdempotencyKey('compose', ['p1', 'sug_y', 'auto']);
    const diffSeed = await deriveIdempotencyKey('compose', ['p1', 'sug_x', 'manual']);
    expect(diffProject).not.toBe(base);
    expect(diffSug).not.toBe(base);
    expect(diffSeed).not.toBe(base);
  });

  it('scope prefix prevents cross-verb collision', async () => {
    const compose = await deriveIdempotencyKey('compose', ['x']);
    const render = await deriveIdempotencyKey('render', ['x']);
    const enrich = await deriveIdempotencyKey('enrich-pick', ['x']);
    expect(new Set([compose, render, enrich]).size).toBe(3);
  });

  it('null and undefined parts hash to "null" — not silently collapsing', async () => {
    const undef = await deriveIdempotencyKey('render', ['p1', undefined]);
    const nul = await deriveIdempotencyKey('render', ['p1', null]);
    const literalNull = await deriveIdempotencyKey('render', ['p1', 'null']);
    expect(undef).toBe(nul); // undefined and null treated identically
    expect(undef).toBe(literalNull); // sentinel string "null" matches
  });

  it('matches the spec-table compose key shape', async () => {
    const key = await deriveIdempotencyKey('compose', [
      'prj_xyz',
      'sug_abc',
      'auto',
    ]);
    const expectedInput = 'compose:prj_xyz:sug_abc:auto';
    const bytes = new TextEncoder().encode(expectedInput);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const expected = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    expect(key).toBe(expected);
  });

  it('matches the spec-table render key shape', async () => {
    const key = await deriveIdempotencyKey('render', [
      'prj_xyz',
      'W/"etag-abc"',
    ]);
    const expectedInput = 'render:prj_xyz:W/"etag-abc"';
    const bytes = new TextEncoder().encode(expectedInput);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const expected = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    expect(key).toBe(expected);
  });

  it('matches the spec-table enrich-pick key shape', async () => {
    const key = await deriveIdempotencyKey('enrich-pick', [
      'clip_x',
      0,
      'video',
      'cand_y',
    ]);
    const expectedInput = 'enrich-pick:clip_x:0:video:cand_y';
    const bytes = new TextEncoder().encode(expectedInput);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const expected = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    expect(key).toBe(expected);
  });
});
