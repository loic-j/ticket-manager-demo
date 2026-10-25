import { Logger } from '@nestjs/common';
import { directoryUserSchema, type DirectoryUser } from '@ticketmanager/contracts';
import { ServiceHttpClient, logtoClientCredentials } from '@ticketmanager/nest-common';
import { z } from 'zod';
import type { UserDirectory } from '../application/ports/user-directory.js';
import type { UsersConfig } from '../users.config.js';

/** Resource indicator of the Management API on a self-hosted (single tenant) Logto. */
const MANAGEMENT_API_RESOURCE = 'https://default.logto.app/api';
/** Logto has no batch-by-id endpoint: `findByIds` fans out, at most this many calls in flight. */
const LOOKUP_CONCURRENCY = 8;

const emailSchema = z.email();
const logtoUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable().optional(),
  primaryEmail: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
});

/**
 * Looks users up through the Logto Management API with a machine-to-machine token. Outside
 * production, without M2M credentials, every id is unknown so the rest of the stack keeps
 * working before the M2M app exists in the Logto console.
 */
export class LogtoUserDirectory implements UserDirectory {
  private readonly logger = new Logger(LogtoUserDirectory.name);
  private readonly http: ServiceHttpClient | null;
  private warned = false;

  constructor(config: UsersConfig) {
    this.http = config.m2m
      ? new ServiceHttpClient({
          baseUrl: config.logtoEndpoint,
          tokens: logtoClientCredentials({
            endpoint: config.logtoEndpoint,
            appId: config.m2m.appId,
            appSecret: config.m2m.appSecret,
            resource: MANAGEMENT_API_RESOURCE,
            scope: 'all',
          }),
        })
      : null;
  }

  async findById(id: string): Promise<DirectoryUser | null> {
    if (!this.http) {
      this.warnOnce();
      return null;
    }
    const res = await this.http.request(`/api/users/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Logto user lookup failed: ${res.status}`);
    const user = logtoUserSchema.parse(await res.json());
    // A malformed stored address must not turn the whole batch into a 500: it becomes `null`.
    const email = emailSchema.safeParse(user.primaryEmail);
    return directoryUserSchema.parse({
      id: user.id,
      name: user.name ?? null,
      email: email.success ? email.data : null,
      avatar: user.avatar ?? null,
    });
  }

  async findByIds(ids: readonly string[]): Promise<DirectoryUser[]> {
    const results: (DirectoryUser | null)[] = Array.from({ length: ids.length }, () => null);
    let next = 0;
    const worker = async () => {
      while (next < ids.length) {
        const index = next++;
        results[index] = await this.findById(ids[index]!);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(LOOKUP_CONCURRENCY, ids.length) }, () => worker()),
    );
    return results.filter((user): user is DirectoryUser => user !== null);
  }

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    this.logger.warn('No LOGTO_M2M credentials: every user lookup answers "unknown"');
  }
}
