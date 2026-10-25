import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';

export const USERS_CONFIG = Symbol('USERS_CONFIG');

const envSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    LOGTO_ENDPOINT: z.url().default('http://localhost:3301'),
    LOGTO_M2M_APP_ID: z.string().optional(),
    LOGTO_M2M_APP_SECRET: z.string().optional(),
    DIRECTORY_CACHE_TTL_MS: z.coerce.number().int().positive().default(600_000),
    DIRECTORY_CACHE_MAX_SIZE: z.coerce.number().int().positive().default(1000),
  })
  .refine(
    (e) => e.NODE_ENV !== 'production' || Boolean(e.LOGTO_M2M_APP_ID && e.LOGTO_M2M_APP_SECRET),
    { message: 'LOGTO_M2M_APP_ID and LOGTO_M2M_APP_SECRET are required when NODE_ENV=production' },
  );

export interface UsersConfig {
  logtoEndpoint: string;
  /** `null` only outside production: every lookup then answers "unknown". */
  m2m: { appId: string; appSecret: string } | null;
  cache: { ttlMs: number; maxSize: number };
}

type Env = Partial<Record<keyof z.input<typeof envSchema>, string | undefined>>;

export function loadUsersConfig(source: Pick<ConfigService, 'get'> | Env): UsersConfig {
  const env: Env =
    'get' in source && typeof source.get === 'function'
      ? Object.fromEntries(
          Object.keys(envSchema.shape).map((key) => [key, source.get<string>(key)]),
        )
      : (source as Env);
  const e = envSchema.parse(env);
  const hasM2m = Boolean(e.LOGTO_M2M_APP_ID && e.LOGTO_M2M_APP_SECRET);
  return {
    logtoEndpoint: e.LOGTO_ENDPOINT.replace(/\/$/, ''),
    m2m: hasM2m ? { appId: e.LOGTO_M2M_APP_ID!, appSecret: e.LOGTO_M2M_APP_SECRET! } : null,
    cache: { ttlMs: e.DIRECTORY_CACHE_TTL_MS, maxSize: e.DIRECTORY_CACHE_MAX_SIZE },
  };
}
