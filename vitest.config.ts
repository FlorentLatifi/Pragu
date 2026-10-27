import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests import sibling packages from source, so no build is needed before `pnpm test`.
const source = (pkg: string) => fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@pragu/core': source('core'),
      '@pragu/report': source('report'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'bench/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'bench/src/**/*.ts'],
      reporter: ['text-summary', 'html'],
      thresholds: {
        'packages/core/src/**/*.ts': { lines: 90, functions: 90, statements: 90, branches: 85 },
      },
    },
  },
});
