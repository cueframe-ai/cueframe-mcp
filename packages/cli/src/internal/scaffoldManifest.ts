/** What `cueframe new` writes into cueframe.json. The server validates it on push; this is a scaffold, not an authority. */
export const SCAFFOLD_COMPONENT_MANIFEST_V2 = Object.freeze({
  version: 2,
  assets: Object.freeze({}),
  graphics: Object.freeze({ api: 'canvas2d', required: true, accelerationPreference: 'software-allowed' }),
  alphaPolicy: 'requires-transparency',
} as const);
