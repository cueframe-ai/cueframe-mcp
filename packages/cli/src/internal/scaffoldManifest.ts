/** What `cueframe new` writes into cueframe.json. The server admits it on push; this is a scaffold, not an authority. */
export const SCAFFOLD_COMPONENT_MANIFEST_V4 = Object.freeze({
  version: 4,
  runtime: 'hyperframes',
  hfContract: 1,
  kind: 'scene',
  assets: Object.freeze({}),
  graphics: Object.freeze({ api: 'webgl2', required: true, accelerationPreference: 'hardware-preferred' }),
  alphaPolicy: 'allows-opaque',
} as const);
