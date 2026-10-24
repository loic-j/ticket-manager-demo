# Plan 001 - Tickets and Notifications microservices (BFF = Next.js)

Status: proposed · Date: 2026-10-24 · Scope: learning-oriented but production-shaped

## 1. Context and goals

Today the system is a modular monolith: one NestJS API (`apps/api`) owning tickets, a Next.js app
acting as the web BFF, Logto for identity, PostgreSQL per concern. The goal is to practice a
microservice architecture with asynchronous integration while keeping the current developer
experience (everything runs with `pnpm infra:up && pnpm dev`, or fully in Docker).

Target for this iteration:

- **tickets-service** (the existing API, renamed): owns tickets, exposes the HTTP API used by the
  BFF, publishes integration events through a **transactional outbox**, and is organised with
  **CQRS** (commands and queries with separate models and handlers).
- **notifications-service** (new): consumes ticket events from a message broker, records
  notifications in its own database, sends emails (Mailpit locally), and exposes a small query
  API (`GET /notifications`) for the web inbox.
- **web** stays the only BFF: it talks to both services server-side with Logto access tokens.
  No API gateway yet; it would only be justified by a second client (mobile) or cross-cutting
  policies (rate limit, WAF).

Non-goals: Kubernetes, service mesh, event sourcing, sagas across services, multi-tenancy.

## 2. Target topology

```
Browser ──► web (Next.js BFF, :3000)
              ├──HTTP, bearer──► tickets-service (:3001) ──► tickets-db (PG)
              │                        │ outbox relay
              │                        ▼
              │                   RabbitMQ (:5672, UI :15672)  exchange "ticketmanager.events" (topic)
              │                        │ queue "notifications.tickets"
              └──HTTP, bearer──► notifications-service (:3002) ──► notifications-db (PG)
                                       ├──SMTP──► Mailpit (:1025 / UI :8025)
                                       └──M2M──► Logto Management API (user email lookup)
Logto (:3301) issues all user tokens; each service validates JWTs itself (jose + JWKS).
```

Decisions:

| Topic                    | Decision                                                                                                                                                                      | Why                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Broker                   | RabbitMQ 4 (`rabbitmq:4-management`)                                                                                                                                          | First-class NestJS transport, publisher confirms, manual acks, dead-letter queues, UI for debugging. NATS JetStream is lighter but has weaker Nest tooling. |
| Delivery                 | At-least-once + idempotent consumers                                                                                                                                          | Outbox guarantees publication; consumers dedupe by event id. Exactly-once is not worth its cost.                                                            |
| Event contract           | Versioned Zod schemas in `packages/events`                                                                                                                                    | Same "contract first" rule as HTTP. Envelope + typed payloads, `type` like `ticket.created`, `version` integer.                                             |
| Read model (CQRS)        | Phase 1: same tables, separate query repository returning DTOs. Phase 2 (optional): denormalised `ticket_summaries` projection fed by domain events.                          | Start with "CQRS-lite" to learn the split without a second store; graduate when a query needs it.                                                           |
| Service-to-service calls | None synchronous between services                                                                                                                                             | Notifications only needs events + Logto. Keeps services independent.                                                                                        |
| Identity of the actor    | `createdBy` / `updatedBy` = Logto `sub`, carried in events                                                                                                                    | Email is resolved by notifications-service through Logto Management API (M2M), cached per user.                                                             |
| Shared code              | `packages/shared` → split into `packages/contracts` (HTTP), `packages/events` (integration events), `packages/nest-common` (auth guard, config helpers, outbox/inbox modules) | Each service depends on the smallest slice it needs; `nest-common` avoids copy-pasting the guard.                                                           |

## 3. Repository layout after the refactor

```
apps/
  web/                       Next.js BFF (unchanged role)
  tickets-service/           was apps/api; package @ticketmanager/tickets-service
  notifications-service/     new; package @ticketmanager/notifications-service
packages/
  contracts/                 was packages/shared: HTTP schemas + auth types (@ticketmanager/contracts)
  events/                    integration event schemas (@ticketmanager/events)
  nest-common/               AccessTokenGuard, @Public, config helpers, OutboxModule, InboxModule (@ticketmanager/nest-common)
  typescript-config/
infra/
  docker-compose.yml         + rabbitmq, notifications-db; profile "apps" adds notifications-service
docs/architecture/           this plan + ADRs
```

