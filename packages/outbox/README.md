# @ticketmanager/outbox

The publishing side of the transactional outbox, shared by every service that produces
integration events: a relay that polls `outbox_messages`, publishes the stored envelopes to the
RabbitMQ topic exchange with publisher confirms and marks the rows. Plain `pg`, no ORM, so a
relay process ships without the producing service's code or dependencies.

The write side stays in each service (append rows inside the aggregate's transaction with its
own ORM); this package only owns the **table contract** (`sql/outbox_messages.sql`) and the
relay.

## Use

```ts
// relay entry point (headless process, its own image)
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    OutboxRelayModule.forRootAsync({
      useFactory: (config: ConfigService) => loadOutboxRelayConfig(config),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

Env: `DATABASE_URL` (the producing service's database), `RABBITMQ_URL`, `EVENTS_EXCHANGE`,
`OUTBOX_RELAY_INTERVAL_MS`, `OUTBOX_BATCH_SIZE`, `OUTBOX_MAX_ATTEMPTS`, `BROKER_TIMEOUT_MS`.

## Table contract

A producing service adds the table from `sql/outbox_messages.sql` to its own migrations. With
Prisma, the matching model is:

```prisma
model OutboxMessage {
  id            String    @id @db.Uuid
  sequence      BigInt    @unique @default(autoincrement())
  type          String    @db.VarChar(100)
  version       Int
  aggregateType String    @map("aggregate_type") @db.VarChar(50)
  aggregateId   String    @map("aggregate_id") @db.Uuid
  payload       Json
  occurredAt    DateTime  @map("occurred_at")
  publishedAt   DateTime? @map("published_at")
  attempts      Int       @default(0)
  lastError     String?   @map("last_error")

  @@index([publishedAt, sequence], name: "outbox_unpublished_idx")
  @@map("outbox_messages")
}
```

## Guarantees

- At-least-once: a crash between publish and mark republishes the batch; consumers deduplicate
  on the envelope `id`.
- Horizontally scalable: instances take distinct batches through `FOR UPDATE SKIP LOCKED`.
  Publication order is best effort; consumers rely on the aggregate `version` in every event.
- Unparsable rows are quarantined (`attempts` = `OUTBOX_MAX_ATTEMPTS`, `last_error` set) and
  skipped; a broker failure increments `attempts` and keeps the rows.

`pnpm --filter @ticketmanager/outbox test:int` runs the relay against tickets-db and RabbitMQ
(`pnpm infra:up` first).
