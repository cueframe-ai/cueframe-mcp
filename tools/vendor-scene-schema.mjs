#!/usr/bin/env node
/**
 * Vendor the generated scene JSON Schema into an OpenAPI document.
 *
 * The description used to be read back off the PREVIOUS `api/openapi.json` and
 * written forward again, so the only prose describing scene shots survived only
 * because this script kept copying it to itself. Regenerating the contract from
 * source would have deleted it, and nothing in source said what a scene shot
 * was. It now lives on the zod schema (`SCENE_SHOT_SPEC_V2_DESCRIPTION`) and
 * arrives here inside the generated schema, like every other description.
 *
 * `vendorSceneSchema` is exported because two callers need the same transform.
 * This file's CLI entry rewrites `api/openapi.json` in place. `spec-drift.mjs`
 * applies it to the spec production serves, so the drift gate compares like
 * with like: production emits the scene schema as anonymous recursive $refs and
 * orval cannot generate an SDK from those, so the published copy carries
 * depth-capped named components instead. Comparing the two untransformed
 * reports that deliberate substitution as breaking on every run, forever.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  sceneOpenApiComponents,
  SCENE_ANONYMOUS_COMPONENTS,
  SCENE_COMPONENT,
  SCENE_LAYER_PREFIX,
  SCENE_PARAM_COMPONENT,
} from './scene-schema-openapi.mjs';

export const CANONICAL_SCENE_SCHEMA = 'api/scene-schema.json';

export function loadCanonicalSceneSchema(path = CANONICAL_SCENE_SCHEMA) {
  const canonical = JSON.parse(readFileSync(path, 'utf8'));
  if (typeof canonical.description !== 'string' || !canonical.description) {
    throw new Error(
      'The generated scene schema carries no description. The kernel\'s zod schema must set ' +
      'SCENE_SHOT_SPEC_V2_DESCRIPTION; re-run the private contract sync so api/scene-schema.json carries it.',
    );
  }
  return canonical;
}

/**
 * Recover the canonical scene schema a spec was generated from.
 *
 * The drift gate needs prod's OWN scene schema put through the depth cap, not
 * the repo's substituted in: vendoring both sides from one source made the two
 * documents identical in that region by construction, so the gate could not see
 * a change to it at all.
 */
export function sceneCanonicalFromSpec(spec) {
  const schemas = spec.components.schemas;
  const [layerName, paramName] = SCENE_ANONYMOUS_COMPONENTS;
  const root = schemas[SCENE_COMPONENT];
  if (!root || !schemas[layerName] || !schemas[paramName]) {
    throw new Error(
      `The spec does not carry the generator's scene schema (${SCENE_COMPONENT}, ${layerName}, ${paramName}). ` +
      'Either it was already vendored, or the generator changed and this transform needs rewriting.',
    );
  }
  const toDefs = (value) => {
    if (Array.isArray(value)) return value.map(toDefs);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      key === '$ref' && typeof child === 'string' && child.startsWith('#/components/schemas/__schema')
        ? child.replace('#/components/schemas/', '#/$defs/')
        : toDefs(child),
    ]));
  };
  const canonical = toDefs(root);
  canonical.$defs = { [layerName]: toDefs(schemas[layerName]), [paramName]: toDefs(schemas[paramName]) };
  if (typeof canonical.description !== 'string' || !canonical.description) {
    throw new Error(`${SCENE_COMPONENT} carries no description in this spec.`);
  }
  return canonical;
}

function isVendoredSceneComponent(name) {
  return name === SCENE_COMPONENT
    || name === SCENE_PARAM_COMPONENT
    || name.startsWith(SCENE_LAYER_PREFIX)
    || name.startsWith('SceneShotSpecV2Def')
    || SCENE_ANONYMOUS_COMPONENTS.includes(name);
}

