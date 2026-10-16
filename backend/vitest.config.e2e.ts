import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    setupFiles: ['reflect-metadata', './test/support/env.ts'],
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // The files share one database, so one file could send another file's queued emails.
    fileParallelism: false,
    globalSetup: ['./test/support/global-setup.ts'],
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
