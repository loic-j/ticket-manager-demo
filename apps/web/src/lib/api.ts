import { getAccessToken, getAccessTokenRSC } from '@logto/next/server-actions';
import { API_RESOURCE_INDICATOR, type CreateTicketInput, type Ticket } from '@ticketmanager/shared';
import { getLogtoConfig } from './logto';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
      ? await getAccessTokenRSC(config, API_RESOURCE_INDICATOR)
      : await getAccessToken(config, API_RESOURCE_INDICATOR);
  return `Bearer ${token}`;
}

async function api<T>(path: string, context: CallContext, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
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
  /** Server Actions only. */
  create: (input: CreateTicketInput) =>
    api<Ticket>('/tickets', 'action', { method: 'POST', body: JSON.stringify(input) }),
};
