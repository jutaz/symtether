import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // 5000ms is the vitest default. Subprocess-based CLI tests spawn a
    // fresh node process that has to boot, load the bundle, parse it,
    // instantiate up to 18 tree-sitter WASM grammars, then run the
    // command. On a cold Windows runner or the slower Ubuntu CI, one
    // invocation takes 1-2s and update --check does two back-to-back,
    // which puts it right on the 5s edge. 20s is a comfortable ceiling
    // that still catches genuine hangs.
    testTimeout: 20000,
    hookTimeout: 20000,
    // Retry once on failure. Windows CI runners occasionally throw
    // STATUS_DLL_NOT_FOUND (exit code 0xC0000135 / 3221226505) at
    // Node process startup during heavy WASM instantiation, which is
    // outside our control and does not reproduce on a rerun. A single
    // retry catches these transient failures without masking a real
    // regression (a real bug fails both attempts).
    retry: 1,
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
