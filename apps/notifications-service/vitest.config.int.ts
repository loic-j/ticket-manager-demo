import { defineConfig } from 'vitest/config';

/** Integration tests: need the notifications database (`pnpm infra:up`) and DATABASE_URL in .env. */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.int-spec.ts'],
    fileParallelism: false,
  },
});
