import { UserScope, type LogtoNextConfig } from '@logto/next';
import {
  DIRECTORY_API_RESOURCE,
  NOTIFICATIONS_API_RESOURCE,
  TICKETS_API_RESOURCE,
} from '@ticketmanager/contracts';
import { z } from 'zod';

const envSchema = z.object({
  LOGTO_ENDPOINT: z.url().default('http://localhost:3301'),
  LOGTO_APP_ID: z.string().min(1, 'LOGTO_APP_ID is required (Logto Console → Applications)'),
  LOGTO_APP_SECRET: z.string().min(1, 'LOGTO_APP_SECRET is required'),
  LOGTO_COOKIE_SECRET: z.string().min(32, 'LOGTO_COOKIE_SECRET must be at least 32 characters'),
  BASE_URL: z.url().default('http://localhost:3000'),
});

let cached: LogtoNextConfig | undefined;

/**
 * Logto SDK configuration, read lazily from the environment so that `next build` does not need
 * real credentials. Server-side only: never import this from a client component.
 */
export function getLogtoConfig(): LogtoNextConfig {
  if (cached) return cached;
  const env = envSchema.parse(process.env);
  cached = {
    endpoint: env.LOGTO_ENDPOINT,
    appId: env.LOGTO_APP_ID,
    appSecret: env.LOGTO_APP_SECRET,
    baseUrl: env.BASE_URL,
    cookieSecret: env.LOGTO_COOKIE_SECRET,
    // Secure cookies follow the public URL, not NODE_ENV: a production build served over plain
    // HTTP (local Docker stack) must still be able to set its session cookie.
    cookieSecure: env.BASE_URL.startsWith('https://'),
    scopes: [UserScope.Email, UserScope.Profile],
    // Access tokens for each backend service (every resource must exist in the Logto console;
    // adding one here requires existing sessions to sign out and in again).
    resources: [TICKETS_API_RESOURCE, NOTIFICATIONS_API_RESOURCE, DIRECTORY_API_RESOURCE],
  };
  return cached;
}
