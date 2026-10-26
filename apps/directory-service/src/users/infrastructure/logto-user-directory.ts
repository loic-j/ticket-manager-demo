import { Logger } from '@nestjs/common';
import { directoryUserSchema, type DirectoryUser } from '@ticketmanager/contracts';
import { ServiceHttpClient, logtoClientCredentials } from '@ticketmanager/nest-common';
import { ATTR, count, directoryMetrics } from '@ticketmanager/telemetry';
import { z } from 'zod';
import type { UserDirectory } from '../application/ports/user-directory.js';
import type { UsersConfig } from '../users.config.js';

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
            resource: config.managementApi.resource,
            scope: config.managementApi.scope,
          }),
        })
      : null;
  }

  /** Strict: a Logto failure throws (`GET /users/:id` answers 500, a 404 only for unknown ids). */
  async findById(id: string): Promise<DirectoryUser | null> {
    if (!this.http) {
      this.warnOnce();
      return null;
    }
    const res = await this.http.request(`/api/users/${encodeURIComponent(id)}`).catch((error) => {
      this.record('error');
      throw error;
    });
    if (res.status === 404) {
      this.record('unknown');
      return null;
    }
    if (!res.ok) {
      this.record('error');
      throw new Error(`Logto user lookup failed: ${res.status}`);
    }
    this.record('found');
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

  /**
   * Best-effort: every id is looked up on its own and a failure (429, 5xx, timeout) only drops
   * that id from the answer, logged at warn, so one bad call never fails a whole page of users.
   * The cache in front then holds the missing id as unknown for its short negative TTL, which
   * bounds the retry pressure on Logto.
   */
  async findByIds(ids: readonly string[]): Promise<DirectoryUser[]> {
    const results: (DirectoryUser | null)[] = Array.from({ length: ids.length }, () => null);
    let next = 0;
    const worker = async () => {
      while (next < ids.length) {
        const index = next++;
        const id = ids[index]!;
        try {
          results[index] = await this.findById(id);
        } catch (error) {
          this.logger.warn(`Lookup of user ${id} failed, omitted from the batch: ${String(error)}`);
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(LOOKUP_CONCURRENCY, ids.length) }, () => worker()),
    );
    return results.filter((user): user is DirectoryUser => user !== null);
  }

  private record(outcome: 'found' | 'unknown' | 'error'): void {
    count(directoryMetrics.lookups, { [ATTR.source]: 'logto', [ATTR.outcome]: outcome });
  }

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    this.logger.warn('No LOGTO_M2M credentials: every user lookup answers "unknown"');
  }
}
