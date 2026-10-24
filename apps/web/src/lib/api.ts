import { getAccessToken, getAccessTokenRSC } from '@logto/next/server-actions';
import {
  NOTIFICATIONS_API_RESOURCE,
  TICKETS_API_RESOURCE,
  type CreateTicketInput,
  type Notification,
  type Ticket,
  type UpdateTicketDto,
} from '@ticketmanager/contracts';
import { getLogtoConfig } from './logto';

// Server-only: the browser never calls the services, so plain (non NEXT_PUBLIC_) variables are
// used and can be set at runtime, e.g. in Docker.
const TICKETS_API_URL = process.env.TICKETS_API_URL ?? 'http://localhost:3001';
const NOTIFICATIONS_API_URL = process.env.NOTIFICATIONS_API_URL ?? 'http://localhost:3002';

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
