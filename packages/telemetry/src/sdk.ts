import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const DEFAULT_METRIC_EXPORT_INTERVAL_MS = 15_000;

/**
 * `pnpm dev` / `pnpm start:prod` expose the package name (`@ticketmanager/tickets-service`); the
 * entry file tells the processes of one package apart (`main.email-retry.js` → `-email-retry`).
 */
export function defaultServiceName(
  env: NodeJS.ProcessEnv,
  entry: string | undefined = process.argv[1],
): string | undefined {
  const pkg = env.npm_package_name?.replace(/^@[^/]+\//, '');
  if (!pkg) return undefined;
  const variant = entry?.match(/main\.([a-z0-9-]+)\.[cm]?js$/)?.[1];
  return variant ? `${pkg}-${variant}` : pkg;
}

/**
 * Builds and starts the OpenTelemetry Node SDK for one process (ADR 004).
 * - Traces, metrics and logs go over OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT`
 *   (default `http://localhost:4318`, the lgtm container of `pnpm infra:up`).
 * - `OTEL_SERVICE_NAME` names the process (required: every dashboard groups by it).
 * - `OTEL_SDK_DISABLED=true` turns everything off (tests, debugging without the stack).
 * - Instrumented out of the box: http/express (RED metrics and server spans), nestjs-core,
 *   pg (Prisma goes through it), amqplib (context travels in the message headers), redis
 *   (Valkey), undici/fetch (calls to other services), pino (trace ids in every log record and
 *   OTLP log export), runtime-node (event loop, heap). fs/dns/net are too noisy and disabled.
 * The sampler is the SDK default (parent-based, always on); `OTEL_TRACES_SAMPLER` overrides it.
 */
export function startTelemetry(env: NodeJS.ProcessEnv = process.env): NodeSDK | undefined {
  if (env.OTEL_SDK_DISABLED === 'true') return undefined;
  const serviceName = env.OTEL_SERVICE_NAME ?? defaultServiceName(env);
  if (!serviceName) {
    // Without a name every process would show up as "unknown_service": refuse rather than
    // pollute the dashboards (Docker sets OTEL_SERVICE_NAME, pnpm scripts set npm_package_name).
    process.stderr.write('[telemetry] OTEL_SERVICE_NAME is not set: telemetry disabled\n');
    return undefined;
  }

  const sdk = new NodeSDK({
    resource: defaultResource().merge(
      resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        'deployment.environment.name': env.NODE_ENV ?? 'development',
      }),
    ),
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: Number(
          env.OTEL_METRIC_EXPORT_INTERVAL ?? DEFAULT_METRIC_EXPORT_INTERVAL_MS,
        ),
      }),
    ],
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          // Liveness probes would dominate the request metrics.
          ignoreIncomingRequestHook: (request) => request.url === '/health',
        },
        // Cache calls only matter inside a request or a job; connection chatter is not a trace.
        '@opentelemetry/instrumentation-redis': { requireParentSpan: true },
      }),
    ],
  });
  sdk.start();

  const shutdown = () => {
    sdk.shutdown().catch(() => undefined);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  process.once('beforeExit', shutdown);
  return sdk;
}
