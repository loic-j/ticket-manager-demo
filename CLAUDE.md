# ticketmanager3

pnpm + Turborepo monorepo: NestJS 12 tickets service (`apps/tickets-service`), Next.js 16 BFF
(`apps/web`), shared Zod contract (`packages/contracts`), shared NestJS auth (`packages/nest-common`),
Logto + PostgreSQL + Mailpit in Docker (`infra/`). Microservices roadmap: `docs/architecture/`.
Architecture, setup and design notes live in `README.md` and `docs/`; this file holds the rules and
commands that are not obvious from the code.

## Language

Everything in this repository is written in English: code, comments, UI strings, docs, commit
messages. Replies to the user may be in their language.

## Commands (run from the repo root)

```bash
pnpm infra:up                      # Logto + logto-db + tickets-db + mailpit (Docker Desktop)
pnpm dev                           # all apps in watch mode (needs infra:up first)
pnpm build | check-types | lint | test | test:e2e   # Turbo, every package
pnpm turbo run test --filter=@ticketmanager/tickets-service     # one package
pnpm --filter @ticketmanager/tickets-service db:migrate         # create/apply a Prisma migration (dev DB)
pnpm --filter @ticketmanager/tickets-service test:int           # Prisma adapter test against tickets-db
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
- **Databases stay separate**: Logto owns `logto-db`; tickets own `tickets-db`. Never point the
  app at Logto's database.
- **Prisma**: after any change to `apps/tickets-service/prisma/schema.prisma`, run the `db-migration` skill
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
- e2e tests must stay database-free: `TestAuth.createApp()` overrides `TICKET_REPOSITORY` with the
  in-memory adapter and stubs `PrismaService`. DB-backed tests go in `test/*.int-spec.ts`.
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
