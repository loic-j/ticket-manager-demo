# apps/tickets-service (NestJS 12, ESM, Prisma 7)

- Layout per bounded context: `domain/` (entities, ports, domain errors), `application/`
  (use cases), `infrastructure/` (adapters), `presentation/` (controllers, filters). See
  `src/tickets/` as the reference implementation and copy its shape.
- `PrismaService` (`src/database/`) is the single Prisma client; never instantiate `PrismaClient`
  elsewhere. Persistence adapters map Prisma rows ↔ domain objects explicitly (dates ↔ ISO strings).
- Global `AccessTokenGuard` (jose, JWKS from Logto). `@Public()` to opt out. Request user is
  available as `req.user: AuthUser` (shape in `@ticketmanager/contracts`).
- Validation: `StandardSchemaValidationPipe` is global; pass shared Zod schemas via the `schema`
  option on `@Body()` / `@Param()` / `@Query()`. No `class-validator`.
- Tests: Vitest. Unit specs next to the code (`*.spec.ts`), e2e in `test/*.e2e-spec.ts`
  (supertest, in-memory repository, `TestAuth` signs tokens with a local key pair), DB integration
  in `test/*.int-spec.ts` (`pnpm test:int`, needs `pnpm infra:up`).
- Lint: oxlint (`.oxlintrc.json`). `no-floating-promises` is an error: `await` or `void` promises.
- Env: `.env` (gitignored) loaded by `ConfigModule`; keys documented in `.env.example`:
  `PORT`, `CORS_ORIGIN`, `DATABASE_URL`, `LOGTO_ENDPOINT`, `LOGTO_API_RESOURCE`.
- Prisma: `prisma.config.ts` + `prisma/schema.prisma`; migrations are committed. Schema change →
  `db-migration` skill. Enum values must stay in sync with `TICKET_STATUSES` / `TICKET_PRIORITIES`.
