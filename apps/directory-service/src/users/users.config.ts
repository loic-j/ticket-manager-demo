import { readEnv, type EnvSource } from '@ticketmanager/nest-common';
import { z } from 'zod';

export const USERS_CONFIG = Symbol('USERS_CONFIG');

const envSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    LOGTO_ENDPOINT: z.url().default('http://localhost:3301'),
    LOGTO_M2M_APP_ID: z.string().optional(),
    LOGTO_M2M_APP_SECRET: z.string().optional(),
    /** Resource indicator of the Management API: fixed on self-hosted Logto, per tenant on Cloud. */
    LOGTO_MANAGEMENT_API_RESOURCE: z.url().default('https://default.logto.app/api'),
    /** Logto grants the Management API through the single `all` scope. */
    LOGTO_MANAGEMENT_API_SCOPE: z.string().min(1).default('all'),
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
  managementApi: { resource: string; scope: string };
  cache: { ttlMs: number; maxSize: number };
}

export function loadUsersConfig(source: EnvSource): UsersConfig {
  const e = readEnv(envSchema, source);
  const hasM2m = Boolean(e.LOGTO_M2M_APP_ID && e.LOGTO_M2M_APP_SECRET);
  return {
    logtoEndpoint: e.LOGTO_ENDPOINT.replace(/\/$/, ''),
    m2m: hasM2m ? { appId: e.LOGTO_M2M_APP_ID!, appSecret: e.LOGTO_M2M_APP_SECRET! } : null,
    managementApi: {
      resource: e.LOGTO_MANAGEMENT_API_RESOURCE,
      scope: e.LOGTO_MANAGEMENT_API_SCOPE,
    },
    cache: { ttlMs: e.DIRECTORY_CACHE_TTL_MS, maxSize: e.DIRECTORY_CACHE_MAX_SIZE },
  };
}
