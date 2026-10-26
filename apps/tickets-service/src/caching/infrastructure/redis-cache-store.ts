import { Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ATTR, cacheMetrics, count } from '@ticketmanager/telemetry';
import { createClient, type RedisClientType } from 'redis';
import type { CacheStore } from '../application/ports/cache-store.js';
import type { CachingConfig } from '../caching.config.js';

/** Longest pause between two reconnection attempts. */
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Valkey / Redis adapter (node-redis). The connection is opened in the background at startup and
 * re-established with exponential backoff after any loss; while it is down every operation is a
 * miss (`disableOfflineQueue`: commands fail at once instead of queueing) and every round trip is
 * bounded by `timeoutMs`. Values are stored as JSON under `keyPrefix + key` with a `PX` lifetime.
 */
export class RedisCacheStore implements CacheStore, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheStore.name);
  private readonly client: RedisClientType;
  private down = false;

  constructor(private readonly config: CachingConfig) {
    this.client = createClient({
      url: config.url,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: config.timeoutMs * 4,
        reconnectStrategy: (retries) => Math.min(500 * 2 ** retries, MAX_RECONNECT_DELAY_MS),
      },
    });
    // Without a listener a socket error would crash the process; one warning per outage is enough.
    this.client.on('error', (error: unknown) => this.unavailable(String(error)));
    this.client.on('ready', () => {
      if (this.down) this.logger.log('Cache connection restored');
      this.down = false;
    });
  }

  onModuleInit(): void {
    // Not awaited: the API must start even when the cache is down (reads then hit the database).
    void this.client.connect().catch((error: unknown) => this.unavailable(String(error)));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.close().catch(() => this.client.destroy());
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.client.isReady) {
      this.record('get', 'skipped');
      return undefined;
    }
    try {
      const raw = await this.bounded(this.client.get(this.key(key)));
      this.record('get', raw === null ? 'miss' : 'hit');
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch (error) {
      this.record('get', 'error');
      this.unavailable(`get ${key}: ${String(error)}`);
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    if (!this.client.isReady) {
      this.record('set', 'skipped');
      return;
    }
    try {
      await this.bounded(
        this.client.set(this.key(key), JSON.stringify(value), {
          expiration: { type: 'PX', value: ttlMs },
        }),
      );
      this.record('set', 'ok');
    } catch (error) {
      this.record('set', 'error');
      this.unavailable(`set ${key}: ${String(error)}`);
    }
  }

  async delete(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    if (!this.client.isReady) {
      this.record('delete', 'skipped');
      return;
    }
    try {
      await this.bounded(this.client.del(keys.map((k) => this.key(k))));
      this.record('delete', 'ok');
    } catch (error) {
      this.record('delete', 'error');
      this.unavailable(`delete ${keys.join(', ')}: ${String(error)}`);
    }
  }

  private record(operation: 'get' | 'set' | 'delete', result: string): void {
    count(cacheMetrics.operations, { [ATTR.operation]: operation, [ATTR.result]: result });
  }

  private key(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  private bounded<T>(operation: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`cache operation timed out after ${this.config.timeoutMs}ms`)),
        this.config.timeoutMs,
      );
    });
    return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
  }

  private unavailable(detail: string): void {
    if (this.down) return;
    this.down = true;
    this.logger.warn(`Cache unavailable, reads fall back to the database: ${detail}`);
  }
}
