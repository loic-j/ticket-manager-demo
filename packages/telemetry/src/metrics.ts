import { metrics, trace, type Attributes } from '@opentelemetry/api';

/**
 * Business instruments of the project, declared once so names and attributes stay consistent
 * across services and dashboards. They are recorded from infrastructure and presentation
 * adapters only (never from domain or application code). Instruments created before the SDK
 * started are no-ops until then, and stay no-ops without the SDK (tests).
 */
const meter = metrics.getMeter('ticketmanager');

export const ATTR = {
  operation: 'operation',
  result: 'result',
  outcome: 'outcome',
  source: 'source',
  eventType: 'event.type',
} as const;

export const outboxMetrics = {
  /** Envelopes confirmed by the broker. */
  published: meter.createCounter('ticketmanager.outbox.published', {
    description: 'Outbox messages published and confirmed by the broker',
    unit: '{message}',
  }),
  /** Batches the broker refused or that timed out (the relay then backs off). */
  publishFailures: meter.createCounter('ticketmanager.outbox.publish_failures', {
    description: 'Outbox batches that failed to publish',
    unit: '{batch}',
  }),
  quarantined: meter.createCounter('ticketmanager.outbox.quarantined', {
    description: 'Outbox rows whose payload could not be parsed',
    unit: '{message}',
  }),
  batchSize: meter.createHistogram('ticketmanager.outbox.batch_size', {
    description: 'Rows handled per relay batch',
    unit: '{message}',
  }),
};

export const cacheMetrics = {
  /** `operation` = get | set | delete, `result` = hit | miss | ok | error | skipped. */
  operations: meter.createCounter('ticketmanager.cache.operations', {
    description: 'Read-cache operations by result',
    unit: '{operation}',
  }),
};

export const notificationMetrics = {
  /** `result` = created | duplicate | stale | ignored | failed, `event.type` = routing key. */
  events: meter.createCounter('ticketmanager.notifications.events', {
    description: 'Ticket events handled by notifications-service, by outcome',
    unit: '{event}',
  }),
  /** `outcome` = sent | failed. */
  emails: meter.createCounter('ticketmanager.notifications.emails', {
    description: 'Notification emails handed to SMTP, by outcome',
    unit: '{email}',
  }),
  emailRetryRuns: meter.createCounter('ticketmanager.notifications.email_retry.runs', {
    description: 'Email retry worker runs',
    unit: '{run}',
  }),
  emailRetried: meter.createHistogram('ticketmanager.notifications.email_retry.retried', {
    description: 'Notifications re-sent per email retry run',
    unit: '{notification}',
  }),
};

export const directoryMetrics = {
  /** `source` = logto | cache, `outcome` = found | unknown | error. */
  lookups: meter.createCounter('ticketmanager.directory.lookups', {
    description: 'User profile lookups, by source and outcome',
    unit: '{lookup}',
  }),
};

/** Shorthand for `counter.add(1, attributes)`. */
export function count(
  counter: { add(value: number, attributes?: Attributes): void },
  attributes: Attributes,
): void {
  counter.add(1, attributes);
}

/** Trace id of the span the caller runs in, if any (to correlate asynchronous work). */
export function currentTraceId(): string | undefined {
  const context = trace.getActiveSpan()?.spanContext();
  return context && context.traceId !== '00000000000000000000000000000000'
    ? context.traceId
    : undefined;
}

/** Adds attributes to the active span, if any (presentation adapters: ids, event types…). */
export function annotateSpan(attributes: Attributes): void {
  trace.getActiveSpan()?.setAttributes(attributes);
}
