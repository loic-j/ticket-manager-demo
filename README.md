# ticketmanager3

pnpm + Turborepo monorepo: a Next.js BFF, NestJS microservices (tickets, notifications) talking
through RabbitMQ, and shared typed contracts.
The microservices roadmap lives in `docs/architecture/`.

```
apps/
  tickets-service/        NestJS 12: tickets API, CQRS, transactional outbox → http://localhost:3001
  notifications-service/  NestJS 12: consumes ticket events, emails, inbox API → http://localhost:3002
  web/        Next.js 16 (App Router, Tailwind 4, ESLint) → http://localhost:3000
infra/
  docker-compose.yml         Logto + its PostgreSQL, tickets PostgreSQL, RabbitMQ, Mailpit (+ apps under profile "apps")
  docker-compose.docker.yml  Override for the full-Docker mode (Logto exposed as host.docker.internal)
packages/
  contracts/          @ticketmanager/contracts — Zod schemas + inferred types (the HTTP contract)
  events/             @ticketmanager/events — integration event envelope + versioned ticket events
  nest-common/        @ticketmanager/nest-common — Logto auth guard, decorators shared by NestJS services
  typescript-config/  @ticketmanager/typescript-config — shared tsconfig presets
```

## Requirements

- Node.js ≥ 22.12 (see `.node-version`)
- pnpm 12 (`corepack enable` or `npm i -g pnpm`)

## Commands

All commands run from the repo root and go through Turborepo, which builds dependencies first
and caches results.

| Command            | What it does                                            |
| ------------------ | ------------------------------------------------------- |
| `pnpm install`     | Install everything                                      |
| `pnpm dev`         | Build `shared`, then run API, web and `shared` in watch |
| `pnpm build`       | Build all packages                                      |
| `pnpm check-types` | `tsc --noEmit` in every package                         |
| `pnpm lint`        | oxlint (api) + ESLint (web)                             |
| `pnpm test`        | Vitest unit tests (api, shared)                         |
| `pnpm test:e2e`    | API e2e tests (supertest)                               |
| `pnpm format`      | Prettier on the whole repo                              |

Day-to-day: `pnpm infra:up` once, then `pnpm dev`.

Target a single package with a filter, e.g. `pnpm turbo run dev --filter=@ticketmanager/tickets-service`,
or run its own scripts with `pnpm --filter @ticketmanager/web dev`.

Copy `apps/tickets-service/.env.example` and `apps/web/.env.example` to `.env` to override ports / URLs.

## How type sharing works

1. Schemas live in `packages/contracts/src` and are written with Zod. Types are inferred from them
   (`z.infer`, `z.input`, `z.output`), so there is exactly one definition per payload.
2. The API validates requests with the same schemas through NestJS 12's Standard Schema support:
   `@Body({ schema: createTicketSchema })`. A global `StandardSchemaValidationPipe` is registered
   in `apps/tickets-service/src/main.ts`. No class-based DTOs or `class-validator` needed.
3. The web app imports the inferred types (and may reuse the schemas client-side for forms).
4. `@ticketmanager/contracts` is a _compiled_ internal package: `tsc` emits `dist/` with `.js`,
   `.d.ts` and declaration maps. Both apps consume the compiled output, so it works with the
   NestJS `tsc` build, with Node at runtime, with Vitest and with Turbopack alike. Turborepo's
   `dependsOn: ["^build"]` guarantees it is built before any dependent task, and `pnpm dev`
   keeps it rebuilding with `tsc --watch`.

Adding a new domain: create `packages/contracts/src/<domain>/<name>.schema.ts`, re-export it from
`packages/contracts/src/index.ts`, then import from `@ticketmanager/contracts` in both apps.

## Authentication (Logto)

