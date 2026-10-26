# Architecture overview

Detailed description of how the pieces fit together. The README covers setup and
day-to-day commands; the decisions behind this design are in the ADRs of this folder
(001 microservices, 002 directory-service, 003 read cache). Project rules live in `CLAUDE.md`.

## How type sharing works

1. Schemas live in `packages/contracts/src` and are written with Zod. Types are inferred from them
   (`z.infer`, `z.input`, `z.output`), so there is exactly one definition per payload.
2. The API validates requests with the same schemas through NestJS 12's Standard Schema support:
   `@Body({ schema: createTicketSchema })`. A global `StandardSchemaValidationPipe` is registered
   in `apps/tickets-service/src/main.ts`. No class-based DTOs or `class-validator` needed.
3. The web app imports the inferred types and validates its forms server-side with the same
   schemas (`safeParse` in the Server Actions, `src/lib/*-actions.ts`) before calling the API.
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
               └──► NestJS services (:3001 tickets, :3002 notifications, :3003 directory)
                    with `Authorization: Bearer <access token>` issued for that service's resource
                         └── each verifies the JWT (jose): JWKS signature, issuer, audience
```

The browser never calls the API directly: Next.js Server Components and Server Actions call it
server-side with an access token issued per service: `https://api.ticketmanager.local`
(`TICKETS_API_RESOURCE`), `https://notifications.ticketmanager.local` and
`https://directory.ticketmanager.local` (constants in `@ticketmanager/contracts`). On the API
side, a global guard (`@ticketmanager/nest-common`) requires a valid token on every route except
those marked `@Public()`.
The e2e tests replace the verifier with a local key pair: they run without Logto or Docker.

## API architecture (clean architecture + CQRS)

Each bounded context under `apps/tickets-service/src/` follows this layout:

```
tickets/
  domain/             Ticket model + pure transitions returning domain events, TicketRepository
                      (write port), domain events, domain errors. No NestJS, no HTTP, no Prisma.
  application/
    commands/         CreateTicket / UpdateTicket / DeleteTicket commands + handlers (write port only)
    queries/          ListTickets / GetTicket queries + handlers (read port only, return API views)
    ports/            TicketReadRepository (read side), TicketCache (read cache, evicted by commands)
    mappers/          contract DTOs → domain inputs, domain → API views (the only conversion point)
  infrastructure/     PrismaTicketRepository (write), PrismaTicketReadRepository (read) behind
                      CachingTicketReadRepository (cache-aside), CacheStoreTicketCache,
                      testing.ts (InMemoryTicketRepository, both ports, used by tests)
  presentation/       HTTP controller dispatching to CommandBus / QueryBus, error filter
  tickets.module.ts   Composition root: CqrsModule, handlers, port → adapter bindings
```

Every other folder under `src/` follows the same shape, including the cross-cutting ones:
`messaging/` (`application/ports`, `infrastructure/` outbox write side; the relay is its own
package and the consumer lives in notifications-service), `caching/` (`CACHE_STORE` port, Valkey
adapter, see "Read cache" below), `database/infrastructure/prisma.service.ts`,
`health/health.module.ts` + `presentation/`. Modules and config files sit at the folder root.

Commands return ids; the controller reads the result back through a query. Domain transitions
return `{ ticket, events }`; handlers persist the state and the matching integration events in
one transaction (see "Events and outbox" below). Request validation happens at the boundary with the Zod
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
`OutboxRelay` (from `@ticketmanager/outbox`, plain `pg`, no ORM) runs in its own package, process
and image, `apps/tickets-relay-service` (scalable with `--scale`), and polls that table
(every `OUTBOX_RELAY_INTERVAL_MS`), reads a batch in `sequence` order with
`FOR UPDATE SKIP LOCKED` (so several relays share the work without overlap), publishes it to the
topic exchange `ticketmanager.events` (routing key = event type) with publisher confirms, and
marks the rows. Delivery is at-least-once: consumers deduplicate on the envelope `id`. A broker outage only
delays publication; failed batches keep their rows with `attempts` and `last_error`, unparsable
rows are quarantined (`attempts` = `OUTBOX_MAX_ATTEMPTS`) and skipped. Every broker wait is bounded
by `BROKER_TIMEOUT_MS`.

