# apps/tickets-service (NestJS 12, ESM, Prisma 7)

- Every folder under `src/` (business context or cross-cutting module: `tickets`, `messaging`,
  `database`, `health`) has the same shape: NestJS modules and config at its root
  (`<name>.module.ts`, `<name>.config.ts`), code only inside the layer folders it needs:
  `domain/` (model, pure transitions, write port, events, errors),
  `application/commands|queries|ports|services|events` (@nestjs/cqrs handlers; commands return
  ids, queries return `@ticketmanager/contracts` views), `infrastructure/` (Prisma / RabbitMQ /
  SMTP adapters, in-memory doubles in `testing.ts`), `presentation/` (inbound adapters: HTTP
  controllers, error filters, broker consumers). Never put a class directly at a folder root.
  Register handlers in the module's `providers` via the `TICKET_COMMAND_HANDLERS` /
  `TICKET_QUERY_HANDLERS` arrays.
- Allowed imports per layer: `domain/` none (not even `@ticketmanager/events`); `application/`
  `@nestjs/common`, `@nestjs/cqrs`, `@ticketmanager/events` and the cross-cutting ports in
  `src/messaging/application/ports` (explicit exception); `infrastructure/` anything; `presentation/`
  `@nestjs/*` only (no Prisma).
  Prisma row mapping lives in `infrastructure/<name>-row.mapper.ts`, shared by both adapters.
- Events: a handler maps domain events with `toIntegrationEvents()` and appends them to the
  `OUTBOX` inside `UNIT_OF_WORK.run()` together with the aggregate write. Read-modify-write
  commands are optimistic: read, transition (`version + 1`), `update()` returns `false` on a
  concurrent change, retry up to 3 times, then `ConcurrencyConflictError` (409). `src/messaging/`
  owns the **write side** of the outbox only (`MessagingModule`: unit of work + `PrismaOutbox`);
  publishing is done by `@ticketmanager/outbox` (`OutboxRelayModule`, imported only by
  `relay.module.ts` / `main.relay.ts`). Handlers never touch the broker and the CQRS `EventBus`
  is not used (reintroduce it only for an in-process subscriber).
- Processes: `main.ts` (HTTP) and `main.relay.ts` (relay, Docker target `relay`). `pnpm dev`
  runs `nest build --watch` plus `node --watch` on both entry points.
- `PrismaService` (`src/database/`) is the single Prisma client; never instantiate `PrismaClient`
  elsewhere. Persistence adapters map Prisma rows ↔ domain objects explicitly (dates ↔ ISO strings).
- Global `AccessTokenGuard` (jose, JWKS from Logto). `@Public()` to opt out. Request user is
  available as `req.user: AuthUser` (shape in `@ticketmanager/contracts`).
- Validation: `StandardSchemaValidationPipe` is global; pass shared Zod schemas via the `schema`
  option on `@Body()` / `@Param()` / `@Query()`. No `class-validator`.
- Tests: Vitest. Handler specs next to the code (`*.spec.ts`, in-memory adapter + fake EventBus),
  e2e in `test/*.e2e-spec.ts` (supertest; `TestAuth.createApp()` binds one in-memory instance to
  both ports and signs tokens with a local key pair), DB integration in `test/*.int-spec.ts`
  (`pnpm test:int`, needs `pnpm infra:up`).
- Lint: oxlint (`.oxlintrc.json`). `no-floating-promises` is an error: `await` or `void` promises.
- Env: `.env` (gitignored) loaded by `ConfigModule`; keys documented in `.env.example`:
  `PORT`, `CORS_ORIGIN`, `DATABASE_URL`, `LOGTO_ENDPOINT`, `LOGTO_API_RESOURCE`, `RABBITMQ_URL`,
  `EVENTS_EXCHANGE`, `OUTBOX_RELAY_INTERVAL_MS`, `OUTBOX_BATCH_SIZE`, `OUTBOX_MAX_ATTEMPTS`,
  `BROKER_TIMEOUT_MS`.
  Read them through `ConfigService` (see `loadOutboxRelayConfig` in `@ticketmanager/outbox`
  for the pattern), never `process.env`.
- Prisma 7 CLI: `migrate dev` needs a TTY for some changes (e.g. a unique column on a populated
  table); then write the SQL by hand in `prisma/migrations/<ts>_<name>/migration.sql` and run
  `prisma migrate deploy`. Drift check: `prisma migrate diff --from-config-datasource
--to-schema prisma/schema.prisma --script` must print nothing.
- Prisma: `prisma.config.ts` + `prisma/schema.prisma`; migrations are committed. Schema change →
  `db-migration` skill. Enum values must stay in sync with `TICKET_STATUSES` / `TICKET_PRIORITIES`.
