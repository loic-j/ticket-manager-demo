import { instrumentHTTP } from 'https://jslib.k6.io/http-instrumentation-tempo/1.0.1/index.js';
import { web } from '../lib/api.ts';
import { summary } from '../lib/flow.ts';

instrumentHTTP({ propagator: 'w3c' });

/** Anonymous home page of the Next.js app (render + Logto session check). No credentials needed. */
export const options = {
  vus: 10,
  duration: '2m',
  thresholds: { checks: ['rate==1'], http_req_duration: ['p(95)<500'] },
};

export default function () {
  web.home();
}

export const handleSummary = summary('web');