Inside each NestJS service, one folder per bounded context keeps the existing layers, with
`application/` split for CQRS:

```
src/tickets/
  domain/            Ticket aggregate, TicketRepository port, domain events, errors
  application/
    commands/        CreateTicketCommand + handler, UpdateTicketCommand + handler, ...
    queries/         ListTicketsQuery + handler, GetTicketQuery + handler (read DTOs)
    ports/           TicketReadRepository (query side), EventPublisher (outbox)
  infrastructure/    PrismaTicketRepository (write), PrismaTicketReadRepository (read), PrismaOutbox
  presentation/      controller dispatching to CommandBus/QueryBus, error filter
```

## 4. Patterns in detail

### 4.1 Transactional outbox (tickets-service)

- Prisma model `OutboxMessage { id uuid, type, version, aggregateType, aggregateId, payload json,
occurredAt, publishedAt?, attempts, lastError? }` in `tickets-db`.
- The command handler runs one Prisma interactive transaction: write the aggregate, then insert
  one outbox row per domain event. Both succeed or neither does.
- `OutboxRelay` (NestJS `@Interval`, every 500 ms, single instance guard via
  `SELECT ... FOR UPDATE SKIP LOCKED`) takes up to 50 unpublished rows ordered by `occurredAt`,
  publishes each to RabbitMQ with publisher confirms, sets `publishedAt`. On failure: increment
  `attempts`, store `lastError`, retry with backoff; after N attempts log loudly (no silent drop).
- Routing: exchange `ticketmanager.events` (topic), routing key = event `type`
  (`ticket.created`), message id = event id, headers `x-event-version`, `x-correlation-id`.
- Ordering per aggregate is best-effort (single relay, ordered by time); consumers must not rely
  on strict ordering.

### 4.2 Idempotent consumer / inbox (notifications-service)

- RabbitMQ queue `notifications.tickets` bound to `ticket.#`, manual ack, prefetch 10, dead-letter
  exchange `ticketmanager.dlx` after 5 redeliveries.
- Table `processed_events(event_id pk, processed_at)`: handler inserts the id in the same
  transaction as its side effects; a duplicate key means "already done" → ack without re-sending.
- Email sending is not transactional: record the notification first (status `pending`), send,
  then mark `sent`/`failed`; a retry job re-sends `pending` older than 1 min. This mirrors the
  outbox idea on the consumer side.

### 4.3 CQRS (both services)

- `@nestjs/cqrs`: `CommandBus`, `QueryBus`, `EventBus`. Controllers only build a command/query
  from the validated request and dispatch it.
- Commands return ids, not entities. Queries return read DTOs validated by the
  `@ticketmanager/contracts` schemas, never domain objects.
- Domain events (`TicketCreated`, `TicketUpdated`, `TicketStatusChanged`) are raised by the
  aggregate, collected by the handler, mapped to integration events, and written to the outbox.
  In-process `EventBus` subscribers are allowed for same-service reactions only.

### 4.4 Events contract (`packages/events`)

```ts
export const eventEnvelopeSchema = z.object({
  id: z.uuid(),
  type: z.string(), // "ticket.created"
  version: z.number().int(), // 1
  occurredAt: z.iso.datetime(),
  correlationId: z.string().optional(),
  actor: z.object({ sub: z.string() }).optional(),
  payload: z.unknown(),
});
export const ticketCreatedV1 = defineEvent(
  'ticket.created',
  1,
  z.object({ ticketId, title, priority, createdBy }),
);
export const ticketStatusChangedV1 = defineEvent(
  'ticket.status-changed',
  1,
  z.object({ ticketId, from, to, changedBy }),
);
```

Breaking changes create a new version (`ticket.created` v2); consumers declare the versions they
accept. Payloads carry ids and the minimum data needed, never full aggregates.

### 4.5 Auth across services

