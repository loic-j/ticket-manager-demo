import { describe, expect, it } from 'vitest';
import { parseEnvelope } from './envelope.js';
import { ticketChangedV1, ticketCreatedV1, ticketEventVersion } from './tickets/ticket.events.js';

const ticket = {
  id: '2f6a3c4e-5b1d-4e8a-9c7f-1a2b3c4d5e6f',
  title: 'Hello',
  description: '',
  status: 'open' as const,
  priority: 'high' as const,
  createdBy: 'user_a',
  updatedBy: 'user_a',
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('defineEvent', () => {
  it('creates a valid envelope with defaults', () => {
    const event = ticketCreatedV1.create({ ticket }, { actor: 'user_a' });
    expect(event).toMatchObject({
      type: 'ticket.created',
      version: 1,
      actor: 'user_a',
      payload: { ticket },
    });
    expect(() => parseEnvelope(event)).not.toThrow();
    expect(ticketCreatedV1.is(event)).toBe(true);
    expect(ticketChangedV1.is(event)).toBe(false);
    expect(ticketEventVersion(event.payload)).toBe(1);
  });

  it('rejects an invalid payload', () => {
    expect(() =>
      ticketCreatedV1.create({ ticket: { ...ticket, priority: 'nope' as never } }),
    ).toThrow();
  });

  it('round-trips through JSON and the envelope schema', () => {
    const event = ticketChangedV1.create({
      ticket: { ...ticket, version: 2, status: 'closed' },
      changedFields: ['status'],
      previousStatus: 'open',
    });
    const parsed = ticketChangedV1.schema.parse(JSON.parse(JSON.stringify(event)));
    expect(parsed).toEqual(event);
    expect(ticketEventVersion(parsed.payload)).toBe(2);
  });
});