### Ordering: versions, not delivery order

Nothing in the pipeline guarantees delivery order (several relays, concurrent consumers,
redeliveries). Instead every ticket carries an optimistic-concurrency `version` (1 at creation,
+1 per change; a concurrent update is retried on the fresh state, then answered `409`), and
every ticket event carries the **full state** with that version (`ticket.created`,
`ticket.changed` with `changes` = `{ field: { from, to } }` per edited field, `ticket.deleted` v2 with the
last state and the superseding version). A consumer that keeps state per ticket records the last version it applied
(`TICKET_VERSIONS.advance()` in notifications-service, inside the same transaction as its side
effects) and ignores any event with a lower or equal version. A late or replayed event can
therefore never overwrite a newer state, and no event has to wait for a missing predecessor.

`src/messaging/infrastructure/testing.ts` provides in-memory doubles; e2e tests run without
database or broker. `pnpm --filter @ticketmanager/tickets-service test:int` exercises the Prisma
write side, `pnpm --filter @ticketmanager/outbox test:int` the relay, both against PostgreSQL
and RabbitMQ.

### notifications-service (consumer)

`apps/notifications-service` binds the quorum queue `notifications.tickets` to `ticket.#`,
acks a message only after `HandleTicketEventCommand` committed the notification, nacks with a
backoff on failure, and lets the broker dead-letter after 5 deliveries to
`ticketmanager.events.dlx` (queue `notifications.tickets.dead`). Emails are sent after the commit
and retried by the email-retry worker process (`EMAIL_MAX_ATTEMPTS`; image
`notifications-email-retry`, scalable: workers claim distinct rows with `FOR UPDATE SKIP LOCKED`),
so a Logto or SMTP outage delays them instead of losing them. The handler is
idempotent through an **inbox** table (`processed_events`, claimed in the same transaction as the
notification row), so the at-least-once delivery never produces a second notification or email.
Every `ticket.created`, `ticket.changed` (status changes and other edits have their own wording)
and `ticket.deleted` notifies and emails the ticket creator; the recipient's email is
resolved through directory-service (synchronous `GET /users/:id` with a machine-to-machine token,
or `NOTIFICATIONS_DEV_FALLBACK_EMAIL` locally when no M2M credentials are set) and sent over SMTP
to Mailpit. The service also exposes `GET /notifications` and `POST /notifications/:id/read`,
scoped to the caller, for the web inbox.

### directory-service (synchronous user directory)

`apps/directory-service` is the one service that is **called synchronously** (ADR 002): the
callers need its answer to build their own. It is a read-only facade over the Logto Management
API with an in-memory cache (10 min, 60 s for unknown ids, `DIRECTORY_CACHE_*`) and no database.
`GET /users?ids=a,b` (up to 50 distinct ids, unknown ones omitted) and `GET /users/:id` return
`{ id, name, email, avatar }`. The web app calls it once per ticket list to show "Created by …"
and falls back to the raw id when it is unavailable; notifications-service calls it to resolve
recipient emails and lets the email-retry worker try again when it is down. Outgoing calls share
`ServiceHttpClient` + `logtoClientCredentials` from `@ticketmanager/nest-common` (cached
`client_credentials` token, timeout, one retry on 401).

Logto setup (once, Console):

1. **API resources → Create** `https://directory.ticketmanager.local` (the web app requests tokens
   for it; existing sessions must sign out and in again). In that resource, **Permissions →
   Create** `read:users`.
2. **Roles → Create role**, type _Machine-to-machine_, name `directory-client`, with the
   `read:users` permission of the directory resource.
