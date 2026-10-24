import { describe, expect, it } from 'vitest';
import { authUserSchema } from './auth.schema.js';

describe('authUserSchema', () => {
  it('accepts a sub alone', () => {
    expect(authUserSchema.parse({ sub: 'user_123' })).toEqual({ sub: 'user_123' });
  });

  it('rejects an empty sub', () => {
    expect(authUserSchema.safeParse({ sub: '' }).success).toBe(false);
  });
});
