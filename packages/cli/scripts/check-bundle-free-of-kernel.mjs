#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Strings that survive minification: module specifiers the kernel imports and error codes it throws.
// Each occurs in the published @cueframe/kernel 0.6.0 JavaScript; none can appear in a kernel-free CLI.
export const KERNEL_MARKERS = ['@cueframe/kernel', '@hyperframes/', '@babel/parser', 'component_v4_nondeterministic', 'legacy_keyframes_invalid'];

/** The kernel markers a bundle's text contains. */
export const kernelMarkersIn = (text) => KERNEL_MARKERS.filter((marker) => text.includes(marker));

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
  for (const f of readdirSync(dist).filter((n) => n.endsWith('.js'))) {
    const found = kernelMarkersIn(readFileSync(resolve(dist, f), 'utf8'));
    if (found.length) { console.error(`${f} contains kernel code (${found.join(', ')})`); process.exit(1); }
  }
  console.log('cli bundle is free of kernel code');
}
