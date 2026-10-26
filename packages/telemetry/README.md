# @ticketmanager/telemetry

OpenTelemetry and logging for every Node process of the project (ADR 004).

- `node --import @ticketmanager/telemetry/register dist/main.js` starts the SDK before the app:
  ESM loader hook, `.env` read for the `OTEL_*` / `LOG_*` variables, traces + metrics + logs over
  OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4318`). `OTEL_SERVICE_NAME`
  is mandatory, `OTEL_SDK_DISABLED=true` switches everything off.
- `createLoggerModule()` (root module) + `useTelemetryLogger(app)` (`main.ts`): pino behind the
  Nest `Logger`, `LOG_LEVEL`, `LOG_PRETTY=true` for the terminal, request logs, trace ids in every
  record, records exported to Loki.
- `outboxMetrics`, `cacheMetrics`, `notificationMetrics`, `directoryMetrics` + `count()`: the
  project's business instruments, recorded from infrastructure/presentation adapters only.
- `currentTraceId()` (correlate asynchronous work), `annotateSpan()` (ids on the active span).
