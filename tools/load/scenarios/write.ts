import { instrumentHTTP } from 'https://jslib.k6.io/http-instrumentation-tempo/1.0.1/index.js';
import { issueTokens, type Tokens } from '../lib/auth.ts';
import { requireCredentials } from '../lib/config.ts';
import { summary, ticketLifecycle } from '../lib/flow.ts';

instrumentHTTP({ propagator: 'w3c' });

/**
 * Write pipeline: a constant arrival of ticket creations + status changes, each one followed
 * until its notification exists (outbox → relay → RabbitMQ → consumer → email), then deleted.
 */
export const options = {
  scenarios: {
    write: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 400,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '2m', target: 30 },
      ],
    },
  },
  thresholds: {
    api_errors: ['rate<0.01'],
    notifications_missing: ['count==0'],
    // Baseline 2026-10-26 at 10 → 30 lifecycles/s: POST p95 14 ms, PATCH p95 14 ms, e2e p95 551 ms.
    'http_req_duration{name:POST /tickets}': ['p(95)<100'],
    'http_req_duration{name:PATCH /tickets/:id}': ['p(95)<100'],
    notification_e2e_ms: ['p(95)<3000'],
  },
};

export function setup(): Tokens {
  requireCredentials();
  return issueTokens();
}

export default function (tokens: Tokens) {
  ticketLifecycle(tokens, `write ${__VU}-${__ITER}`, 30);
}

export const handleSummary = summary('write');
