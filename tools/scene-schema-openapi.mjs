export const SCENE_COMPONENT = 'SceneShotSpecV2';
export const SCENE_LAYER_PREFIX = 'SceneShotSpecV2LayerDepth';
export const SCENE_PARAM_COMPONENT = 'SceneShotSpecV2JsonValue';
export const SCENE_MAX_OPENAPI_GROUP_DEPTH = 4;
// The recursion carriers the generator emits. The published components replace
// them, so any spec being vendored drops them along with the scene components.
export const SCENE_ANONYMOUS_COMPONENTS = ['__schema0', '__schema1'];

const clone = (value) => structuredClone(value);

function rewriteRefs(value, layerRef) {
  if (typeof value === 'string') {
    if (value === '#/$defs/__schema0') return layerRef;
    if (value === '#/$defs/__schema1') return `#/components/schemas/${SCENE_PARAM_COMPONENT}`;
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => rewriteRefs(item, layerRef));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewriteRefs(child, layerRef)]));
  }
  return value;
}

export function sceneOpenApiComponents(canonical, description) {
  const source = clone(canonical);
  delete source.$schema;
  const defs = source.$defs;
  if (!defs?.__schema0 || !defs?.__schema1) throw new Error('canonical scene schema definitions changed');
  delete source.$defs;
  const components = {};
  components[SCENE_COMPONENT] = {
    ...rewriteRefs(source, `#/components/schemas/${SCENE_LAYER_PREFIX}0`),
    description,
  };
  for (let depth = 0; depth <= SCENE_MAX_OPENAPI_GROUP_DEPTH; depth += 1) {
    const next = `#/components/schemas/${SCENE_LAYER_PREFIX}${depth + 1}`;
    const layer = clone(defs.__schema0);
    if (depth === SCENE_MAX_OPENAPI_GROUP_DEPTH) {
      layer.anyOf = layer.anyOf.filter((arm) => arm?.properties?.kind?.const !== 'group');
    }
    components[`${SCENE_LAYER_PREFIX}${depth}`] = rewriteRefs(layer, next);
  }
  components[SCENE_PARAM_COMPONENT] = rewriteRefs(defs.__schema1, `#/components/schemas/${SCENE_LAYER_PREFIX}0`);
  return components;
}
