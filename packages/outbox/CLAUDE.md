# packages/outbox (@ticketmanager/outbox)

- Publishing side of the outbox only: `OutboxRelay`, `RabbitMqEventPublisher`, `OutboxDatabase`
  (`pg` pool), `loadOutboxRelayConfig`, `OutboxRelayModule.forRootAsync`. No business
  code, no ORM: the relay must stay deployable without any service's code.
- `sql/outbox_messages.sql` is the table contract. A column change goes there first, then in
  every producing service's Prisma schema + migration, then in the relay's SQL.
- Write side (`Outbox` port, Prisma adapter, unit of work) belongs to each service.
- A broker failure never touches `attempts` (the relay backs off instead); `attempts` only
  quarantines unparsable rows.
- Tests: `vitest run` (config), `test:int` against tickets-db + RabbitMQ (`pnpm infra:up`).
