# packages/telemetry (@ticketmanager/telemetry)

- Two entry points: `./register` (side effects: ESM hook + SDK start, used only through
  `node --import`) and `.` (logger module, metric instruments, span helpers; imports
  `@opentelemetry/api` only, never the SDK). Keep that split: adapters must stay no-op-safe
  without the SDK (tests).
- New business metric: declare it here (`metrics.ts`, `ticketmanager.<context>.<name>`, attribute
  keys in `ATTR`), record it from an infrastructure or presentation adapter, add it to the
  dashboards in `infra/observability/dashboards/`.
- No dependency on `@ticketmanager/nest-common`: the relay image uses this package and must not
  ship auth/ORM code.
- Instrumentation choices (disabled fs/dns/net, `/health` ignored, 15 s metric export) live in
  `sdk.ts`; env variables are the standard `OTEL_*` ones plus `LOG_LEVEL` / `LOG_PRETTY`.
