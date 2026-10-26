# ticketmanager3

A small ticketing system built as a pnpm + Turborepo monorepo: a Next.js web app, three NestJS
services (tickets, notifications, user directory) talking through RabbitMQ, and shared Zod
contracts. Authentication is delegated to a self-hosted Logto.

```
apps/
  web/                    Next.js 16 front end (server-side calls only)        → http://localhost:3000
  tickets-service/        tickets API, transactional outbox, Valkey read cache → http://localhost:3001
  tickets-relay-service/  headless worker publishing the outbox to RabbitMQ
  notifications-service/  consumes ticket events, sends emails, inbox API       → http://localhost:3002
  directory-service/      user names/emails from Logto, no database            → http://localhost:3003
packages/                 contracts (Zod schemas), events, nest-common (auth + HTTP client), outbox
infra/                    docker-compose.yml (infrastructure) + compose/ (workers, observability) + observability/ (Alloy, dashboards)
docs/architecture/        overview.md (how it works) and the ADRs
```

## Requirements

- Node 26 through nvm (`nvm use`, see `.nvmrc`)
- pnpm 12 (`npm i -g pnpm`)
- Docker Desktop (or any Docker with Compose v2)

## First-time setup

1. **Install and start the infrastructure**

   ```bash
   pnpm install
   pnpm infra:up      # Logto + its PostgreSQL, tickets-db, notifications-db, RabbitMQ, Valkey, Mailpit, Grafana stack
   ```

   Wait until `curl localhost:3301/oidc/.well-known/openid-configuration` answers.

