import type { CreateTicketInput, Ticket } from '@ticketmanager/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`API ${init?.method ?? 'GET'} ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export const ticketsApi = {
  list: () => api<Ticket[]>('/tickets'),
  get: (id: string) => api<Ticket>(`/tickets/${id}`),
  create: (input: CreateTicketInput) =>
    api<Ticket>('/tickets', { method: 'POST', body: JSON.stringify(input) }),
};
