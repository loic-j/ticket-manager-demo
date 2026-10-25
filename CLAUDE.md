# ticketmanager3

pnpm + Turborepo monorepo: NestJS 12 services (`apps/tickets-service`, `apps/notifications-service`)
integrated through RabbitMQ, Next.js 16 BFF (`apps/web`), shared packages (`contracts` = HTTP
Zod schemas, `events` = integration events, `nest-common` = auth), Logto + PostgreSQL + RabbitMQ +
Mailpit in Docker (`infra/`). Roadmap: `docs/architecture/`.
Architecture, setup and design notes live in `README.md` and `docs/`; this file holds the rules and
commands that are not obvious from the code.

## Language

Everything in this repository is written in English: code, comments, UI strings, docs, commit
messages. Replies to the user may be in their language.

## Commands (run from the repo root)

```bash
pnpm infra:up                      # Logto, logto-db, tickets-db, notifications-db, rabbitmq, mailpit
pnpm dev                           # all apps in watch mode (needs infra:up first)
pnpm build | check-types | lint | test | test:e2e   # Turbo, every package
pnpm turbo run test --filter=@ticketmanager/tickets-service     # one package
pnpm --filter @ticketmanager/<service> db:migrate               # create/apply a Prisma migration (dev DB)
pnpm --filter @ticketmanager/<service> test:int                 # DB/broker-backed tests of one service
pnpm docker:build | docker:up | docker:down         # images / full stack in Docker
pnpm format                        # prettier --write on the whole repo
```

Node comes from nvm (`.nvmrc` = 26); `node` is not on the PATH of non-interactive shells, so a
script that needs it must `source ~/.nvm/nvm.sh` first. pnpm is a standalone binary.

## Definition of done

A change is done only when, from the repo root, all of these pass:
`pnpm build && pnpm check-types && pnpm lint && pnpm test && pnpm test:e2e`.
Run them (or the `verify` agent) before saying a task is complete. Prettier runs automatically on
every edited file through a hook; do not hand-format.

## Non-negotiable rules

- **Contract first**: every HTTP payload is a Zod schema in `packages/contracts`; types are inferred
  (`z.infer` / `z.input` / `z.output`). Never declare a DTO type by hand in an app. The API validates
  with NestJS 12 Standard Schema support: `@Body({ schema })`, `@Param('id', { schema })`.
- **Clean architecture + CQRS in the services** (`apps/<service>/src/<context>/`): `domain/` has no
  NestJS, Prisma or HTTP import and exposes pure transitions returning `{ state, events }`;
  `application/commands` handlers use the write port only, `application/queries` handlers use the
  read port only and return API views; `infrastructure/` implements the ports; `presentation/`
  controllers only validate and dispatch to `CommandBus` / `QueryBus` (never inject a repository).
  Domain errors are mapped to HTTP by a filter in `presentation/`, never thrown as `HttpException`.
- **Ports are injection tokens**: a TS interface does not exist at runtime, so each port exports a
  `Symbol`/string token (`TICKET_REPOSITORY`) and the module binds it. Tests override the token.
- **Auth**: every service route is protected by the global `AccessTokenGuard` from
  `@ticketmanager/nest-common` (`AuthModule.forRoot({ defaultAudience })`); opt out with `@Public()`,
  read the actor with `@CurrentUser()`. Every write records `createdBy` / `updatedBy` (Logto `sub`).
  The web app never exposes a token to the browser: all API calls happen in Server Components /
  Server Actions. Never introduce `NEXT_PUBLIC_*` variables for API URLs or secrets.
- **Integration events go through the outbox**: a command handler writes the aggregate and the
  rows returned by `toIntegrationEvents()` inside `UNIT_OF_WORK.run()`; only `OutboxRelay`
  talks to RabbitMQ. Never inject `EVENT_PUBLISHER` into a handler. Event payloads are defined
  once in `packages/events` with `defineEvent`; a breaking change is a new version.
- **Background work is a separate process and image, never an env switch**: timers (outbox
  relay, email retry) live in modules imported only by a headless entry point
  (`main.relay.ts`, `main.email-retry.ts`) with its own Dockerfile target and compose file under
  `infra/compose/`. The HTTP `AppModule` must not import them. A service's `dev` script runs
  both processes.
- **Prisma adapters use `this.prisma.db.<model>`**, never `this.prisma.<model>`, so they join the
  ambient transaction of the unit of work.
- **Databases stay separate**: one PostgreSQL per service (`tickets-db`, `notifications-db`) and
  one for Logto. A service never reads another service's database; it consumes its events.
- **Consumers are idempotent and order-independent**: claim the event id in the inbox
  (`PROCESSED_EVENTS`) and advance the aggregate version (`TICKET_VERSIONS`) inside the same unit
  of work as the side effect; a lower or equal version is stale and ignored; unknown event types
  are acked and ignored. Never rely on delivery order.
- **Aggregates carry a `version`** (optimistic concurrency: `update` applies only when the stored
  version matches, handlers retry then raise a conflict mapped to 409) and **integration events
  carry the full state** with that version, never a delta alone.
- **Prisma**: after any change to a service's `prisma/schema.prisma`, run the `db-migration` skill
  (generate + migration). The generated client in `src/generated/` is gitignored and produced by
  the `db:generate` Turbo task; never edit or commit it.
- **ESM everywhere in the API**: relative imports end with `.js`; `apps/tickets-service` is `"type": "module"`.
- **Secrets**: `.env`, `.env.local` and `infra/.env` are gitignored and must never be read, printed
  or committed. Only `.env.example` files are versioned; update them when adding a variable.
- **Git**: never commit, push or amend unless the user asks. Keep `pnpm-lock.yaml` in sync
  (`pnpm install` after editing a `package.json`).

## Gotchas

- Next.js 16 differs from training data (Cache Components, `connection()`, `PageProps<'/route'>`,
  `proxy.ts` instead of `middleware.ts`). Read `apps/web/node_modules/next/dist/docs/` for the
  feature you touch, or delegate to the `nextjs-docs` agent, before writing Next.js code.
- Turbo task `dev` is persistent and uncached; `db:generate` must run before `build`, `lint`,
  `check-types`, `test` (already wired in `turbo.json`, keep it that way for new packages).
- Logto in dev mode is `http://localhost:3301`; in full-Docker mode it is
  `http://host.docker.internal:3301` (override file `infra/docker-compose.docker.yml`). Logto
  refuses an identifier it does not know (`invalid_target`): the API resource
  `https://api.ticketmanager.local` must exist in the Logto console.
- The API only loads `apps/tickets-service/.env` through `ConfigModule.forRoot()`; a new env var must be read
  through `ConfigService`, validated with Zod where a config object exists.
- e2e tests must stay database- and broker-free: `TestAuth.createApp()` overrides the repository,
  messaging ports and `OutboxRelay` with the doubles in `src/messaging/infrastructure/testing.ts`.
  DB/broker-backed tests go in `test/*.int-spec.ts` (`pnpm infra:up` first).
- oxlint lints the API, ESLint (`eslint-config-next`) lints the web app. The web lint forbids JSX
  inside `try/catch`.

## Workflow expectations

- Before implementing a feature that spans api + web + shared, start with the schema in
  `packages/contracts`, then the API (domain → application → infrastructure → presentation → tests),
  then the web app.
- After touching `apps/tickets-service`, run the `architecture-reviewer` agent; after any code change, run the
  `verify` agent (or the commands above) before reporting completion.
- Use the `add-domain-module` skill to scaffold a new bounded context in the API.
- Plans and design documents go to `docs/`; keep `README.md` current when commands or setup change.
