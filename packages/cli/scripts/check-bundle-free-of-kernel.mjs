#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const forbidden = ['shippedCompositionFaces', 'SceneShotSpecV2LayerDepth', 'CURRENT_MATTE_BAKE_VERSION', '@babel/parser'];
for (const f of readdirSync(dist).filter((n) => n.endsWith('.js'))) {
  const text = readFileSync(resolve(dist, f), 'utf8');
  for (const needle of forbidden) if (text.includes(needle)) { console.error(`${f} contains kernel code (${needle})`); process.exit(1); }
}
console.log('cli bundle is free of kernel code');
