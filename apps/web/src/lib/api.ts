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
  type UpdateTicketDto,
} from '@ticketmanager/contracts';
import { getLogtoConfig } from './logto';

// Server-only: the browser never calls the services, so plain (non NEXT_PUBLIC_) variables are
// used and can be set at runtime, e.g. in Docker.
const TICKETS_API_URL = process.env.TICKETS_API_URL ?? 'http://localhost:3001';
const NOTIFICATIONS_API_URL = process.env.NOTIFICATIONS_API_URL ?? 'http://localhost:3002';
const DIRECTORY_API_URL = process.env.DIRECTORY_API_URL ?? 'http://localhost:3003';

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
 * - `rsc`: React Server Component, read-only cookies (`getAccessTokenRSC`).
 * - `action`: Server Action or Route Handler, a refreshed token can be persisted (`getAccessToken`).
 */
type CallContext = 'rsc' | 'action';

interface Service {
  baseUrl: string;
  /** Logto API resource the access token must be issued for. */
  resource: string;
}

const tickets: Service = { baseUrl: TICKETS_API_URL, resource: TICKETS_API_RESOURCE };
const notifications: Service = {
  baseUrl: NOTIFICATIONS_API_URL,
  resource: NOTIFICATIONS_API_RESOURCE,
};
const directory: Service = { baseUrl: DIRECTORY_API_URL, resource: DIRECTORY_API_RESOURCE };

async function bearer(service: Service, context: CallContext): Promise<string> {
  const config = getLogtoConfig();
  const token =
    context === 'rsc'
      ? await getAccessTokenRSC(config, service.resource)
      : await getAccessToken(config, service.resource);
  return `Bearer ${token}`;
}

async function api<T>(
  service: Service,
  path: string,
  context: CallContext,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${service.baseUrl}${path}`, {
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
  /** Server Actions only. */
  update: (id: string, input: UpdateTicketDto) =>
    api<Ticket>(tickets, `/tickets/${id}`, 'action', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
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
