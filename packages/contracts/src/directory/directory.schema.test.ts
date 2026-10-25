import { describe, expect, it } from 'vitest';
import { DIRECTORY_BATCH_MAX_IDS } from './directory.constants.js';
import { directoryUserIdsSchema, directoryUserSchema } from './directory.schema.js';

describe('directoryUserIdsSchema', () => {
  it('splits a comma-separated string, trims and deduplicates', () => {
    expect(directoryUserIdsSchema.parse('a, b,a,,c ')).toEqual(['a', 'b', 'c']);
  });

  it('accepts a repeated query parameter (array) mixing both forms', () => {
    expect(directoryUserIdsSchema.parse(['a,b', 'c', 'b'])).toEqual(['a', 'b', 'c']);
  });

  it('rejects an empty list', () => {
    expect(directoryUserIdsSchema.safeParse('').success).toBe(false);
    expect(directoryUserIdsSchema.safeParse(undefined).success).toBe(false);
  });

  it('caps the number of distinct ids, counted after deduplication', () => {
    const distinct = Array.from({ length: DIRECTORY_BATCH_MAX_IDS }, (_, i) => `u${i}`);
    expect(directoryUserIdsSchema.parse([...distinct, ...distinct].join(','))).toHaveLength(
      DIRECTORY_BATCH_MAX_IDS,
    );
    expect(directoryUserIdsSchema.safeParse([...distinct, 'extra'].join(',')).success).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(directoryUserIdsSchema.safeParse([1, 2]).success).toBe(false);
  });
});

describe('directoryUserSchema', () => {
  it('requires every field, each nullable except the id', () => {
    expect(directoryUserSchema.parse({ id: 'u1', name: null, email: null, avatar: null })).toEqual({
      id: 'u1',
      name: null,
      email: null,
      avatar: null,
    });
    expect(directoryUserSchema.safeParse({ id: 'u1', name: 'A' }).success).toBe(false);
    expect(
      directoryUserSchema.safeParse({ id: 'u1', name: null, email: 'nope', avatar: null }).success,
    ).toBe(false);
  });
});
