# ADR 004 - Observability: traces, metrics and logs for every process

Status: **proposed** (awaiting validation) · Date: 2026-10-26

## 1. Context

Seven processes (web, three HTTP services, relay, email-retry worker, plus the infrastructure) exchange
HTTP calls and RabbitMQ messages. Today the only observation points are the Nest console logs in the
Turbo TUI, the RabbitMQ management UI, Mailpit and SQL queries. A request that fails or a
notification that never arrives has to be traced by hand across processes.

Goal: for every process, in one place, see **traces** (one request from the browser to the email,
across the broker), **metrics** (rate / errors / duration per route, queue depth, outbox backlog,
cache hit ratio, runtime) and **logs** (structured, correlated with the trace), locally with Docker
and without changing the business code.

## 2. Options considered

### Backend

| Option                                                                                                                                                                                       | Verdict                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`grafana/otel-lgtm` all-in-one** (OpenTelemetry Collector + Prometheus + Tempo + Loki + Pyroscope + Grafana in one container, pre-wired datasources with trace ↔ log ↔ metric correlation) | **Chosen for local.** One image, zero configuration to receive OTLP on 4317/4318, Prometheus started with the remote-write and OTLP receivers and exemplar storage, Grafana datasources already correlated (Tempo → Loki by `trace_id`, Loki → Tempo derived field, Prometheus exemplars → Tempo). Documented as a dev/demo backend, which is exactly the scope here. ~1 GB RAM. |
| Separate containers (Prometheus, Loki, Tempo, Grafana, Collector) with hand-written configs                                                                                                  | Closer to production, but five configs and five images to maintain for the same local result. Kept as the migration path: everything the apps send is plain OTLP, so swapping the backend is a compose change only.                                                                                                                                                              |
| SigNoz / Jaeger + Prometheus / Elastic                                                                                                                                                       | Capable, but the request is Grafana + Prometheus; the LGTM stack is the native fit.                                                                                                                                                                                                                                                                                              |

### Collection agent

| Option                          | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Grafana Alloy**               | **Chosen** for what the apps cannot push themselves: tailing the Docker container logs (RabbitMQ, PostgreSQL, Logto, Valkey, Mailpit and the app containers in full-Docker mode) into Loki, and scraping the Prometheus exporters (RabbitMQ built-in plugin, `postgres_exporter`, `redis_exporter`) into Prometheus with remote write. Alloy embeds the OpenTelemetry Collector components, so it also forwards OTLP if the all-in-one is ever split. |
| OpenTelemetry Collector contrib | Vendor-neutral, but Docker log tailing and Prometheus scraping are second-class compared with Alloy's `loki.source.docker` / `prometheus.scrape`. The otel-lgtm image already runs a Collector for the OTLP side.                                                                                                                                                                                                                                     |

### Application instrumentation (NestJS 12, ESM, Node 26)

| Option                                                                                                                                                            | Verdict                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **OpenTelemetry Node SDK with the official auto-instrumentations** (`http`, `express`, `nestjs-core`, `pg`, `amqplib`, `redis`, `undici`, `pino`, `runtime-node`) | **Chosen.** Covers every library in use: Prisma 7 goes through `pg` (SQL spans), the relay and the consumer through `amqplib` (context propagated in the message headers, so a trace crosses the broker), Valkey through `redis`, outgoing service calls through `undici`/`http`. Traces and metrics are stable in OpenTelemetry JS; logs are "development" status but usable. |
| `@willsoto/nestjs-prometheus` + `prom-client` (`/metrics` endpoint per service)                                                                                   | Metrics only, no traces, no correlation. OTLP push covers metrics as well and needs no scrape target per process. Not chosen.                                                                                                                                                                                                                                                  |
| Third-party NestJS OTel modules (`nestjs-otel`, `@helveg/opentelemetry-nestjs`)                                                                                   | Thin wrappers over the same SDK with their own release cadence. The SDK alone is enough.                                                                                                                                                                                                                                                                                       |

ESM detail: `@opentelemetry/auto-instrumentations-node/register` does **not** install the ESM
loader hook itself (checked in 0.82.0: it only builds a `NodeSDK`), so an ESM app needs
`module.register('@opentelemetry/instrumentation/hook.mjs')` before anything else is imported. A
small shared entry point does that, then starts the SDK: `node --import @ticketmanager/telemetry/register dist/main.js`.

### Logging

