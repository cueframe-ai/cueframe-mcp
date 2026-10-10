export interface TemplateShape {
  v: 1;
  slug: string;
  name: string;
  parameters: Array<{ name: string; type: string; kind?: string; required?: boolean; sample?: { durationSec?: number } }>;
  presets?: Record<string, unknown>;
}

/** Reads the fields the CLI needs to phrase a request. The kernel, on the server, is the judge. */
export function readTemplateShape(raw: unknown): TemplateShape {
  const d = raw as Partial<TemplateShape> | null;
  if (!d || d.v !== 1 || typeof d.slug !== 'string') throw new Error('Not a CueFrame template document (v: 1, slug).');
  return { v: 1, slug: d.slug, name: typeof d.name === 'string' ? d.name : d.slug, parameters: Array.isArray(d.parameters) ? d.parameters : [], presets: d.presets };
}

export function coerceText(type: string, text: string): unknown {
  if (type === 'number') return text.trim() === '' ? text : Number(text);
  if (type === 'boolean') return text === 'true' ? true : text === 'false' ? false : text;
  return text;
}
