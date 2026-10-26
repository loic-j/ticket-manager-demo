import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_STORE } from './application/ports/index.js';
import { CACHING_CONFIG, loadCachingConfig, type CachingConfig } from './caching.config.js';
import { NoopCacheStore } from './infrastructure/noop-cache-store.js';
import { RedisCacheStore } from './infrastructure/redis-cache-store.js';

/**
 * Read cache shared by the contexts of this service (`CACHE_STORE`): Valkey / Redis through
 * node-redis, or a no-op store when `CACHE_ENABLED=false`. Tests override `CACHE_STORE` with
 * `InMemoryCacheStore` from `infrastructure/testing.ts`.
 */
@Global()
@Module({
  providers: [
    {
      provide: CACHING_CONFIG,
      useFactory: (config: ConfigService) => loadCachingConfig(config),
      inject: [ConfigService],
    },
    {
      provide: CACHE_STORE,
      useFactory: (config: CachingConfig) =>
        config.enabled ? new RedisCacheStore(config) : new NoopCacheStore(),
      inject: [CACHING_CONFIG],
    },
  ],
  exports: [CACHE_STORE, CACHING_CONFIG],
})
export class CachingModule {}
