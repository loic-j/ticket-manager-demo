import { describe, expect, it } from 'vitest';
import { parseEnvelope } from './envelope.js';
import { ticketCreatedV1, ticketUpdatedV1 } from './tickets/ticket.events.js';

describe('defineEvent', () => {
  const payload = {
    ticketId: '2f6a3c4e-5b1d-4e8a-9c7f-1a2b3c4d5e6f',
    title: 'Hello',
    priority: 'high' as const,
    createdBy: 'user_a',
  };

  it('creates a valid envelope with defaults', () => {
    const event = ticketCreatedV1.create(payload, { actor: 'user_a' });
    expect(event).toMatchObject({ type: 'ticket.created', version: 1, actor: 'user_a', payload });
    expect(() => parseEnvelope(event)).not.toThrow();
    expect(ticketCreatedV1.is(event)).toBe(true);
    expect(ticketUpdatedV1.is(event)).toBe(false);
  });

  it('rejects an invalid payload', () => {
    expect(() => ticketCreatedV1.create({ ...payload, priority: 'nope' as never })).toThrow();
  });

  it('round-trips through JSON and the envelope schema', () => {
    const event = ticketCreatedV1.create(payload);
    const parsed = ticketCreatedV1.schema.parse(JSON.parse(JSON.stringify(event)));
    expect(parsed).toEqual(event);
  });
});
