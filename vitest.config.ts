import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    allowOnly: true,
    fileParallelism: false,
    hookTimeout: 10_000,
    testTimeout: 10_000,
  },
});
