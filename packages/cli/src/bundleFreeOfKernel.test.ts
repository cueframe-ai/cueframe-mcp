import { describe, expect, it } from 'vitest';
// @ts-expect-error -- a plain .mjs build script without type declarations
import { kernelMarkersIn } from '../scripts/check-bundle-free-of-kernel.mjs';

describe('the CLI bundle guard', () => {
  it('catches minified kernel code by what minification keeps: specifiers and error codes', () => {
    expect(kernelMarkersIn('import{a as b}from"@cueframe/kernel/component-runtime/v4";')).toEqual(['@cueframe/kernel']);
    expect(kernelMarkersIn('throw new e("component_v4_nondeterministic","x")')).toEqual(['component_v4_nondeterministic']);
  });
  it('passes text with no kernel markers', () => {
    expect(kernelMarkersIn('const a=1;export{a};')).toEqual([]);
  });
});
