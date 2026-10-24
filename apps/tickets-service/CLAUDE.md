# apps/tickets-service (NestJS 12, ESM, Prisma 7)

- Layout per bounded context (see `src/tickets/`, copy its shape): `domain/` (model, pure
  transitions, write port, events, errors), `application/commands|queries|ports` (@nestjs/cqrs
  handlers; commands return ids, queries return `@ticketmanager/contracts` views),
  `infrastructure/` (Prisma write + read adapters, in-memory adapter for tests), `presentation/`
  (controller dispatching to the buses, error filter). Register handlers in the module's
  `providers` via the `TICKET_COMMAND_HANDLERS` / `TICKET_QUERY_HANDLERS` arrays.
- Allowed framework imports per layer: `domain/` none; `application/` `@nestjs/common` +
  `@nestjs/cqrs`; `infrastructure/` anything; `presentation/` `@nestjs/*` only (no Prisma).
  Prisma row mapping lives in `infrastructure/<name>-row.mapper.ts`, shared by both adapters.
- Events: handlers publish domain events on the `EventBus` after persisting; never publish from
  the domain or the controller. The transactional outbox (phase 2) replaces this publication.
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
  `PORT`, `CORS_ORIGIN`, `DATABASE_URL`, `LOGTO_ENDPOINT`, `LOGTO_API_RESOURCE`.
- Prisma: `prisma.config.ts` + `prisma/schema.prisma`; migrations are committed. Schema change →
  `db-migration` skill. Enum values must stay in sync with `TICKET_STATUSES` / `TICKET_PRIORITIES`.
