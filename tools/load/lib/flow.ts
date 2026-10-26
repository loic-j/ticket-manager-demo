import { sleep } from 'k6';
import { notifications, tickets } from './api.ts';
import type { Tokens } from './auth.ts';
import { notificationE2eMs, notificationsMissing } from './metrics.ts';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

const POLL_INTERVAL_S = 0.5;

/**
 * Creates a ticket, changes its status, waits until notifications-service listed the
 * `ticket_created` notification (outbox → relay → broker → consumer), records the end-to-end
 * latency, then deletes the ticket. Returns `false` when the notification never showed up.
 */
export function ticketLifecycle(tokens: Tokens, label: string, deadlineS: number): boolean {
  const started = Date.now();
  const ticket = tickets.create(tokens, label);
  tickets.setStatus(tokens, ticket.id, 'in_progress');

  let seen = false;
  while (Date.now() - started < deadlineS * 1000) {
    const found = notifications
      .list(tokens)
      .some((n) => n.ticketId === ticket.id && n.kind === 'ticket_created');
    if (found) {
      seen = true;
      notificationE2eMs.add(Date.now() - started);
      break;
    }
    sleep(POLL_INTERVAL_S);
  }
  if (!seen) notificationsMissing.add(1);

  tickets.remove(tokens, ticket.id);
  return seen;
}

/** Shared `handleSummary`: console text + a JSON file per run under /results. */
export function summary(scenario: string) {
  return (data: unknown) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
      stdout: textSummary(data, { indent: ' ', enableColors: true }),
      [`/results/${scenario}-${stamp}.json`]: JSON.stringify(data, null, 2),
    };
  };
}