2. **Configure Logto** at http://localhost:3302 (create the admin account on first launch):

   | Where                                                 | What to create                                                                                                                                                                                                        |
   | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Applications → Traditional web → Next.js (App Router) | `ticketmanager-web`. Redirect URI `http://localhost:3000/callback`, post sign-out URI `http://localhost:3000` (no trailing slash). Copy the App ID and an App secret.                                                 |
   | API resources                                         | Three resources, one per service: `https://api.ticketmanager.local`, `https://notifications.ticketmanager.local`, `https://directory.ticketmanager.local`. In the directory resource add the permission `read:users`. |
   | Roles → Machine-to-machine                            | `directory-client` with the `read:users` permission.                                                                                                                                                                  |
   | Applications → Machine-to-machine                     | `ticketmanager-services` with the roles **Logto Management API access** and `directory-client`. Copy its App ID and secret.                                                                                           |
   | Users                                                 | A test user (or enable sign-up in _Sign-in experience_).                                                                                                                                                              |

   Optional, for email sign-up: **Connectors → Email → SMTP** with host `mailpit`, port `1025`,
   no TLS; codes land in Mailpit (http://localhost:8025).

3. **Create the env files** from their examples and fill in the Logto values:

   | File                                                             | Fill in                                                                                          |
   | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
   | `apps/web/.env.local`                                            | `LOGTO_APP_ID`, `LOGTO_APP_SECRET`, `LOGTO_COOKIE_SECRET` (32+ chars, `openssl rand -base64 32`) |
   | `apps/directory-service/.env`, `apps/notifications-service/.env` | `LOGTO_M2M_APP_ID`, `LOGTO_M2M_APP_SECRET`                                                       |
   | `apps/tickets-service/.env`, `apps/tickets-relay-service/.env`   | nothing, the defaults match `pnpm infra:up`                                                      |
   | `infra/.env`                                                     | the same web and M2M values, used only by the full-Docker mode                                   |

   Without the M2M values everything still runs: user names show as raw ids and emails go to
   `NOTIFICATIONS_DEV_FALLBACK_EMAIL`.

4. **Check** with `pnpm build && pnpm test && pnpm test:e2e` (no infrastructure needed for tests).

## Run locally

```bash
pnpm infra:up      # once per session (or leave it running)
pnpm dev           # every service, the two workers and the web app in watch mode
```

Then open http://localhost:3000 and sign in. One package at a time:
`pnpm turbo run dev --filter=@ticketmanager/tickets-service`.

| Tool                            | URL                                        | Credentials                       |
| ------------------------------- | ------------------------------------------ | --------------------------------- |
| Web app                         | http://localhost:3000                      | your Logto user                   |
| Logto console                   | http://localhost:3302                      | admin account                     |
| Grafana (metrics, logs, traces) | http://localhost:3030                      | none (anonymous admin)            |
| RabbitMQ management             | http://localhost:15672                     | `ticketmanager` / `ticketmanager` |
| Mailpit (sent emails)           | http://localhost:8025                      | none                              |
| Service health                  | http://localhost:3001/health, :3002, :3003 | none                              |

**Observability**: Grafana (http://localhost:3030) receives traces, metrics and logs from every
process (OpenTelemetry, pushed to `localhost:4318`) and from the infrastructure containers (Alloy).
Start with **Dashboards → Ticket Manager**, or **Explore**: Loki `{service_name="tickets-service"}`
for logs (click a `trace_id` to open the trace in Tempo), Tempo search by service for traces (a
trace crosses the web, the API, PostgreSQL, the relay, RabbitMQ and the consumer), Prometheus for
metrics. The terminal shows the same logs pretty-printed (`LOG_PRETTY=true` in each `.env`).

Stop the infrastructure with `pnpm infra:down` (data stays in Docker volumes).

## Run everything in Docker

```bash
pnpm docker:up     # builds the images and starts databases, Logto, migrations, services, workers, web
pnpm docker:logs   # follow the application containers
pnpm docker:down
```

- Needs `infra/.env` (step 3). Containers and the browser reach Logto as
  `http://host.docker.internal:3301`; the Logto app keeps `http://localhost:3000/callback`.
- Each process is its own image (API, relay, email-retry worker, migrations run once). Services
  start only when their dependencies pass their healthchecks and restart `unless-stopped`.
- The local stack runs directory-service and notifications-service with `NODE_ENV=development`
  so it works without the M2M app. A production deployment keeps `production`, which makes
  `LOGTO_M2M_*` mandatory.
- Back to host mode: `pnpm infra:up` recreates Logto with its `localhost` endpoints.

## Everyday commands

| Command                                                     | What it does                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`                                                  | Everything in watch mode                                                 |
| `pnpm build` / `check-types` / `lint` / `test` / `test:e2e` | The checks a change must pass (run all of them before calling it done)   |
| `pnpm format`                                               | Prettier on the whole repo                                               |
| `pnpm --filter @ticketmanager/<service> test:int`           | Database / Valkey / broker backed tests (needs `pnpm infra:up`)          |
| `pnpm --filter @ticketmanager/<service> db:migrate`         | Create and apply a Prisma migration after editing `prisma/schema.prisma` |
| `pnpm --filter @ticketmanager/tickets-service db:studio`    | Browse the tickets database                                              |

## Load tests (k6)

One-time Logto setup: on the **tickets** and **notifications** API resources create the permission
`load:test`; create the machine-to-machine role `load-tester` with both permissions; create the
M2M app `ticketmanager-loadtest` with that role; copy `tools/load/.env.example` to
`tools/load/.env` with its App ID and secret.

| Command            | What it does                                                                    |
| ------------------ | ------------------------------------------------------------------------------- |
| `pnpm load:smoke`  | 1 VU, 30 s, every endpoint, strict thresholds: the gate after a change          |
| `pnpm load:read`   | 50 VUs reading 200 seeded tickets (cache)                                       |
| `pnpm load:write`  | 10 → 30 creations/s followed until their notification exists (whole pipeline)   |
| `pnpm load:stress` | 5 → 200 req/s mixed, exploratory                                                |
| `pnpm load:web`    | anonymous home page, no credentials needed                                      |
| `pnpm load:clean`  | removes what the tests left in the databases (`-- --mail` also empties Mailpit) |

k6 runs in Docker against `pnpm dev` (default) or the Docker stack (`LOAD_TARGET=docker`).
Results: console summary, `tools/load/results/`, and the Grafana dashboard
**Ticket Manager · k6 load tests** (filter by the `testid` printed at start). Scenarios delete
the tickets they create; run `pnpm load:clean` after an aborted run or to drop the notification
rows. Details in `tools/load/README.md` and ADR 005.

## How it works, in short

- **Contract first**: every HTTP payload is a Zod schema in `packages/contracts`; the services
  validate with it, the web validates its forms with it.
- **Auth**: the browser only talks to Next.js; Server Components and Server Actions call the
  services with a Logto access token per service. Every service route requires a valid token.
- **Events**: a command writes the ticket and its integration event in one transaction (outbox);
  the relay publishes to RabbitMQ; notifications-service consumes idempotently and emails the
  creator on every creation, edit and deletion. Events carry the full state and a version, so
  order does not matter.
- **Directory**: the only synchronous call between services, a read-only facade over Logto.
- **Cache**: tickets reads go through Valkey (60 s, evicted after every change); a cache outage
  only slows reads down.

The full description is in [docs/architecture/overview.md](docs/architecture/overview.md); the
decisions are in the ADRs next to it; the coding rules are in `CLAUDE.md`.

## Troubleshooting

| Symptom                                              | Cause and fix                                                                                                                                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web shows `Logto requester error: [status=400]`      | A Logto API resource is missing, or your session predates it. Check the three resources, then sign out and in again.                                                                                                                             |
| User names show as raw ids                           | directory-service cannot read Logto: the M2M app lacks the **Logto Management API access** role, or `LOGTO_M2M_*` is empty.                                                                                                                      |
| No email after creating a ticket                     | Check RabbitMQ (`notifications.tickets` must have a consumer), then Mailpit, then the `notifications` table (`email`, `email_error`).                                                                                                            |
| `invalid_grant` or 401 everywhere                    | Sign out and in again; if it persists, clear the cookies of `localhost:3000`.                                                                                                                                                                    |
| Relay logs `Publishing … failed, next attempt in …`  | RabbitMQ is down; rows stay in `outbox_messages` and are published when it is back.                                                                                                                                                              |
| `Cache unavailable, reads fall back to the database` | Valkey is down; the API keeps working. `CACHE_ENABLED=false` disables the cache.                                                                                                                                                                 |
| Nothing in Grafana for a service                     | Check that the `lgtm` container is healthy (`docker compose -f infra/docker-compose.yml ps`) and that the process was started through `pnpm dev` / `start:prod` (the `--import` preload). `OTEL_SDK_DISABLED=true` in a `.env` also silences it. |
