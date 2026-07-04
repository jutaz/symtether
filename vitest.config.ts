import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      // cli.ts is exercised end-to-end via subprocess (test/cli.test.ts),
      // which V8 coverage can't observe; index.ts is re-exports only.
      exclude: ['src/**/*.test.ts', 'src/cli.ts', 'src/index.ts'],
      thresholds: {
        statements: 95,
        branches: 85,
        functions: 100,
        lines: 95,
      },
    },
  },
});
