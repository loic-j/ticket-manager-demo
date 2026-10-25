import { describe, expect, it } from 'vitest';
import { createTicketSchema, ticketSchema, updateTicketBodySchema } from './ticket.schema.js';

describe('createTicketSchema', () => {
  it('applies defaults', () => {
    const parsed = createTicketSchema.parse({ title: 'Printer on fire' });
    expect(parsed).toEqual({ title: 'Printer on fire', description: '', priority: 'medium' });
  });

  it('rejects an empty title', () => {
    expect(createTicketSchema.safeParse({ title: '   ' }).success).toBe(false);
  });
});

describe('ticketSchema', () => {
  it('accepts a complete ticket', () => {
    const now = new Date().toISOString();
    const result = ticketSchema.safeParse({
      id: '2f6a3c4e-5b1d-4e8a-9c7f-1a2b3c4d5e6f',
      title: 'Hello',
      description: '',
      status: 'open',
      priority: 'low',
      createdBy: 'user_a',
      updatedBy: 'user_a',
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
  });

  it('bounds the user ids like every other contract', () => {
    const now = new Date().toISOString();
    const ticket = {
      id: '2f6a3c4e-5b1d-4e8a-9c7f-1a2b3c4d5e6f',
      title: 'Hello',
      description: '',
      status: 'open',
      priority: 'low',
      createdBy: 'x'.repeat(129),
      updatedBy: 'user_a',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    expect(ticketSchema.safeParse(ticket).success).toBe(false);
    expect(ticketSchema.safeParse({ ...ticket, createdBy: 'x'.repeat(128) }).success).toBe(true);
  });
});

describe('updateTicketBodySchema', () => {
  it('accepts the editable fields with an optional expected version', () => {
    expect(updateTicketBodySchema.parse({ title: 'x', expectedVersion: 3 })).toEqual({
      title: 'x',
      expectedVersion: 3,
    });
    expect(updateTicketBodySchema.parse({ status: 'closed' })).toEqual({ status: 'closed' });
  });

  it('rejects a non-positive expected version', () => {
    expect(updateTicketBodySchema.safeParse({ expectedVersion: 0 }).success).toBe(false);
  });
});