| Option                                                                                                                                                                            | Verdict                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **pino through `nestjs-pino`** as the Nest logger, JSON to stdout, `trace_id` / `span_id` injected by `@opentelemetry/instrumentation-pino`, records also exported over OTLP logs | **Chosen.** Structured, fast, correlated; `pino-pretty` for the terminal in dev. The existing `new Logger(X)` calls keep working (Nest routes them to pino), so no business file changes. OTLP export makes the host `pnpm dev` processes visible in Loki too (Alloy only sees containers). |
| Keep the Nest console logger, let Alloy parse the text                                                                                                                            | No structure, no trace id, nothing in dev mode.                                                                                                                                                                                                                                             |

### Next.js

`@vercel/otel` in `src/instrumentation.ts` (the documented Next.js way, Node and Edge runtimes),
`propagateContextUrls` set to the three service URLs so the `traceparent` header reaches the
services and one trace spans browser request → Server Component / Server Action → API → database
→ outbox → relay → broker → consumer → email.

### Profiling (optional, phase 3)

Pyroscope is already in the all-in-one image; `@pyroscope/nodejs` can push CPU/heap profiles per
service later. Not part of this plan's first delivery.

## 3. Decision (what changes)

### Infrastructure (`infra/`)

- New `infra/compose/observability.yml`, included by `docker-compose.yml`, started by `pnpm infra:up`
  (opt out with `pnpm infra:up --scale lgtm=0 …` is clumsy, so a `COMPOSE_PROFILES` note instead;
  default on):
  - `lgtm`: `grafana/otel-lgtm:0.38.0`, ports **3030→3000 Grafana** (3000 is the web app), 4317/4318
    OTLP, 9090 Prometheus, 3100 Loki, 3200 Tempo, 4040 Pyroscope; volume `lgtm-data:/data`;
    custom dashboards mounted from `infra/observability/dashboards/` (provisioning path documented by
    the image); anonymous admin login for local use (`GF_AUTH_ANONYMOUS_*`).
  - `alloy`: `grafana/alloy:v1.21.2`, config `infra/observability/alloy.alloy`, Docker socket mounted
    read-only; `loki.source.docker` (container name as label, all project containers) → Loki;
    `prometheus.scrape` of `rabbitmq:15692` (plugin already enabled in the management image),
    `postgres-exporter-tickets:9187`, `postgres-exporter-notifications:9187`, `valkey-exporter:9121`
    → `prometheus.remote_write` to `lgtm:9090`.
  - `postgres-exporter-tickets`, `postgres-exporter-notifications` (`prometheuscommunity/postgres-exporter:v0.20.1`),
    `valkey-exporter` (`oliver006/redis_exporter:v1.96.0`).
- App containers (full-Docker mode) get `OTEL_EXPORTER_OTLP_ENDPOINT=http://lgtm:4318`,
  `OTEL_SERVICE_NAME=<service>`; `.env.example` files get the same with `localhost`.
- Dashboards committed as JSON: **Services overview** (RED per service and route from the OTel
  HTTP metrics, Node runtime: event loop lag, heap, GC), **Ticket pipeline** (commands/s, outbox
  pending and backoff, published/s, consumer results created/duplicate/stale/ignored, emails
  sent/failed, email-retry runs, cache hits/misses), **Infrastructure** links: RabbitMQ (community
  dashboard 10991), PostgreSQL (9628), Redis/Valkey (763) imported by id on first use (README).

### Shared package `packages/telemetry` (`@ticketmanager/telemetry`)

- `register.ts` (entry point used with `node --import`): registers the ESM hook, builds a `NodeSDK`
  with OTLP/HTTP exporters for traces, metrics (periodic reader) and logs, resource from
  `OTEL_SERVICE_NAME` + `service.version` (package version) + `deployment.environment`, the
  instrumentation list above (`fs`, `dns`, `net` disabled), graceful shutdown. Honours the standard
  `OTEL_SDK_DISABLED=true` (set in the test configs so unit/e2e/int runs export nothing) and
  `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4318`).
- `logger.ts`: `createLoggerModule()` returning the `nestjs-pino` `LoggerModule` configured for the
  project (JSON, `LOG_LEVEL`, `pino-pretty` when `LOG_PRETTY=true`, redaction of `authorization`
  headers and known secret keys, request logging with method/route/status/duration, health route
  quiet). `main.ts` of each process adds `bufferLogs: true` + `app.useLogger(app.get(Logger))`.
- `metrics.ts`: `meter(name)` helper and the project's named instruments (counters/histograms
  listed under "Ticket pipeline"), so adapters record metrics with one line and names stay
  consistent.
- No dependency on nest-common (the relay image must stay free of auth/ORM dependencies); the
  package depends on `@opentelemetry/*`, `nestjs-pino`, `pino`, `pino-http`.

### Services

