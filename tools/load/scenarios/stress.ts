import { instrumentHTTP } from 'https://jslib.k6.io/http-instrumentation-tempo/1.0.1/index.js';
import { issueTokens, type Tokens } from '../lib/auth.ts';
import { tickets } from '../lib/api.ts';
import { requireCredentials } from '../lib/config.ts';
import { summary, ticketLifecycle } from '../lib/flow.ts';

instrumentHTTP({ propagator: 'w3c' });

/**
 * Exploratory: the arrival rate climbs until the stack bends. No gating threshold; read the knee
 * on the k6 and "Services overview" dashboards (latency, errors, queue depth, event loop).
 */
export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { duration: '5m', target: 200 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    // Informative only (abortOnFail false): the run completes and reports where it broke.
    'http_req_duration{name:GET /tickets}': [{ threshold: 'p(95)<500', abortOnFail: false }],
    api_errors: [{ threshold: 'rate<0.05', abortOnFail: false }],
  },
};

interface Data {
  tokens: Tokens;
  ids: string[];
}

export function setup(): Data {
  requireCredentials();
  const tokens = issueTokens();
  const ids: string[] = [];
  for (let i = 0; i < 100; i++) ids.push(tickets.create(tokens, `stress seed ${i}`).id);
  return { tokens, ids };
}

export default function ({ tokens, ids }: Data) {
  const dice = Math.random();
  if (dice < 0.5) tickets.list(tokens);
  else if (dice < 0.7) tickets.get(tokens, ids[Math.floor(Math.random() * ids.length)]);
  else ticketLifecycle(tokens, `stress ${__VU}-${__ITER}`, 20);
}

export function teardown({ tokens, ids }: Data) {
  for (const id of ids) tickets.remove(tokens, id);
}

export const handleSummary = summary('stress');
