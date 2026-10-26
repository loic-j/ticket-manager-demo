import http, { type RefinedResponse, type ResponseType } from 'k6/http';
import { check, fail } from 'k6';
import { config } from './config.ts';
import { apiErrors } from './metrics.ts';
import type { Tokens } from './auth.ts';

export interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  version: number;
}

export interface Notification {
  id: string;
  kind: string;
  ticketId: string;
  readAt: string | null;
}

type Response = RefinedResponse<ResponseType | undefined>;

function call(
  token: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  name: string,
  body?: unknown,
  expected: number[] = [200],
): Response {
  const res = http.request(method, url, body === undefined ? null : JSON.stringify(body), {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    tags: { name },
  });
  const ok = expected.includes(res.status);
  apiErrors.add(!ok);
  check(res, { [`${name} → ${expected.join('/')}`]: () => ok });
  return res;
}

export const tickets = {
  create(tokens: Tokens, suffix: string): Ticket {
    const res = call(
      tokens.tickets,
      'POST',
      `${config.urls.tickets}/tickets`,
      'POST /tickets',
      {
        title: `k6 ${suffix}`,
        description: 'created by the k6 load test',
        priority: 'low',
      },
      [201],
    );
    if (res.status !== 201) fail(`ticket not created: ${res.status}`);
    return res.json() as unknown as Ticket;
  },
  list(tokens: Tokens): Ticket[] {
    const res = call(tokens.tickets, 'GET', `${config.urls.tickets}/tickets`, 'GET /tickets');
    return res.status === 200 ? (res.json() as unknown as Ticket[]) : [];
  },
  get(tokens: Tokens, id: string): Ticket | null {
    const res = call(
      tokens.tickets,
      'GET',
      `${config.urls.tickets}/tickets/${id}`,
      'GET /tickets/:id',
    );
    return res.status === 200 ? (res.json() as unknown as Ticket) : null;
  },
  setStatus(tokens: Tokens, id: string, status: string): Ticket | null {
    const res = call(
      tokens.tickets,
      'PATCH',
      `${config.urls.tickets}/tickets/${id}`,
      'PATCH /tickets/:id',
      { status },
    );
    return res.status === 200 ? (res.json() as unknown as Ticket) : null;
  },
  remove(tokens: Tokens, id: string): void {
    call(
      tokens.tickets,
      'DELETE',
      `${config.urls.tickets}/tickets/${id}`,
      'DELETE /tickets/:id',
      undefined,
      [204, 404],
    );
  },
};

export const notifications = {
  list(tokens: Tokens): Notification[] {
    const res = call(
      tokens.notifications,
      'GET',
      `${config.urls.notifications}/notifications`,
      'GET /notifications',
    );
    return res.status === 200 ? (res.json() as unknown as Notification[]) : [];
  },
};

export const web = {
  home(): void {
    const res = http.get(`${config.urls.web}/`, { tags: { name: 'GET / (web)' } });
    check(res, { 'web home → 200': (r) => r.status === 200 });
  },
};
