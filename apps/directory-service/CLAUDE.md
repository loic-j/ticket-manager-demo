# apps/directory-service (NestJS 12, ESM)

Same rules and layout as `apps/tickets-service/CLAUDE.md` (read it first). Specifics:

- Read-only facade over the Logto Management API, **called synchronously** (ADR 002): the web BFF
  and notifications-service need the answer to build their own. No database, no broker, no
  Prisma: the only state is the in-memory profile cache. Keep it that way; a write here is a bug.
- One context, `users`: `GET /users?ids=a,b` (batch, `DIRECTORY_BATCH_MAX_IDS` distinct ids,
  unknown ids omitted, request order kept) and `GET /users/:id` (404 when unknown). Both dispatch
  to `QueryBus` and return `DirectoryUser` views from `@ticketmanager/contracts`.
- Port `USER_DIRECTORY` (`application/ports/user-directory.ts`) has `findById` (strict: a Logto
  failure throws → 500, unknown id → `null` → 404) and `findByIds` (best-effort: ids whose lookup
  failed are omitted and logged at warn, so one 429/5xx never fails a page). `LogtoUserDirectory`
  (Management API, M2M `client_credentials`, bounded fan-out because Logto has no batch-by-id
  endpoint) is wrapped by `CachingUserDirectory` (positive TTL from config, 60 s negative TTL,
  oldest-first eviction, concurrent cold lookups of one id share a single inner call). The cache
  is a decorator in `infrastructure/`, never in the application layer. Without `LOGTO_M2M_*`
  outside production the adapter answers "unknown" for everything and logs once.
- Outgoing HTTP goes through `ServiceHttpClient` + `logtoClientCredentials` from
  `@ticketmanager/nest-common`; only the Management API specifics live here
  (`LOGTO_MANAGEMENT_API_RESOURCE`, default `https://default.logto.app/api`, scope `all` as Logto
  requires, `/api/users/:id`, response shape).
- Auth: audience `DIRECTORY_API_RESOURCE`; the guard checks issuer + audience only, so user tokens
  (web) and M2M tokens (`sub` = app id) are both accepted. The `read:users` permission exists in
  Logto for M2M roles but is not enforced yet (RBAC step).
- Env (`.env.example`): `PORT`, `LOGTO_ENDPOINT`, `LOGTO_API_RESOURCE`, `LOGTO_M2M_APP_ID`,
  `LOGTO_M2M_APP_SECRET`, `LOGTO_MANAGEMENT_API_RESOURCE`, `LOGTO_MANAGEMENT_API_SCOPE`,
  `DIRECTORY_CACHE_TTL_MS`, `DIRECTORY_CACHE_MAX_SIZE`. Read via `ConfigService` through
  `loadUsersConfig` (`readEnv` from `@ticketmanager/nest-common`); M2M credentials are mandatory
  when `NODE_ENV=production`. `HealthModule` declares the public liveness probe.
- Tests: query handler and adapter specs next to the code (`StaticUserDirectory` in
  `infrastructure/testing.ts`, `fetch` stubbed with `vi.stubGlobal`), e2e via
  `test/utils/test-auth.ts`, built on `LocalTokenIssuer` from `@ticketmanager/nest-common/testing`
  (no infra).