- `apps/tickets-service`, `apps/notifications-service`, `apps/directory-service`,
  `apps/tickets-relay-service`: `dev` scripts, `start:prod` and Dockerfile `CMD` run
  `node --import @ticketmanager/telemetry/register dist/main.js` (same for `main.email-retry.js`);
  `LoggerModule` imported in the root modules; `.env.example` + `turbo.json` env lists get
  `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SDK_DISABLED`, `LOG_LEVEL`, `LOG_PRETTY`.
- Correlation across the broker: the outbox envelope already has `correlationId`; it is set to the
  current trace id through a `TRACE_CONTEXT` port (`src/messaging/application/ports`, adapter on
  `@opentelemetry/api` in `infrastructure/`), so a notification row can be found from the trace that
  created the ticket and vice-versa. `amqplib` instrumentation carries `traceparent` in the message
  headers, so the consumer span is a child of the relay's publish span.
- Business metrics recorded in infrastructure/presentation adapters only (no `@opentelemetry/api`
  in domain or application): `OutboxRelay` (published, failed, backoff state, batch size),
  `RedisCacheStore` (hit/miss/error), `TicketEventsConsumer` (result per outcome), `EmailDeliveryService`
  outcome through the mailer/user-directory adapters, `EmailRetryJob` runs. HTTP RED metrics come
  from the `http` instrumentation.
- Span attributes worth adding at the boundary (presentation layer only): `ticket.id`, `event.type`,
  `event.id` on the consumer and controller spans; `enduser.id` = Logto `sub` on authenticated routes.

### Web

- `apps/web/src/instrumentation.ts`: `registerOTel({ serviceName: 'web', instrumentationConfig: { fetch: { propagateContextUrls: [<service URLs>] } } })`,
  OTLP endpoint from the standard env variable. `NEXT_OTEL_VERBOSE=1` available for more spans.
  Logs stay on the console (the container logs reach Loki through Alloy in Docker mode).

### Documentation and rules

- README: an "Observability" paragraph in "Run locally" (Grafana URL, what to look at, how to jump
  from a log to its trace) and the new URLs in the tools table; troubleshooting entries.
- `docs/architecture/overview.md`: an "Observability" section (signal flow diagram, naming of
  metrics, correlation rules). This ADR moves to "accepted".
- `CLAUDE.md`: logging through the Nest `Logger` (pino behind it), never `console.*` in services;
  metric and span attribute names live in `@ticketmanager/telemetry`; new process = `--import` the
  register entry; telemetry env variables; `OTEL_SDK_DISABLED` in tests.

## 4. Delivery plan

| Phase               | Content                                                                                                          | Result                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1. Backend          | observability compose file, Alloy config, exporters, Grafana reachable, infra metrics and container logs flowing | Grafana shows RabbitMQ / PostgreSQL / Valkey dashboards and container logs                 |
| 2. Services         | `@ticketmanager/telemetry`, pino logger, `--import` wiring, env, Dockerfiles, trace correlation port             | one trace from `POST /tickets` to the email, logs with `trace_id`, RED metrics per service |
| 3. Web + dashboards | `@vercel/otel`, propagation to the services, the two committed dashboards, docs and rules                        | trace starts in the browser request; "Services overview" and "Ticket pipeline" dashboards  |
| 4. Optional         | Pyroscope profiles, alert rules (DLQ depth, outbox pending age, email failures)                                  | later, on demand                                                                           |

Each phase ends with the full `verify` suite and a commit.

## 5. Consequences

- Every process ships the OpenTelemetry SDK (startup +100–200 ms, a few MB of memory, CPU cost of
  a 10 % head sampler is negligible locally; the sampler is `OTEL_TRACES_SAMPLER` configurable).
- `pnpm infra:up` starts three more containers (~1.2 GB RAM in total); the machine has 15 GB.
- Grafana moves to port 3030 locally; 3000 stays the web app.
- Logs become JSON in Docker and pretty in the terminal; anyone grepping raw logs must use `jq`
  or Grafana.
- The backend is a dev all-in-one; production would deploy the same OTLP endpoint behind separate
  Tempo / Loki / Mimir instances or Grafana Cloud without touching the applications.

## 6. Sources

- Grafana `docker-otel-lgtm` (components, ports, provisioning, Prometheus flags, Collector pipelines)
- OpenTelemetry JS `auto-instrumentations-node` 0.82.0 (bundled instrumentations, `register` entry,
  `OTEL_NODE_*` variables); `@opentelemetry/instrumentation/hook.mjs` for ESM
- Next.js 16 guide "OpenTelemetry" (installed docs) and `@vercel/otel` README (fetch propagation,
  `propagateContextUrls`)
- Grafana Alloy `loki.source.docker`, `prometheus.scrape`, `prometheus.remote_write`
- RabbitMQ management image: `rabbitmq_prometheus` enabled (checked on the running container, port 15692)
