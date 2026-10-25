import { describe, expect, it } from 'vitest';
import { authUserSchema, userIdSchema } from './auth.schema.js';

describe('userIdSchema', () => {
  it('trims and bounds the id', () => {
    expect(userIdSchema.parse(' user_123 ')).toBe('user_123');
    expect(userIdSchema.parse('x'.repeat(128))).toHaveLength(128);
    expect(userIdSchema.safeParse('x'.repeat(129)).success).toBe(false);
    expect(userIdSchema.safeParse('   ').success).toBe(false);
  });
});

describe('authUserSchema', () => {
  it('accepts a sub alone', () => {
    expect(authUserSchema.parse({ sub: 'user_123' })).toEqual({ sub: 'user_123' });
  });

  it('rejects an empty sub', () => {
    expect(authUserSchema.safeParse({ sub: '' }).success).toBe(false);
  });
});