3. **Applications → Create application → Machine-to-machine**, name `ticketmanager-services`,
   and assign it two roles: _Logto Management API access_ (lets directory-service read users)
   and `directory-client` (lets notifications-service call directory-service). Put its App ID /
   secret in `apps/directory-service/.env`, `apps/notifications-service/.env` and `infra/.env`
   (`LOGTO_M2M_APP_ID`, `LOGTO_M2M_APP_SECRET`). For least privilege, use two M2M apps with one
   role each: the variable names are the same, only the values differ per service.

The guard checks issuer and audience only, so both user tokens (web) and M2M tokens are accepted;
enforcing `read:users` is left to the RBAC step mentioned above.

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

## Read cache (Valkey)

tickets-service keeps its API views in [Valkey](https://valkey.io) (Redis-compatible, BSD; the
`valkey` service of `pnpm infra:up`, `localhost:6379`), see ADR 003. Cache-aside on the read
port: `GET /tickets` and `GET /tickets/:id` are served from the cache when present, otherwise
read from PostgreSQL and cached for `CACHE_TTL_MS` (60 s). Every committed create, update or
delete evicts the ticket entry and the list, so a change is visible on the next read. The cache
is an optimisation only: when Valkey is down or slower than `CACHE_TIMEOUT_MS` (250 ms) the
service logs one warning and reads the database; `CACHE_ENABLED=false` bypasses it. The client is
node-redis (`redis`), the official client; a Redis 8 image works unchanged (`CACHE_URL`).

```bash
pnpm --filter @ticketmanager/tickets-service test:int       # also covers RedisCacheStore against Valkey
```

## Observability (OpenTelemetry + Grafana)

See ADR 004 for the decision. Signal flow:

```
web (Next.js, @vercel/otel) ──traceparent──► services ──traceparent (AMQP headers)──► consumer
   │                                            │  pino logs (trace_id) + OTLP logs, metrics, spans
   └──────────────── OTLP/HTTP :4318 ───────────┴──────────────► lgtm (Collector → Tempo / Prometheus / Loki)
docker containers (RabbitMQ, PostgreSQL, Valkey, Logto…) ──Alloy──► Loki (logs) + Prometheus (exporters)
```

- Every Node process starts with `node --import @ticketmanager/telemetry/register`: ESM hook,
  `.env` read, Node SDK with the auto-instrumentations (`http`, `express`, `nestjs-core`, `pg`,
  `amqplib`, `redis`, `undici`, `pino`, `runtime-node`; `fs`/`dns`/`net` off, `/health` ignored).
  `OTEL_SERVICE_NAME` names the process (defaults to the package name under pnpm, suffixed by the
  entry file: `notifications-service-email-retry`). `OTEL_SDK_DISABLED=true` turns it off.
- Logs: pino through `nestjs-pino` (`createLoggerModule()` + `useTelemetryLogger(app)`); JSON with
  `trace_id` / `span_id`, pretty in the terminal with `LOG_PRETTY=true`, one line per request
  (4xx warn, 5xx error, `/health` silent), exported over OTLP so host processes appear in Loki.
- Correlation across the broker: `PrismaOutbox` stamps the envelope `correlationId` with the
  request's trace id; `amqplib` propagates `traceparent` in the message headers, so the consumer
  span continues the trace that created the ticket and the consumer annotates it with
  `event.type` / `event.id`. The guard adds `enduser.id` (Logto `sub`) to authenticated spans.
- Business metrics (declared in `@ticketmanager/telemetry`, recorded by adapters):
  `ticketmanager.outbox.*` (published, publish_failures, quarantined, batch_size),
  `ticketmanager.cache.operations{operation,result}`, `ticketmanager.notifications.events{result,event.type}`,
  `ticketmanager.notifications.emails{outcome}`, `ticketmanager.notifications.email_retry.*`,
  `ticketmanager.directory.lookups{source,outcome}`. HTTP RED metrics
  (`http_server_request_duration_seconds`) and Node runtime metrics come from the instrumentations.
