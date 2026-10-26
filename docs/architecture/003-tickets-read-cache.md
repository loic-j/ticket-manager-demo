# ADR 003 - tickets-service: a Valkey read cache in front of the query side

Status: accepted · Date: 2026-10-26

## 1. Context

Every `GET /tickets` and `GET /tickets/:id` hits PostgreSQL. The web BFF renders the list on each
page view and the ticket on each edit page, so the same rows are read far more often than they
change. The goal is to stop loading the database for repeated reads without weakening the
guarantees of the write side (optimistic concurrency, outbox in the same transaction).

Options considered:

| Option                                                    | Verdict                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In-process LRU (`lru-cache`)                              | Rejected: the service scales horizontally, each replica would hold a different view and invalidation could not reach the others.                                                                                                                                                  |
| `@nestjs/cache-manager` + `CacheInterceptor`              | Rejected: caches HTTP responses by URL at the controller, outside the ports; invalidation after a command is awkward and the Keyv/cacheable stack adds layers the service does not need. `cache-manager` 7 / `@keyv/redis` 6 are fine libraries but solve a more generic problem. |
| Dedicated cache port + Valkey/Redis adapter (**chosen**)  | Fits the architecture: a `CacheStore` port bound by token, a cache-aside decorator on the read port, explicit eviction by the command handlers after commit. Shared by all replicas.                                                                                              |
| Event-driven invalidation (consume own `ticket.*` events) | Rejected for now: would reintroduce the broker into the HTTP process (removed on purpose when the relay was extracted) and adds latency between commit and eviction.                                                                                                              |

Server: **Valkey 9** (Linux Foundation fork of Redis 7.2, BSD-3-Clause) rather than Redis 8
(tri-licensed RSALv2 / SSPLv1 / AGPLv3). Only core commands are used (`GET`, `SET PX`, `DEL`), so
the two are interchangeable through `CACHE_URL`; Valkey keeps the licensing question out of the
stack. Client: **node-redis** (`redis` 6), the client Redis documents as the recommended one;
`ioredis` is in maintenance mode and only wins for Cluster/Sentinel-heavy setups.

## 2. Decision

- Cross-cutting module `apps/tickets-service/src/caching/`: `CACHE_STORE` port (`get` / `set` with
  TTL / `delete`, JSON values), `RedisCacheStore` adapter (background connect, exponential
  reconnect, `disableOfflineQueue`, every round trip bounded by `CACHE_TIMEOUT_MS`, one warning per
  outage), `NoopCacheStore` for `CACHE_ENABLED=false`, `InMemoryCacheStore` for tests. The store
  **never throws**: unavailable or slow means a miss, the database stays the source of truth.
- tickets context: `TICKET_CACHE` port (`getTicket` / `setTicket` / `getList` / `setList` /
  `evict(id)`), implemented on the store with keys `ticket:<id>` and `tickets`.
  `CachingTicketReadRepository` decorates `PrismaTicketReadRepository` (cache-aside; missing
  tickets are not cached). The three command handlers call `evict(id)` **after**
  `UNIT_OF_WORK.run()` resolved, so a reader can never cache a value that has not committed; an
  eviction inside the transaction could be undone by a rollback or raced by a reader.
- Consistency bound: a reader that loaded a row just before a commit and wrote it after the
  eviction leaves a stale entry for at most `CACHE_TTL_MS` (60 s default). The API itself never
  shows this to the writer: `POST` and `PATCH` re-read through the query side after eviction.
  Lower the TTL (or add a versioned write-if-newer script) if that window ever matters.
- Infra: `valkey` service in `infra/docker-compose.yml` (no persistence, 128 MB `allkeys-lru`),
  `CACHE_URL=redis://valkey:6379` for the tickets container, healthcheck `valkey-cli ping`.
- Env: `CACHE_ENABLED`, `CACHE_URL`, `CACHE_TTL_MS`, `CACHE_TIMEOUT_MS`, `CACHE_KEY_PREFIX`.

## 3. Consequences

- Repeated reads no longer touch PostgreSQL; a Valkey outage only costs the cache.
- Command handlers now depend on one more cross-cutting port (`TICKET_CACHE`), listed as an
  explicit exception in the service rules next to `OUTBOX` and `UNIT_OF_WORK`.
- The notifications read side (`GET /notifications`) could reuse the same module when needed;
  it was left out because that list is per user and read far less often.
