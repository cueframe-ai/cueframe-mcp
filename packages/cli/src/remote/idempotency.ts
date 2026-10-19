
export type IdempotencyScope = 'compose' | 'render' | 'enrich-pick';

export async function deriveIdempotencyKey(
  scope: IdempotencyScope,
  parts: ReadonlyArray<string | number | null | undefined>,
): Promise<string> {
  const normalised = parts
    .map((p) => (p === undefined || p === null ? 'null' : String(p)))
    .join(':');
  const input = `${scope}:${normalised}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

/** JSON with object keys sorted at every depth, so equal requests hash equally whatever order they were built in. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}
