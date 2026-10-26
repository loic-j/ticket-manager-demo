# ADR 005 - Load testing with k6

Status: accepted (thresholds are a first version, to be tuned on a baseline run) · Date: 2026-10-26

## 1. Context

The stack now exposes traces, metrics and logs (ADR 004). Nothing yet puts it under load: the
behaviour of the read cache, the outbox relay, the broker and the consumer under concurrency is
unknown, and a regression in latency or in the asynchronous pipeline would go unnoticed. The goal
is a repeatable, scripted load test that runs locally against `pnpm dev` or the full-Docker stack,
whose results land in the same Grafana as the application telemetry, and that can gate a change
(pass/fail thresholds).

## 2. Tool

| Option                                                                                                                              | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Grafana k6** (Go engine, scripts in JavaScript/TypeScript, native TypeScript since 1.0, single binary / `grafana/k6` image, AGPL) | **Chosen.** Thresholds give a pass/fail exit code; scenarios (ramping VUs, constant arrival rate) model both "users" and "requests per second"; `experimental-prometheus-rw` output writes the results into the Prometheus of the lgtm container, next to the application metrics; the HTTP client can send `traceparent` so a load-test request is traceable in Tempo; the official "k6 Prometheus" dashboard exists. Same vendor as the observability stack, so one UI. |
| Artillery (Node, YAML + JS)                                                                                                         | Simple and Node-native, but weaker scenario model for arrival rates, Prometheus output through a plugin, less precise under high load (Node event loop).                                                                                                                                                                                                                                                                                                                  |
| Gatling (JVM, Java/Scala/Kotlin, JS SDK)                                                                                            | Excellent reports, but a JVM toolchain in a Node monorepo and no first-class Prometheus/Grafana path.                                                                                                                                                                                                                                                                                                                                                                     |
| autocannon / wrk / hey                                                                                                              | Single-endpoint throughput tools; no multi-step scenario, no auth flow, no asynchronous end-to-end measurement.                                                                                                                                                                                                                                                                                                                                                           |

## 3. Design

### Location and runtime

- `tools/load/`: k6 scripts in TypeScript (`scenarios/*.ts`, shared `lib/` for auth, API calls,
  checks and custom metrics), `.env.example` (credentials and targets), `results/` (gitignored
  summaries). Not a workspace package: k6 runs the scripts itself, no bundler, no `node_modules`.
- k6 runs from Docker: service `k6` in `infra/compose/load.yml` (profile `load`, image
  `grafana/k6:2.3.0`, scripts mounted read-only, env from `tools/load/.env`), on the compose
  network so it reaches `lgtm:9090` and the Dockerised services, and the host services through
  `host.docker.internal` (dev mode). `TARGET=host|docker` selects the base URLs.
- Root scripts: `pnpm load:smoke`, `pnpm load:read`, `pnpm load:write`, `pnpm load:stress`
  (`docker compose … run --rm k6 run /scripts/scenarios/<name>.ts`), each printing the k6 summary
  and failing on thresholds.

### Authentication

The APIs require a Logto token. k6 uses a **dedicated machine-to-machine app**:

1. Logto console: on the tickets and notifications API resources, create the permission `load:test`;
   create the M2M role `load-tester` holding both; create the M2M app `ticketmanager-loadtest`
   with that role. (Logto issues `client_credentials` tokens for a resource only when the app
   holds a role with a permission of that resource.)
2. `tools/load/.env`: `LOADTEST_APP_ID`, `LOADTEST_APP_SECRET`, `LOGTO_ENDPOINT`.
3. k6 `setup()` fetches one token per resource (tickets, notifications) and shares them with the
   VUs; tokens are refreshed when a scenario runs longer than their lifetime.

Consequences: tickets created by the load carry `createdBy = <app id>`; their notifications are
addressed to that id, resolved as unknown by the directory, and emailed to
`NOTIFICATIONS_DEV_FALLBACK_EMAIL` (Mailpit copes with thousands of messages). Every scenario
deletes the tickets it created in `teardown()`.

### Scenarios

| Scenario         | Shape                                                                         | Traffic                                                                                                                                                              | Thresholds (first version, to tune after a baseline run)                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke`          | 1 VU, 30 s                                                                    | every endpoint once per iteration: POST, GET list, GET by id, PATCH, GET notifications, DELETE                                                                       | 0 failed checks, p95 < 300 ms. Cheap gate, run after a change.                                                                                                    |
| `read`           | ramp 0 → 50 VUs in 1 min, hold 3 min, ramp down                               | 80 % `GET /tickets`, 20 % `GET /tickets/:id` on a seeded set of 200 tickets                                                                                          | p95 < 150 ms, error rate < 1 %. Watch the Valkey hit ratio on "Ticket pipeline".                                                                                  |
| `write`          | constant arrival rate 10 req/s for 2 min, then 30 req/s for 2 min             | `POST /tickets` then `PATCH` status; after each creation, poll `GET /notifications` until the notification exists and record the custom metric `notification_e2e_ms` | API p95 < 300 ms, 409/5xx rate < 1 %, `notification_e2e_ms` p95 < 10 s, 0 missing notifications after 30 s. Exercises outbox → relay → broker → consumer → email. |
| `stress`         | ramping arrival rate 5 → 200 req/s over 5 min, mixed 70 % reads / 30 % writes | finds the knee (latency, errors, queue depth, event-loop lag)                                                                                                        | no gating thresholds, exploratory; the report records the rate at which p95 crosses 500 ms.                                                                       |
| `web` (optional) | 10 VUs, 2 min                                                                 | `GET /` anonymous (Next.js render + Logto context call)                                                                                                              | p95 < 500 ms. Signed-in pages need a browser session and stay out of scope.                                                                                       |

A `soak` variant of `write` (30 min at 10 req/s) is documented, not scripted as a pnpm command.

### Results and observability

- k6 metrics → Prometheus (remote write, `K6_PROMETHEUS_RW_SERVER_URL=http://lgtm:9090/api/v1/write`,
  trend stats p50/p95/p99), tagged with `testid=<scenario>-<timestamp>` so runs can be compared.
- Dashboard "k6 Prometheus" (community id 19665) provisioned in `infra/observability/dashboards/`.
  The application dashboards ("Services overview", "Ticket pipeline", "Infrastructure") show the
  system side during the run.
- `traceparent` sent by k6 on every request (`k6/experimental/tracing`), so a slow request in the
  k6 results can be opened in Tempo.
- `handleSummary()` writes `tools/load/results/<scenario>-<timestamp>.json` (gitignored) and prints
  the text summary.

### Documentation

- README: "Load tests" section (Logto setup for the M2M app, the four commands, where to look).
- `docs/architecture/overview.md`: a short section; this ADR moves to "accepted".
- `CLAUDE.md`: scripts live in `tools/load`, thresholds are the contract, a new endpoint gets a
  smoke step.

## 4. Delivery

1. Compose service + `tools/load` skeleton (auth, API helpers, `smoke`) and the pnpm scripts;
   run `smoke` against `pnpm dev`.
2. `read` and `write` scenarios with custom metrics and seeding/cleanup; k6 dashboard provisioned;
   first baseline runs, thresholds adjusted to the measured baseline with a margin.
3. `stress` (+ optional `web`), docs, ADR accepted.

Each step ends with the full `verify` suite and a commit. Expected duration: one session.

## 5. Consequences

- One more Logto M2M app and one more gitignored `.env` to fill.
- Load runs write into the local Prometheus/Tempo (volumes grow; `pnpm infra:down -v` resets).
- k6 is AGPL; it runs as a tool, nothing of it ships in the images.
