import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { readEnv } from './read-env.js';

const schema = z.object({
  PORT: z.coerce.number().int().default(3000),
  NAME: z.string().min(1),
});

describe('readEnv', () => {
  it('reads from a plain object and applies defaults', () => {
    expect(readEnv(schema, { NAME: 'svc' })).toEqual({ PORT: 3000, NAME: 'svc' });
  });

  it('reads every schema key through a ConfigService-like get()', () => {
    const values: Record<string, string> = { PORT: '4000', NAME: 'svc', OTHER: 'ignored' };
    const asked: string[] = [];
    const source = {
      get<T = string>(key: string): T | undefined {
        asked.push(key);
        return values[key] as T | undefined;
      },
    };
    expect(readEnv(schema, source)).toEqual({ PORT: 4000, NAME: 'svc' });
    expect(asked.sort()).toEqual(['NAME', 'PORT']);
  });

  it('throws on invalid input', () => {
    expect(() => readEnv(schema, {})).toThrow();
  });
});
