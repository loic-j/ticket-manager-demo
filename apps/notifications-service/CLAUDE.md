# apps/notifications-service (NestJS 12, ESM, Prisma 7)

Same rules and layout as `apps/tickets-service/CLAUDE.md` (read it first). Specifics:

- Inbound: `src/messaging/presentation/ticket-events.consumer.ts` consumes the **quorum** queue
  `notifications.tickets` (bound to `ticket.#`), dispatches `HandleTicketEventCommand`, acks on
  success, nacks with backoff on failure; the broker dead-letters after `CONSUMER_DELIVERY_LIMIT`
  deliveries to `<exchange>.dlx` → `notifications.tickets.dead`. Unparsable messages are
  dead-lettered at once. Handlers run concurrently (`CONSUMER_PREFETCH`): no ordering guarantee.
  Changing queue arguments requires deleting the queue first (RabbitMQ refuses to redeclare).
- Idempotency and ordering: `PROCESSED_EVENTS.claim(eventId)` and `TICKET_VERSIONS.advance(ticketId,
version)` run inside `UNIT_OF_WORK.run()` with the notification insert; a duplicate returns
  `'duplicate'`, an older version `'stale'`, both are acked. The email is sent after
  the commit by `EmailDeliveryService` (never throws, records `email` sent/failed + attempts) and
  `EmailRetryJob` re-sends `pending`/`failed` rows until `EMAIL_MAX_ATTEMPTS`.
- Modules: `NotificationsCoreModule` (handlers, ports, adapters) is shared; `NotificationsModule`
  adds the controller; `EmailRetryModule` adds the job and is imported only by
  `email-retry-worker.module.ts` / `main.email-retry.ts` (Docker target `email-retry`).
  `pnpm dev` runs the HTTP process and the worker side by side.
- Repository writes are field-targeted (`insert`, `updateEmail`, `markRead`) so the email job
  and the user's "mark as read" never overwrite each other.
- Which event produces which notification lives in
  `application/commands/ticket-event-notifications.ts` (pure, unit-tested). Unknown events are
  ignored, never rejected.
- Recipient email comes from `USER_DIRECTORY` (Logto Management API via M2M client credentials,
  cached 10 min). Without `LOGTO_M2M_APP_ID/SECRET` it uses `NOTIFICATIONS_DEV_FALLBACK_EMAIL`.
- HTTP: `GET /notifications` and `POST /notifications/:id/read` are scoped to the token `sub`;
  foreign ids answer 404. Audience: `NOTIFICATIONS_API_RESOURCE`.
- Env (`.env.example`): `PORT`, `CORS_ORIGIN`, `DATABASE_URL` (notifications-db :5434),
  `LOGTO_*`, `LOGTO_M2M_*`, `NOTIFICATIONS_DEV_FALLBACK_EMAIL`, `RABBITMQ_URL`, `EVENTS_EXCHANGE`,
  `CONSUMER_ENABLED`, `CONSUMER_PREFETCH`, `CONSUMER_DELIVERY_LIMIT`, `SMTP_URL`, `MAIL_FROM`,
  `EMAIL_RETRY_INTERVAL_MS`, `EMAIL_RETRY_DELAY_MS`, `EMAIL_MAX_ATTEMPTS`. Read via `ConfigService`. The dev fallback email is
  ignored when `NODE_ENV=production`.
- Tests: handler specs with the doubles in `infrastructure/testing.ts`; e2e via
  `test/utils/test-auth.ts` (no infra); `test:int` needs notifications-db.
