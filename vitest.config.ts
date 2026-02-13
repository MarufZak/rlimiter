import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    allowOnly: true,
    fileParallelism: false,
    hookTimeout: 20_000_000,
  },
});