- Backend: `infra/compose/observability.yml` (`grafana/otel-lgtm`, Alloy, exporters), Alloy config
  in `infra/observability/alloy.alloy`, dashboards in `infra/observability/dashboards/`
  (provisioned, editable in Grafana, export the JSON back to the repo to keep a change).

## Load tests (k6)

See ADR 005. `tools/load/` holds k6 scenarios in TypeScript (run by the `grafana/k6` image through
`infra/compose/load.yml`, profile `load`, never started by `pnpm infra:up`). Authentication uses a
dedicated Logto M2M app (`client_credentials`, one token per resource, fetched in `setup()`).
`smoke` gates a change (every endpoint, strict thresholds); `read` loads the cache; `write` drives
the asynchronous pipeline and measures the time from `POST /tickets` to the notification being
listed (`notification_e2e_ms`); `stress` looks for the knee. Results go to Prometheus (remote
write, tag `testid`) and the "k6 load tests" dashboard; every request carries `traceparent` so a
slow request opens in Tempo. `tools/load/clean.sh` removes the rows the tests leave behind.

## Docker

Every Dockerfile builds from the repo root with `turbo prune`, so an image only contains its
package and workspace dependencies. Each deployable process is its own image (a Dockerfile
target, selected by `target:` in compose):

| Image                                     | Dockerfile target                            | Process                                  |
| ----------------------------------------- | -------------------------------------------- | ---------------------------------------- |
| `ticketmanager-tickets-service`           | `apps/tickets-service` → `runner`            | HTTP API (`dist/main.js`)                |
| `ticketmanager-tickets-relay`             | `apps/tickets-relay-service` → `runner`      | outbox relay, no HTTP/ORM deps, scalable |
| `ticketmanager-tickets-migrate`           | `apps/tickets-service` → `migrate`           | `prisma migrate deploy`, runs once       |
| `ticketmanager-notifications-service`     | `apps/notifications-service` → `runner`      | HTTP API + RabbitMQ consumer             |
| `ticketmanager-notifications-email-retry` | `apps/notifications-service` → `email-retry` | email retry worker, scalable             |
| `ticketmanager-notifications-migrate`     | `apps/notifications-service` → `migrate`     | `prisma migrate deploy`, runs once       |
| `ticketmanager-directory-service`         | `apps/directory-service` → `runner`          | HTTP API, no database                    |
| `ticketmanager-web`                       | `apps/web`                                   | Next.js standalone                       |

The worker services are declared in `infra/compose/*.yml` and pulled into the main project with
`include:`, so they share the network and `depends_on` while staying in their own file. The HTTP
images contain no relay or retry timer at all. The tickets relay is a separate package so its image
ships only the publishing dependencies; the email-retry worker shares notifications-service's
package (it needs its adapters) and is separated at the module level (`EmailRetryModule` is only
imported by the worker entry point).
`pnpm build` is untouched; `pnpm docker:build` builds the images.

How to run the stack is in the README ("Run everything in Docker").

Configuration is read at runtime from the environment (`TICKETS_API_URL`, `NOTIFICATIONS_API_URL`,
`DIRECTORY_API_URL`, `BASE_URL`, `LOGTO_*`, `DATABASE_URL`), so the same images work in both modes. Nothing in the web app uses
`NEXT_PUBLIC_*` variables: the browser never calls the API or holds a token.

## Dependency versions

Versions shared by several packages (TypeScript, Zod, Vitest, `@types/node`, Prettier) are
pinned once in the `catalog:` section of `pnpm-workspace.yaml` and referenced as `"catalog:"`
in each `package.json`. Bump them there.

TypeScript is pinned to 6.x: NestJS 12 requires TS ≥ 6 and its CLI does not yet support the
TypeScript 7 (Go) compiler.
