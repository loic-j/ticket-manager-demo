# apps/tickets-relay-service (NestJS 12, ESM)

- The outbox relay of tickets-service as its own package, process and image, so the image ships
  only what publishing needs (Nest core, `pg`, `amqplib`, `@ticketmanager/outbox`): no Express,
  no auth, no Prisma. Keep it that way; a dependency that is not needed to publish is a bug.
- All logic lives in `@ticketmanager/outbox`; this package is `main.ts` + `app.module.ts` and
  configuration. Reads `DATABASE_URL` of **tickets-db** (same database as tickets-service, same
  table contract) and the RabbitMQ variables, through `ConfigService`.
- No migrations here: tickets-service owns the `outbox_messages` table and its migrations.
  A change to the table is coordinated through `packages/outbox/sql/outbox_messages.sql`.
- Scale with `--scale tickets-relay=N` (`infra/compose/tickets-relay.yml`); instances share the
  work through `FOR UPDATE SKIP LOCKED`.
- Env keys documented in `.env.example`; copy it to `.env` for `pnpm dev`.
