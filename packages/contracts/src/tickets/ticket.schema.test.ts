import { describe, expect, it } from 'vitest';
import { createTicketSchema, ticketSchema } from './ticket.schema.js';

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
});
