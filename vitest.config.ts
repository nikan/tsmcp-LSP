import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    exclude: ['**/node_modules/**', '**/dist/**', '**/fixtures/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**'],
      exclude: ['**/dist/**', '**/*.config.*', '**/*.d.ts', 'tests/fixtures/**'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
    },
  },
});
