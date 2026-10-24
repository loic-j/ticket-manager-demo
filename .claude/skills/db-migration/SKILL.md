---
name: db-migration
description: Create a Prisma migration for a NestJS service (tickets-service by default, or the one given as first argument) after editing its prisma/schema.prisma - regenerates the client, creates and applies the migration on the local database, and runs the DB integration tests. Use whenever a Prisma schema changes.
argument-hint: [service] <migration-name>
allowed-tools: Bash(source ~/.nvm/nvm.sh && pnpm *), Bash(docker compose -f infra/docker-compose.yml ps *), Read, Grep, Glob
---

Arguments: `$ARGUMENTS` = optional service directory name (`tickets-service` default,
`notifications-service`, ...) followed by the migration name (kebab-case, required; ask if missing).
Below, `<svc>` is the service and `<db>` its compose database service (`tickets-db`,
`notifications-db`).

1. Make sure the database is up: `docker compose -f infra/docker-compose.yml ps <db>` must
   show `healthy`. If not, tell the user to run `pnpm infra:up` and stop.
2. Keep Prisma enums in sync with `packages/contracts` constants (`TICKET_STATUSES`,
   `TICKET_PRIORITIES`, ...). If a shared constant changed, rebuild the shared package first:
   `source ~/.nvm/nvm.sh && pnpm --filter @ticketmanager/contracts build`.
3. Generate and migrate (reads `apps/tickets-service/.env` through `prisma.config.ts`):
   ```bash
   source ~/.nvm/nvm.sh && pnpm --filter @ticketmanager/<svc> db:generate
   source ~/.nvm/nvm.sh && pnpm --filter @ticketmanager/<svc> exec prisma migrate dev --name $ARGUMENTS
   ```
4. Open the new file under `apps/<svc>/prisma/migrations/<timestamp>_$ARGUMENTS/migration.sql` and
   check it for destructive statements (`DROP COLUMN`, `DROP TABLE`, type changes on populated
   columns). Flag them to the user before continuing.
5. Update the Prisma adapter(s) in `apps/<svc>/src/<context>/infrastructure/` and the domain model if
   columns were added or renamed.
6. Verify: `source ~/.nvm/nvm.sh && pnpm --filter @ticketmanager/<svc> test:int` and
   `pnpm turbo run build check-types lint test test:e2e --filter=@ticketmanager/<svc>`.
7. If `migrate dev` refuses because the shell is non-interactive, create the folder
   `prisma/migrations/$(date -u +%Y%m%d%H%M%S)_$ARGUMENTS/migration.sql` by hand, write the SQL
   Prisma would generate, run `prisma migrate deploy`, then confirm no drift with
   `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`.
8. Report the migration file name and the tables/columns it changes. Never run `migrate reset`
   or `db push` without an explicit request.
