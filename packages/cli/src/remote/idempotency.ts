
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
