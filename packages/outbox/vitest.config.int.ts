import { defineConfig } from 'vitest/config';

/** Integration tests: need a PostgreSQL with the outbox table and RabbitMQ (`pnpm infra:up`). */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.int-spec.ts'],
    fileParallelism: false,
  },
});
