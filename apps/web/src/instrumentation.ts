import { OTLPHttpProtoTraceExporter, registerOTel } from '@vercel/otel';

/**
 * OpenTelemetry for the web app (ADR 004), loaded once by Next.js at startup. `@vercel/otel`
 * instruments the Next.js server (one root span per request, Server Components, Server Actions,
 * fetch) and exports over OTLP to `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4318`).
 * The `traceparent` header is propagated to the three services only, so a trace follows a page
 * render or a form submission down to PostgreSQL, the broker and the email.
 * `OTEL_SDK_DISABLED=true` turns it off; `NEXT_OTEL_VERBOSE=1` adds Next's internal spans.
 */
export function register() {
  if (process.env.OTEL_SDK_DISABLED === 'true') return;
  const services = [
    process.env.TICKETS_API_URL ?? 'http://localhost:3001',
    process.env.NOTIFICATIONS_API_URL ?? 'http://localhost:3002',
    process.env.DIRECTORY_API_URL ?? 'http://localhost:3003',
  ];
  // Explicit exporter: without it @vercel/otel only exports when deployed on Vercel.
  const endpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318').replace(
    /\/$/,
    '',
  );
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'web',
    traceExporter: new OTLPHttpProtoTraceExporter({ url: `${endpoint}/v1/traces` }),
    attributes: { 'deployment.environment.name': process.env.NODE_ENV ?? 'development' },
    instrumentationConfig: {
      fetch: {
        propagateContextUrls: services.map(
          (base) => new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
        ),
      },
    },
  });
}
