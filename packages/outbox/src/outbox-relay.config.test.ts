import { describe, expect, it } from 'vitest';
import { loadOutboxRelayConfig } from './outbox-relay.config.js';

describe('loadOutboxRelayConfig', () => {
  it('applies defaults and coerces numbers from a plain env object', () => {
    const config = loadOutboxRelayConfig({
      DATABASE_URL: 'postgresql://x',
      OUTBOX_BATCH_SIZE: '10',
    });
    expect(config).toMatchObject({
      databaseUrl: 'postgresql://x',
      exchange: 'ticketmanager.events',
      batchSize: 10,
      relayIntervalMs: 500,
    });
  });

  it('reads through a ConfigService-like source', () => {
    const values: Record<string, string> = {
      DATABASE_URL: 'postgresql://y',
      EVENTS_EXCHANGE: 'ex',
    };
    const config = loadOutboxRelayConfig({ get: (key: string) => values[key] as never });
    expect(config.databaseUrl).toBe('postgresql://y');
    expect(config.exchange).toBe('ex');
  });

  it('requires the database url', () => {
    expect(() => loadOutboxRelayConfig({})).toThrow();
  });
});