/** Replace whatever scene components a spec carries with the vendored ones. */
export function vendorSceneSchema(spec, canonical) {
  const vendored = structuredClone(spec);
  const schemas = vendored.components.schemas;
  for (const name of Object.keys(schemas)) {
    if (isVendoredSceneComponent(name)) delete schemas[name];
  }
  Object.assign(schemas, sceneOpenApiComponents(canonical, canonical.description));
  return vendored;
}

/** True when a spec carries the toolkit's vendored scene components rather than the sync's form. */
export function isVendoredSceneSpec(spec) {
  const schemas = spec?.components?.schemas ?? {};
  return Boolean(schemas[`${SCENE_LAYER_PREFIX}0`] && schemas[SCENE_PARAM_COMPONENT]);
}

/**
 * The inverse of `vendorSceneSchema`: recover the form the private contract sync writes.
 *
 * The sync emits `SceneShotSpecV2` as the private generator does — the canonical schema minus
 * `$schema`/`$defs`, its `$refs` pointing at the `__schema0`/`__schema1` recursion carriers —
 * and then DELETES those carriers (an internal naming convention), so they are dangling in the
 * synced document. Vendoring replaces that component with the depth-capped chain; this puts the
 * chain back into the single component. Everything outside the scene components is untouched.
 *
 * Content round-trips exactly. POSITION does not: vendoring re-appends the component, and the
 * private generator placed it by registration order, which the vendored document no longer
 * records. `unvendoredSerializations` recovers it by trying every slot; a caller with the sync
 * manifest's hash accepts the slot that reproduces it.
 */
export function unvendorSceneSchema(spec) {
  const unvendored = structuredClone(spec);
  const schemas = unvendored.components.schemas;
  const root = schemas[SCENE_COMPONENT];
  if (!root || !isVendoredSceneSpec(unvendored)) {
    throw new Error(
      `The spec does not carry the vendored scene components (${SCENE_COMPONENT}, ${SCENE_LAYER_PREFIX}0, ${SCENE_PARAM_COMPONENT}); ` +
      'nothing to un-vendor.',
    );
  }
  const [layerName, paramName] = SCENE_ANONYMOUS_COMPONENTS;
  const restoreRefs = (value) => {
    if (typeof value === 'string') {
      if (value === `#/components/schemas/${SCENE_LAYER_PREFIX}0`) return `#/components/schemas/${layerName}`;
      if (value === `#/components/schemas/${SCENE_PARAM_COMPONENT}`) return `#/components/schemas/${paramName}`;
      return value;
    }
    if (Array.isArray(value)) return value.map(restoreRefs);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, restoreRefs(child)]));
    }
    return value;
  };
  const restored = restoreRefs(root);
  for (const name of Object.keys(schemas)) {
    if (isVendoredSceneComponent(name)) delete schemas[name];
  }
  schemas[SCENE_COMPONENT] = restored;
  return unvendored;
}

/**
 * Every serialization of the un-vendored spec, with `SceneShotSpecV2` at each possible position
 * among the components. Serialized the way the sync writes the file (two-space indent, trailing
 * newline). Yields from the front; the private generator registers the scene schema early.
 */
export function* unvendoredSerializations(spec) {
  const unvendored = unvendorSceneSchema(spec);
  const entries = Object.entries(unvendored.components.schemas);
  const root = entries.find(([name]) => name === SCENE_COMPONENT);
  const rest = entries.filter(([name]) => name !== SCENE_COMPONENT);
  for (let index = 0; index <= rest.length; index += 1) {
    const schemas = Object.fromEntries([...rest.slice(0, index), root, ...rest.slice(index)]);
    const doc = { ...unvendored, components: { ...unvendored.components, schemas } };
    yield { index, text: `${JSON.stringify(doc, null, 2)}\n` };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const spec = vendorSceneSchema(JSON.parse(readFileSync('api/openapi.json', 'utf8')), loadCanonicalSceneSchema());
  writeFileSync('api/openapi.json', JSON.stringify(spec, null, 2) + '\n');
}
