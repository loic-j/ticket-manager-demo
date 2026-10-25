import { readEnv, type EnvSource } from '@ticketmanager/nest-common';
import { z } from 'zod';

export const NOTIFICATIONS_CONFIG = Symbol('NOTIFICATIONS_CONFIG');

/**
 * Lower bound of `EMAIL_RETRY_DELAY_MS`. The retry worker only claims rows created (and last
 * tried) more than the delay ago, so a first delivery still in progress in the consumer (directory
 * lookup: up to two 5 s attempts, then the SMTP round trip) is never re-sent concurrently.
 */
export const MIN_EMAIL_RETRY_DELAY_MS = 15_000;

const envSchema = z
  .object({
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
    /** A notification is retried only if created and last tried more than this ago. */
    EMAIL_RETRY_DELAY_MS: z.coerce
      .number()
      .int()
      .min(MIN_EMAIL_RETRY_DELAY_MS, {
        message: `EMAIL_RETRY_DELAY_MS must be at least ${MIN_EMAIL_RETRY_DELAY_MS} ms, longer than a first delivery attempt`,
      })
      .default(60_000),
    EMAIL_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  })
  .refine(
    (e) => e.NODE_ENV !== 'production' || Boolean(e.LOGTO_M2M_APP_ID && e.LOGTO_M2M_APP_SECRET),
    { message: 'LOGTO_M2M_APP_ID and LOGTO_M2M_APP_SECRET are required when NODE_ENV=production' },
  );

export interface NotificationsConfig {
  logtoEndpoint: string;
  /** `null` only outside production: recipients then come from `DevFallbackUserDirectory`. */
  m2m: { appId: string; appSecret: string } | null;
  directoryApiUrl: string;
  devFallbackEmail: string | null;
  smtpUrl: string;
  mailFrom: string;
  emailRetryIntervalMs: number;
  emailRetryDelayMs: number;
  emailMaxAttempts: number;
}

export function loadNotificationsConfig(source: EnvSource): NotificationsConfig {
  const e = readEnv(envSchema, source);
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
