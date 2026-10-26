import { instrumentHTTP } from 'https://jslib.k6.io/http-instrumentation-tempo/1.0.1/index.js';
import { issueTokens, type Tokens } from '../lib/auth.ts';
import { notifications, tickets } from '../lib/api.ts';
import { requireCredentials } from '../lib/config.ts';
import { summary, ticketLifecycle } from '../lib/flow.ts';

// Every request carries a W3C traceparent: a slow request in the k6 results is a trace in Tempo.
instrumentHTTP({ propagator: 'w3c' });

/** 1 VU, 30 s: every endpoint once per iteration. The cheap gate to run after a change. */
export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    checks: ['rate==1'],
    api_errors: ['rate==0'],
    notifications_missing: ['count==0'],
    http_req_duration: ['p(95)<300'],
    notification_e2e_ms: ['p(95)<10000'],
  },
};

export function setup(): Tokens {
  requireCredentials();
  return issueTokens();
}

export default function (tokens: Tokens) {
  tickets.list(tokens);
  const created = tickets.create(tokens, `smoke ${__VU}-${__ITER}`);
  tickets.get(tokens, created.id);
  notifications.list(tokens);
  tickets.remove(tokens, created.id);
  ticketLifecycle(tokens, `smoke e2e ${__VU}-${__ITER}`, 30);
}

export const handleSummary = summary('smoke');