- Logto API resources: keep `https://api.ticketmanager.local` for tickets-service, add
  `https://notifications.ticketmanager.local` for notifications-service. The web asks tokens for
  both (`resources: [...]`) and picks the right one per call.
- `AccessTokenGuard` moves to `packages/nest-common` with the audience injected by each service.
- notifications-service gets a Logto **machine-to-machine** application with the Management API
  role to read user emails (`GET /api/users/{id}`), cached in memory (TTL 10 min).

### 4.6 Observability basics

- `x-correlation-id` accepted/generated by the BFF, propagated as HTTP header, outbox column,
  AMQP header, and log field (NestJS logger with JSON output in Docker).
- Health endpoints per service (`/health` incl. DB and broker checks via `@nestjs/terminus`).
- RabbitMQ management UI for queue depth; Mailpit UI for emails; Prisma Studio for data.

## 5. Phased delivery

Each phase ends green (`verify` agent) and is a reasonable commit/PR.

| #   | Phase                    | Main changes                                                                                                                                                                                                                                                                                         | Verification                                                                                                                           |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Rename and extract       | `apps/api` → `apps/tickets-service`; `packages/shared` → `packages/contracts`; new `packages/nest-common` with the guard, `@Public`, `ConfigModule` helper; add `createdBy`/`updatedBy` to tickets (migration); reintroduce `@CurrentUser()`. Update Turbo, Dockerfiles, compose, README, CLAUDE.md. | All existing tests pass; web still works end-to-end.                                                                                   |
| 1   | CQRS in tickets-service  | `@nestjs/cqrs`; commands/queries/handlers; read repository returning DTOs; domain events on the aggregate. No behaviour change.                                                                                                                                                                      | Unit specs per handler with in-memory adapters; e2e unchanged.                                                                         |
| 2   | Events contract + outbox | `packages/events`; `OutboxMessage` model + migration; transactional write in command handlers; `OutboxRelay` + RabbitMQ publisher with confirms; `rabbitmq` service in compose.                                                                                                                      | Integration test: create ticket → row in outbox → message observed on a test queue; relay retry test with broker down.                 |
| 3   | notifications-service    | New NestJS app (same layout), `notifications-db`, Prisma models `Notification`, `ProcessedEvent`; RMQ consumer with manual ack + inbox; email via nodemailer → Mailpit; Logto M2M email lookup; `GET /notifications` guarded by the new audience. Dockerfile + compose profile.                      | Unit specs for handlers; integration test consuming a published event twice → one notification, one email; e2e for the query endpoint. |
| 4   | Web inbox                | Token for the notifications resource; `/notifications` page + unread badge in `UserBar`; mark-as-read action.                                                                                                                                                                                        | Manual flow: create ticket → email in Mailpit → notification in the inbox.                                                             |
| 5   | Hardening (optional)     | DLQ handling command, correlation ids end-to-end, terminus health, denormalised read model, contract tests between publisher and consumer.                                                                                                                                                           | DLQ test; health checks in compose.                                                                                                    |

Estimated size: phases 0–2 touch mostly existing code; phase 3 is the largest (new service).

## 6. Risks and mitigations

- **Over-engineering for the domain**: accepted, the purpose is practice. Keep each service small
  and resist adding a gateway or more services until a real need appears.
- **Dual writes by mistake**: forbid any direct publish from handlers; only the relay publishes.
  The `architecture-reviewer` agent checklist gets a rule for it.
- **Email identity**: Logto M2M adds setup; fallback during development is an env var
  `NOTIFICATIONS_DEV_FALLBACK_EMAIL` used when the lookup fails (dev only, never in Docker prod).
- **Broker down in dev**: tickets-service must keep serving HTTP; the relay just accumulates rows.
- **Shared package churn**: renames in phase 0 are mechanical; do them in one commit with
  `pnpm install` and the full verify.

## 7. Open questions for the owner

1. Broker choice confirmed as RabbitMQ (alternative: NATS JetStream)?
2. Keep the port plan `3001` tickets, `3002` notifications, `5672/15672` RabbitMQ, `5434`
   notifications-db?
3. Should the email also go to assignees once assignment exists, or only to the creator for now?
4. Do we rename `apps/api` now (clearer) or keep the name to reduce churn?
