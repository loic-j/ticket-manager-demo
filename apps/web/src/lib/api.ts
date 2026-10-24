import { getAccessToken, getAccessTokenRSC } from '@logto/next/server-actions';
import {
  TICKETS_API_RESOURCE,
  type CreateTicketInput,
  type Ticket,
  type UpdateTicketDto,
} from '@ticketmanager/contracts';
import { getLogtoConfig } from './logto';

// Server-only: the browser never calls the API, so a plain (non NEXT_PUBLIC_) variable is used
// and can be set at runtime, e.g. in Docker.
const TICKETS_API_URL = process.env.TICKETS_API_URL ?? 'http://localhost:3001';

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

async function bearer(context: CallContext): Promise<string> {
  const config = getLogtoConfig();
  const token =
    context === 'rsc'
      ? await getAccessTokenRSC(config, TICKETS_API_RESOURCE)
      : await getAccessToken(config, TICKETS_API_RESOURCE);
  return `Bearer ${token}`;
}

async function api<T>(path: string, context: CallContext, init?: RequestInit): Promise<T> {
  const res = await fetch(`${TICKETS_API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: await bearer(context),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API ${init?.method ?? 'GET'} ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export const ticketsApi = {
  /** Server Components only. */
  list: () => api<Ticket[]>('/tickets', 'rsc'),
  /** Server Components only. */
  get: (id: string) => api<Ticket>(`/tickets/${id}`, 'rsc'),
  /** Server Actions only. */
  create: (input: CreateTicketInput) =>
    api<Ticket>('/tickets', 'action', { method: 'POST', body: JSON.stringify(input) }),
  /** Server Actions only. */
  update: (id: string, input: UpdateTicketDto) =>
    api<Ticket>(`/tickets/${id}`, 'action', { method: 'PATCH', body: JSON.stringify(input) }),
};
