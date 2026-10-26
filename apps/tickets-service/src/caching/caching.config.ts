import type { ConfigService } from '@nestjs/config';
import { readEnv } from '@ticketmanager/nest-common';
import { z } from 'zod';

export const CACHING_CONFIG = Symbol('CACHING_CONFIG');

const envSchema = z.object({
  /** `false` binds a no-op store: every read goes to the database (local debugging, tests). */
  CACHE_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  /** Valkey / Redis URL (`redis://[user:password@]host:port[/db]`). */
  CACHE_URL: z.string().min(1).default('redis://localhost:6379'),
  /** Lifetime of a cached view; also the upper bound of staleness after an invalidation race. */
  CACHE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  /** A cache round trip slower than this is treated as a miss: the cache must never slow reads. */
  CACHE_TIMEOUT_MS: z.coerce.number().int().positive().default(250),
  /** Prefix of every key, so one Valkey instance can serve several services. */
  CACHE_KEY_PREFIX: z.string().default('tickets:'),
});

export interface CachingConfig {
  enabled: boolean;
  url: string;
  ttlMs: number;
  timeoutMs: number;
  keyPrefix: string;
}

export function loadCachingConfig(
  source: Pick<ConfigService, 'get'> | Partial<Record<string, string | undefined>>,
): CachingConfig {
  const e = readEnv(envSchema, source);
  return {
    enabled: e.CACHE_ENABLED,
    url: e.CACHE_URL,
    ttlMs: e.CACHE_TTL_MS,
    timeoutMs: e.CACHE_TIMEOUT_MS,
    keyPrefix: e.CACHE_KEY_PREFIX,
  };
}
