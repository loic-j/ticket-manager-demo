---
name: db-migration
description: Create a Prisma migration for apps/tickets-service after editing prisma/schema.prisma - regenerates the client, creates and applies the migration on the local tickets-db, and runs the DB integration test. Use whenever the Prisma schema changes.
argument-hint: <migration-name>
allowed-tools: Bash(source ~/.nvm/nvm.sh && pnpm *), Bash(docker compose -f infra/docker-compose.yml ps *), Read, Grep, Glob
---

Create and verify a Prisma migration named `$ARGUMENTS` (kebab-case, required; ask if missing).

1. Make sure the database is up: `docker compose -f infra/docker-compose.yml ps tickets-db` must
   show `healthy`. If not, tell the user to run `pnpm infra:up` and stop.
2. Keep Prisma enums in sync with `packages/contracts` constants (`TICKET_STATUSES`,
   `TICKET_PRIORITIES`, ...). If a shared constant changed, rebuild the shared package first:
   `source ~/.nvm/nvm.sh && pnpm --filter @ticketmanager/contracts build`.
3. Generate and migrate (reads `apps/tickets-service/.env` through `prisma.config.ts`):
   ```bash
   source ~/.nvm/nvm.sh && pnpm --filter @ticketmanager/tickets-service db:generate
   source ~/.nvm/nvm.sh && pnpm --filter @ticketmanager/tickets-service exec prisma migrate dev --name $ARGUMENTS
   ```
4. Open the new file under `apps/tickets-service/prisma/migrations/<timestamp>_$ARGUMENTS/migration.sql` and
   check it for destructive statements (`DROP COLUMN`, `DROP TABLE`, type changes on populated
   columns). Flag them to the user before continuing.
5. Update the Prisma adapter(s) in `apps/tickets-service/src/<context>/infrastructure/` and the domain model if
   columns were added or renamed.
6. Verify: `source ~/.nvm/nvm.sh && pnpm --filter @ticketmanager/tickets-service test:int` and
   `pnpm turbo run build check-types lint test test:e2e --filter=@ticketmanager/tickets-service`.
7. If `migrate dev` refuses because the shell is non-interactive, create the folder
   `prisma/migrations/$(date -u +%Y%m%d%H%M%S)_$ARGUMENTS/migration.sql` by hand, write the SQL
   Prisma would generate, run `prisma migrate deploy`, then confirm no drift with
   `prisma migrate diff --from-config-datasource --to-schema-datamodel prisma/schema.prisma --script`.
8. Report the migration file name and the tables/columns it changes. Never run `migrate reset`
   or `db push` without an explicit request.
