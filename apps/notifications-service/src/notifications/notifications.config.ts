import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';

export const NOTIFICATIONS_CONFIG = Symbol('NOTIFICATIONS_CONFIG');

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  LOGTO_ENDPOINT: z.url().default('http://localhost:3301'),
  LOGTO_M2M_APP_ID: z.string().optional(),
  LOGTO_M2M_APP_SECRET: z.string().optional(),
  /** directory-service, called with an M2M token to resolve recipient emails. */
  DIRECTORY_API_URL: z.url().default('http://localhost:3003'),
  /** Development only: ignored when NODE_ENV=production. */
  NOTIFICATIONS_DEV_FALLBACK_EMAIL: z.email().optional(),
  SMTP_URL: z.string().min(1).default('smtp://localhost:1025'),
  MAIL_FROM: z.string().min(1).default('Ticket Manager <noreply@ticketmanager.local>'),
  EMAIL_RETRY_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  /** A notification is retried only if its last attempt is older than this. */
  EMAIL_RETRY_DELAY_MS: z.coerce.number().int().positive().default(60_000),
  EMAIL_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
});

export interface NotificationsConfig {
  logtoEndpoint: string;
  m2m: { appId: string; appSecret: string } | null;
  directoryApiUrl: string;
  devFallbackEmail: string | null;
  smtpUrl: string;
  mailFrom: string;
  emailRetryIntervalMs: number;
  emailRetryDelayMs: number;
  emailMaxAttempts: number;
}

type Env = Partial<Record<keyof z.input<typeof envSchema>, string | undefined>>;

export function loadNotificationsConfig(
  source: Pick<ConfigService, 'get'> | Env,
): NotificationsConfig {
  const env: Env =
    'get' in source && typeof source.get === 'function'
      ? Object.fromEntries(
          Object.keys(envSchema.shape).map((key) => [key, source.get<string>(key)]),
        )
      : (source as Env);
  const e = envSchema.parse(env);
  const hasM2m = Boolean(e.LOGTO_M2M_APP_ID && e.LOGTO_M2M_APP_SECRET);
  const production = e.NODE_ENV === 'production';
  return {
    logtoEndpoint: e.LOGTO_ENDPOINT.replace(/\/$/, ''),
    m2m: hasM2m ? { appId: e.LOGTO_M2M_APP_ID!, appSecret: e.LOGTO_M2M_APP_SECRET! } : null,
    directoryApiUrl: e.DIRECTORY_API_URL.replace(/\/$/, ''),
    devFallbackEmail: production ? null : (e.NOTIFICATIONS_DEV_FALLBACK_EMAIL ?? null),
    smtpUrl: e.SMTP_URL,
    mailFrom: e.MAIL_FROM,
    emailRetryIntervalMs: e.EMAIL_RETRY_INTERVAL_MS,
    emailRetryDelayMs: e.EMAIL_RETRY_DELAY_MS,
    emailMaxAttempts: e.EMAIL_MAX_ATTEMPTS,
  };
}
