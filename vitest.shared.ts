import { defineConfig } from 'vitest/config';

export const nodeTests = defineConfig({
  test: {
    environment: 'node',
  },
});

export const srcTests = defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

export const globalsTests = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

export default nodeTests;
