import { getAccessToken, getAccessTokenRSC } from '@logto/next/server-actions';
import {
  DIRECTORY_API_RESOURCE,
  DIRECTORY_BATCH_MAX_IDS,
  NOTIFICATIONS_API_RESOURCE,
  TICKETS_API_RESOURCE,
  type CreateTicketInput,
  type DirectoryUser,
  type DirectoryUsersResponse,
  type Notification,
  type Ticket,
  type UpdateTicketBody,
} from '@ticketmanager/contracts';
import { cache } from 'react';
import { getLogtoConfig } from './logto';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Where the call happens decides how the access token is read:
 * - `rsc`: React Server Component, read-only cookies (`getAccessTokenRSC`): a token refreshed
 *   here cannot be persisted, the SDK reads with `ignoreCookieChange: true`.
 * - `action`: Server Action or Route Handler, a refreshed token is written back to the session
 *   cookie (`getAccessToken`).
 */
type CallContext = 'rsc' | 'action';

type ServiceName = 'tickets' | 'notifications' | 'directory';

interface Service {
  name: ServiceName;
  /** Logto API resource the access token must be issued for. */
  resource: string;
}

const tickets: Service = { name: 'tickets', resource: TICKETS_API_RESOURCE };
const notifications: Service = { name: 'notifications', resource: NOTIFICATIONS_API_RESOURCE };
const directory: Service = { name: 'directory', resource: DIRECTORY_API_RESOURCE };

/**
 * Base URL of each service. Server-only, so plain (non NEXT_PUBLIC_) variables are used and read
 * at request time, not at module load: the same build runs on the host and in Docker.
 */
function getServiceUrls(): Record<ServiceName, string> {
  return {
    tickets: process.env.TICKETS_API_URL ?? 'http://localhost:3001',
    notifications: process.env.NOTIFICATIONS_API_URL ?? 'http://localhost:3002',
    directory: process.env.DIRECTORY_API_URL ?? 'http://localhost:3003',
  };
}

/**
 * Authorization header for one service. Memoised per request with React `cache()`: a render
 * that calls the same service several times (list + badge, batched directory lookups) obtains
 * the token once. The `Service` objects above are module constants, so they are stable cache keys.
 */
const bearer = cache(async (service: Service, context: CallContext): Promise<string> => {
  const config = getLogtoConfig();
  const token =
    context === 'rsc'
      ? await getAccessTokenRSC(config, service.resource)
      : await getAccessToken(config, service.resource);
  return `Bearer ${token}`;
});

async function api<T>(
  service: Service,
  path: string,
  context: CallContext,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${getServiceUrls()[service.name]}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: await bearer(service, context),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API ${init?.method ?? 'GET'} ${path} failed: ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const ticketsApi = {
  /** Server Components only. */
  list: () => api<Ticket[]>(tickets, '/tickets', 'rsc'),
  /** Server Components only. */
  get: (id: string) => api<Ticket>(tickets, `/tickets/${id}`, 'rsc'),
  /** Server Actions only. */
  create: (input: CreateTicketInput) =>
    api<Ticket>(tickets, '/tickets', 'action', { method: 'POST', body: JSON.stringify(input) }),
  /**
   * Server Actions only. `body.expectedVersion` makes the API answer 409 when the ticket changed
   * since the form was loaded.
   */
  update: (id: string, body: UpdateTicketBody) =>
    api<Ticket>(tickets, `/tickets/${id}`, 'action', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  /** Server Actions only. */
  remove: (id: string) => api<void>(tickets, `/tickets/${id}`, 'action', { method: 'DELETE' }),
};

export const notificationsApi = {
  /** Server Components only. */
  list: () => api<Notification[]>(notifications, '/notifications', 'rsc'),
  /** Server Actions only. */
  markRead: (id: string) =>
    api<void>(notifications, `/notifications/${id}/read`, 'action', { method: 'POST' }),
};

export const directoryApi = {
  /**
   * Server Components only. Profiles of the given Logto user ids; unknown ids are omitted.
   * Deduplicates and splits the ids into batches the directory accepts.
   */
  getUsers: async (ids: readonly string[]): Promise<DirectoryUser[]> => {
    const distinct = [...new Set(ids)];
    const batches: string[][] = [];
    for (let i = 0; i < distinct.length; i += DIRECTORY_BATCH_MAX_IDS) {
      batches.push(distinct.slice(i, i + DIRECTORY_BATCH_MAX_IDS));
    }
    const responses = await Promise.all(
      batches.map((batch) =>
        api<DirectoryUsersResponse>(
          directory,
          `/users?ids=${encodeURIComponent(batch.join(','))}`,
          'rsc',
        ),
      ),
    );
    return responses.flatMap((r) => r.users);
  },
};