Authentication is delegated to [Logto](https://logto.io) (open source, self-hosted), running in
Docker with **its own PostgreSQL**, separate from the future tickets database.

```
Browser ──► Next.js (:3000) ──OIDC──► Logto (:3301, console :3302)
               │  encrypted session cookie (@logto/next)
               └──► NestJS API (:3001) with `Authorization: Bearer <access token>`
                         └── verifies the JWT (jose): JWKS signature, issuer, audience
```

The browser never calls the API directly: Next.js Server Components and Server Actions call it
server-side with an access token issued for the API resource `https://api.ticketmanager.local`
(constant `TICKETS_API_RESOURCE` in `@ticketmanager/contracts`). On the API side, a global guard
requires a valid token on every route except those marked `@Public()` (`apps/tickets-service/src/auth/`).
The e2e tests replace the verifier with a local key pair: they run without Logto or Docker.

### One-time setup

1. Start the infrastructure: `pnpm infra:up` (Docker Desktop required). Wait until
   `curl localhost:3301/oidc/.well-known/openid-configuration` responds.
2. Open the console at `http://localhost:3302` and create the admin account (first launch).
3. **Applications → Create application → Traditional web → Next.js (App Router)**, name
   `ticketmanager-web`:
   - Redirect URI: `http://localhost:3000/callback`
   - Post sign-out redirect URI: `http://localhost:3000/`
   - Copy the _App ID_ and an _App secret_.
4. **API resources → Create API resource**: name `ticketmanager-tickets-service`, identifier
   `https://api.ticketmanager.local`. Without it Logto refuses to issue the API token
   (`invalid_target`).
5. **Users → Add user**: create a test user (or enable sign-up under _Sign-in experience_).
6. Create `apps/web/.env.local` from `apps/web/.env.example` with the App ID, the App secret and a
   `LOGTO_COOKIE_SECRET` of 32+ characters (`openssl rand -base64 32`).
7. `pnpm dev`, open `http://localhost:3000`, click _Sign in_.

Stop with `pnpm infra:down` (data persists in the Docker volumes `logto-db-data` and `tickets-db-data`).

### Email sign-up (local)

`pnpm infra:up` also starts [Mailpit](https://mailpit.axllent.org), a local SMTP server with a web
inbox at `http://localhost:8025`. Logto sends its verification codes there, so users can register
with an email address without any external mail provider. One-time console setup:

1. **Connectors → Email and SMS → Set up email connector → SMTP**: host `mailpit`, port `1025`,
   no TLS, any credentials, from `noreply@ticketmanager.local`. Use the `Send test email` button
   and check the Mailpit inbox.
2. **Sign-in experience → Sign-up and sign-in**: add _Email address_ to the sign-up identifiers
   (keep _Username_ if you want both) and enable _Email address + password_ as a sign-in method.
   Existing users without an email are asked to add one at their next sign-in.

Next steps: `tickets:read` / `tickets:write` permissions on the API resource plus Logto roles
(RBAC) with a `@RequireScopes()` decorator.

## API architecture (clean architecture + CQRS)

Each bounded context under `apps/tickets-service/src/` follows this layout:

```
tickets/
  domain/             Ticket model + pure transitions returning domain events, TicketRepository
                      (write port), domain events, domain errors. No NestJS, no HTTP, no Prisma.
  application/
    commands/         CreateTicket / UpdateTicket / DeleteTicket commands + handlers (write port only)
    queries/          ListTickets / GetTicket queries + handlers (read port only, return API views)
    ports/            TicketReadRepository (read side)
  infrastructure/     PrismaTicketRepository (write), PrismaTicketReadRepository (read),
                      InMemoryTicketRepository (both ports, used by tests)
  presentation/       HTTP controller dispatching to CommandBus / QueryBus, error filter
  tickets.module.ts   Composition root: CqrsModule, handlers, port → adapter bindings
```

Commands return ids; the controller reads the result back through a query. Domain transitions
return `{ ticket, events }`; handlers persist the state and the matching integration events in
one transaction (see "Events and outbox" below), then publish the domain events in-process. Request validation happens at the boundary with the Zod
schemas from `@ticketmanager/contracts`. To change the storage, add adapters in `infrastructure/`
and rebind the ports in `tickets.module.ts`; nothing else moves.

## Events and outbox (RabbitMQ)

Services integrate asynchronously through RabbitMQ (`pnpm infra:up` starts it; management UI at
`http://localhost:15672`, `ticketmanager` / `ticketmanager`). The contract is
`packages/events`: an envelope (`id`, `type`, `version`, `occurredAt`, `actor`, `payload`) and
versioned payload schemas built with `defineEvent`, e.g. `ticketCreatedV1`.

tickets-service never publishes from a request. Command handlers run a **unit of work**
(`UNIT_OF_WORK` port, Prisma transaction propagated through `AsyncLocalStorage`) that saves the
aggregate and appends the integration events to the `outbox_messages` table (`OUTBOX` port).
`OutboxRelay` polls that table (every `OUTBOX_RELAY_INTERVAL_MS`), takes a cluster-wide advisory
lock so a single instance publishes at a time, reads a batch in `sequence` order (assigned by the
database at insert, so the events of one command keep their order), publishes it to the topic
exchange `ticketmanager.events` (routing key = event type) with publisher confirms, and marks the
rows. Delivery is at-least-once: consumers deduplicate on the envelope `id`. A broker outage only
delays publication; failed batches keep their rows with `attempts` and `last_error`, unparsable
rows are quarantined (`attempts` = `OUTBOX_MAX_ATTEMPTS`) and skipped. Every broker wait is bounded
by `BROKER_TIMEOUT_MS`.

`src/messaging/infrastructure/testing.ts` provides in-memory doubles; e2e tests run without
database or broker, `pnpm --filter @ticketmanager/tickets-service test:int` exercises the real
relay against PostgreSQL and RabbitMQ.

### notifications-service (consumer)

`apps/notifications-service` binds the quorum queue `notifications.tickets` to `ticket.#`,
acks a message only after `HandleTicketEventCommand` committed the notification, nacks with a
backoff on failure, and lets the broker dead-letter after 5 deliveries to
`ticketmanager.events.dlx` (queue `notifications.tickets.dead`). Emails are sent after the commit
and retried by a periodic job (`EMAIL_MAX_ATTEMPTS`), so a Logto or SMTP outage delays them
instead of losing them. The handler is
idempotent through an **inbox** table (`processed_events`, claimed in the same transaction as the
notification row), so the at-least-once delivery never produces a second notification or email.
`ticket.created` and `ticket.status-changed` notify the ticket creator; the recipient's email is
resolved through the Logto Management API with a machine-to-machine token (or
`NOTIFICATIONS_DEV_FALLBACK_EMAIL` locally) and sent over SMTP to Mailpit. The service also
exposes `GET /notifications` and `POST /notifications/:id/read`, scoped to the caller, for the
web inbox.

Logto setup for this service (once): **API resources → Create** `https://notifications.ticketmanager.local`
(the web app requests tokens for it); optionally **Applications → Machine-to-machine** with the
_Logto Management API access_ role, then put its App ID / secret in
`apps/notifications-service/.env` (`LOGTO_M2M_APP_ID`, `LOGTO_M2M_APP_SECRET`) and `infra/.env`.

## Database (Prisma + PostgreSQL)

Tickets live in their own PostgreSQL (`tickets-db`, `localhost:5433`), separate from Logto's.
Prisma 7 with the `pg` driver adapter; schema in `apps/tickets-service/prisma/schema.prisma`, migrations
committed in `apps/tickets-service/prisma/migrations/`, config in `apps/tickets-service/prisma.config.ts`. The generated
client (`apps/tickets-service/src/generated/`) is gitignored and produced by the `db:generate` Turbo task,
which every build / check / test task depends on.

```bash
pnpm infra:up                                   # tickets-db (and Logto)
pnpm --filter @ticketmanager/tickets-service db:migrate     # apply migrations locally (dev) / create one after editing the schema
pnpm --filter @ticketmanager/tickets-service db:deploy      # apply committed migrations (CI / prod)
pnpm --filter @ticketmanager/tickets-service db:studio      # browse the data
pnpm --filter @ticketmanager/tickets-service test:int       # integration test of the Prisma adapter (needs the DB)
```

`DATABASE_URL` is read from `apps/tickets-service/.env` (see `.env.example`). Unit and e2e tests never touch
the database: the e2e helper swaps in `InMemoryTicketRepository`.

## Docker

`apps/tickets-service/Dockerfile` and `apps/web/Dockerfile` build from the repo root with `turbo prune`, so an
image only contains its package and workspace dependencies. The api Dockerfile has two targets:
`runner` (default) and `migrate`, which runs `prisma migrate deploy`. The web image uses Next.js
standalone output. `pnpm build` is untouched; `pnpm docker:build` builds the images.

`pnpm docker:up` runs the whole stack (databases, Logto, migrations, api, web) in Docker:

- The browser and the containers must reach Logto under **one** name, and a container cannot
  resolve `localhost` to your machine. The override `infra/docker-compose.docker.yml` therefore
  exposes Logto as `http://host.docker.internal:3301` (console `:3302`), a name Docker Desktop
  resolves from the host (Windows/macOS hosts file) and from containers.
- The `web` container reads the Logto credentials from `infra/.env` (copy `infra/.env.example`,
  same values as `apps/web/.env.local`). The app in Logto keeps `http://localhost:3000/callback`.
- Stop with `pnpm docker:down`. To go back to the host dev mode, run `pnpm infra:up` again: it
  recreates Logto with its `localhost` endpoints.

Configuration is read at runtime from the environment (`TICKETS_API_URL`, `BASE_URL`, `LOGTO_*`,
`DATABASE_URL`), so the same images work in both modes. Nothing in the web app uses
`NEXT_PUBLIC_*` variables: the browser never calls the API or holds a token.

## Dependency versions

Versions shared by several packages (TypeScript, Zod, Vitest, `@types/node`, Prettier) are
pinned once in the `catalog:` section of `pnpm-workspace.yaml` and referenced as `"catalog:"`
in each `package.json`. Bump them there.

TypeScript is pinned to 6.x: NestJS 12 requires TS ≥ 6 and its CLI does not yet support the
TypeScript 7 (Go) compiler.
