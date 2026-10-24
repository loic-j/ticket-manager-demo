import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { NOTIFICATIONS_CONFIG, type NotificationsConfig } from '../notifications.config.js';
import type { UserDirectory, UserProfile } from '../application/ports/user-directory.js';

/** Resource indicator of the Management API on a self-hosted (single tenant) Logto. */
const MANAGEMENT_API_RESOURCE = 'https://default.logto.app/api';
const PROFILE_TTL_MS = 10 * 60 * 1000;
const PROFILE_CACHE_MAX = 1000;
const REQUEST_TIMEOUT_MS = 5_000;

const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number() });
const userSchema = z.object({
  primaryEmail: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
});

/**
 * Looks users up through the Logto Management API with a machine-to-machine token
 * (`client_credentials`). Outside production, without M2M credentials, it returns the
 * development fallback address so the whole flow works locally before the M2M app exists.
 */
@Injectable()
export class LogtoUserDirectory implements UserDirectory {
  private readonly logger = new Logger(LogtoUserDirectory.name);
  private token?: { value: string; expiresAt: number };
  private tokenRequest?: Promise<string>;
  private readonly profiles = new Map<string, { profile: UserProfile; expiresAt: number }>();

  constructor(@Inject(NOTIFICATIONS_CONFIG) private readonly config: NotificationsConfig) {}

  async findById(userId: string): Promise<UserProfile | null> {
    const cached = this.profiles.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.profile;

    const profile = await this.lookup(userId);
    if (profile) this.remember(userId, profile);
    return profile;
  }

  private remember(userId: string, profile: UserProfile): void {
    if (this.profiles.size >= PROFILE_CACHE_MAX) {
      const oldest = this.profiles.keys().next().value;
      if (oldest !== undefined) this.profiles.delete(oldest);
    }
    this.profiles.set(userId, { profile, expiresAt: Date.now() + PROFILE_TTL_MS });
  }

  private async lookup(userId: string): Promise<UserProfile | null> {
    if (!this.config.m2m) {
      if (!this.config.devFallbackEmail) return null;
      this.logger.warn(`No LOGTO_M2M credentials: using fallback email for user ${userId}`);
      return { email: this.config.devFallbackEmail, name: null };
    }
    let res = await this.getUser(userId, await this.accessToken());
    if (res.status === 401) {
      // Token revoked or rotated: fetch a fresh one once.
      this.token = undefined;
      res = await this.getUser(userId, await this.accessToken());
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Logto user lookup failed: ${res.status}`);
    const user = userSchema.parse(await res.json());
    return { email: user.primaryEmail ?? null, name: user.name ?? null };
  }

  private getUser(userId: string, token: string): Promise<Response> {
    return fetch(`${this.config.logtoEndpoint}/api/users/${encodeURIComponent(userId)}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  /** Cached token, refreshed by a single in-flight request when it is about to expire. */
  private accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) {
      return Promise.resolve(this.token.value);
    }
    this.tokenRequest ??= this.requestToken().finally(() => {
      this.tokenRequest = undefined;
    });
    return this.tokenRequest;
  }

  private async requestToken(): Promise<string> {
    const { appId, appSecret } = this.config.m2m!;
    const res = await fetch(`${this.config.logtoEndpoint}/oidc/token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        resource: MANAGEMENT_API_RESOURCE,
        scope: 'all',
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Logto M2M token request failed: ${res.status}`);
    const token = tokenSchema.parse(await res.json());
    this.token = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
    return token.access_token;
  }
}
