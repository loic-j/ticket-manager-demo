import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Fallback lets `prisma generate` run without a database (e.g. in the Docker builder).
    url: process.env.DATABASE_URL ?? 'postgresql://tickets:tickets@localhost:5433/tickets',
  },
});
