import { instrumentHTTP } from 'https://jslib.k6.io/http-instrumentation-tempo/1.0.1/index.js';
import { issueTokens, type Tokens } from '../lib/auth.ts';
import { tickets } from '../lib/api.ts';
import { requireCredentials } from '../lib/config.ts';
import { summary } from '../lib/flow.ts';

instrumentHTTP({ propagator: 'w3c' });

const SEED_COUNT = Number(__ENV.SEED_COUNT ?? 200);

/** Read-heavy traffic on a seeded set: exercises the Valkey cache (80 % list, 20 % by id). */
export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    api_errors: ['rate<0.01'],
    // Baseline 2026-10-26 at 785 req/s: list p95 111 ms, by id p95 54 ms, cache hit ratio 99.5 %.
    'http_req_duration{name:GET /tickets}': ['p(95)<150'],
    'http_req_duration{name:GET /tickets/:id}': ['p(95)<100'],
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
  for (let i = 0; i < SEED_COUNT; i++) ids.push(tickets.create(tokens, `read seed ${i}`).id);
  return { tokens, ids };
}

export default function ({ tokens, ids }: Data) {
  if (Math.random() < 0.8) {
    tickets.list(tokens);
  } else {
    tickets.get(tokens, ids[Math.floor(Math.random() * ids.length)]);
  }
}

export function teardown({ tokens, ids }: Data) {
  for (const id of ids) tickets.remove(tokens, id);
}

export const handleSummary = summary('read');
