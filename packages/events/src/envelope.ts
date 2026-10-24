import { randomUUID } from 'node:crypto';
import { z } from 'zod';

/** Fields shared by every integration event; `payload` is refined per event by `defineEvent`. */
export const eventEnvelopeSchema = z.object({
  /** Unique id, also the consumer's deduplication key. */
  id: z.uuid(),
  /** Routing key, e.g. `ticket.created`. */
  type: z.string().min(1),
  /** Schema version of the payload. */
  version: z.number().int().positive(),
  occurredAt: z.iso.datetime(),
  /** Propagated from the HTTP request that caused the event, when known. */
  correlationId: z.string().min(1).optional(),
  /** Logto `sub` of the user who caused the event, when known. */
  actor: z.string().min(1).optional(),
  payload: z.unknown(),
});
export type EventEnvelope<P = unknown> = Omit<z.infer<typeof eventEnvelopeSchema>, 'payload'> & {
  payload: P;
};

export interface EventMeta {
  correlationId?: string;
  actor?: string;
  occurredAt?: string;
  id?: string;
}

export interface EventDefinition<T extends string, V extends number, P> {
  readonly type: T;
  readonly version: V;
  readonly payloadSchema: z.ZodType<P>;
  /** Full envelope schema for this event (type and version are literal). */
  readonly schema: z.ZodType<EventEnvelope<P>>;
  /** Builds a valid envelope; throws if the payload does not match the schema. */
  create(payload: P, meta?: EventMeta): EventEnvelope<P>;
  /** `true` when an unknown envelope is this event (same type and version). */
  is(envelope: EventEnvelope): envelope is EventEnvelope<P>;
}

export function defineEvent<T extends string, V extends number, P>(
  type: T,
  version: V,
  payloadSchema: z.ZodType<P>,
): EventDefinition<T, V, P> {
  const schema = eventEnvelopeSchema.extend({
    type: z.literal(type),
    version: z.literal(version),
    payload: payloadSchema,
  }) as unknown as z.ZodType<EventEnvelope<P>>;

  return {
    type,
    version,
    payloadSchema,
    schema,
    create(payload, meta = {}) {
      return schema.parse({
        id: meta.id ?? randomUUID(),
        type,
        version,
        occurredAt: meta.occurredAt ?? new Date().toISOString(),
        correlationId: meta.correlationId,
        actor: meta.actor,
        payload,
      });
    },
    is(envelope): envelope is EventEnvelope<P> {
      return envelope.type === type && envelope.version === version;
    },
  };
}

/** Validates the envelope of an incoming message without knowing its payload type. */
export function parseEnvelope(input: unknown): EventEnvelope {
  return eventEnvelopeSchema.parse(input);
}
