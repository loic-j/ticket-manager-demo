# apps/notifications-service (NestJS 12, ESM, Prisma 7)

Same rules and layout as `apps/tickets-service/CLAUDE.md` (read it first). Specifics:

- Inbound: `src/messaging/presentation/ticket-events.consumer.ts` consumes the **quorum** queue
  `notifications.tickets` (bound to `ticket.#`), dispatches `HandleTicketEventCommand`, acks on
  success, nacks with an exponential backoff (1 s doubling, capped at 30 s) on failure; the broker
  dead-letters after `CONSUMER_DELIVERY_LIMIT` deliveries to `<exchange>.dlx` →
  `notifications.tickets.dead`. Unparsable messages are dead-lettered at once. Handlers run
  concurrently (`CONSUMER_PREFETCH`): no ordering guarantee. Changing queue arguments requires
  deleting the queue first (RabbitMQ refuses to redeclare).
- Idempotency and ordering: `PROCESSED_EVENTS.claim(eventId)` and `TICKET_VERSIONS.advance(ticketId,
version)` run inside `UNIT_OF_WORK.run()` with the notification insert, for **every** known
  ticket event, including those producing no notification (`ticket.deleted`, edits without a
  status change), so a late lower version is `'stale'` whatever the order. A duplicate returns
  `'duplicate'`, an older version `'stale'`, an unknown type or an invalid payload `'ignored'`
  without any write; all are acked. The email is sent after the commit by `EmailDeliveryService`
  (never throws, records `email` sent/failed + attempts, at-least-once) and the email retry
  worker re-sends `pending`/`failed` rows until `EMAIL_MAX_ATTEMPTS`.
- Email retry worker: `presentation/email-retry.job.ts` is a timer dispatching
  `RetryPendingEmailsCommand` through `CommandBus` (handler in `application/commands/`, claims
  `EMAIL_RETRY_BATCH_SIZE` rows with `claimEmailRetryCandidates`). The timer is not `unref()`ed:
  it is what keeps the headless process alive. `EMAIL_RETRY_DELAY_MS` has a lower bound
  (`MIN_EMAIL_RETRY_DELAY_MS`) so a worker never claims a row whose first delivery by the
  consumer is still in progress.
- Modules: `NotificationsCoreModule` (handlers, ports, adapters) is shared; `NotificationsModule`
  adds the controller; `MessagingModule` imports the core module; `EmailRetryModule` adds the job
  and is imported only by `email-retry-worker.module.ts` / `main.email-retry.ts` (Docker target
  `email-retry`). `pnpm dev` runs the HTTP process and the worker side by side. `HealthModule`
  declares the public liveness probe.
- Domain: `domain/notification.ts` owns the model (`Notification` with `Date` fields, the kind and
  delivery-status unions) and imports nothing. `application/mappers/notification.mapper.ts`
  renders the `@ticketmanager/contracts` view (recipient-facing fields, ISO dates) for the read
  side; the Prisma row mapper in `infrastructure/` maps rows ↔ domain with `Date` on both sides.
- Repository writes are field-targeted (`insert`, `updateEmail`, `markRead`) so the email job
  and the user's "mark as read" never overwrite each other.
- Which event produces which notification lives in
  `application/commands/ticket-event-notifications.ts` (pure, unit-tested): payloads are
  validated with the event schemas, computed titles are truncated to the column bound (200).
- Recipient email comes from `USER_DIRECTORY`: `HttpUserDirectory` calls directory-service
  (`GET /users/:id`, `DIRECTORY_API_URL`) with an M2M token for `DIRECTORY_API_RESOURCE` through
  `ServiceHttpClient` from `@ticketmanager/nest-common` (ADR 002). Without
  `LOGTO_M2M_APP_ID/SECRET` (outside production, where they are mandatory) the module binds
  `DevFallbackUserDirectory`, which answers `NOTIFICATIONS_DEV_FALLBACK_EMAIL` for everyone and
  warns once. Both adapters are built by the module factory, not by the injector. Never call the
  Logto Management API from here.
- HTTP: `GET /notifications` and `POST /notifications/:id/read` are scoped to the token `sub`;
  foreign ids answer 404. Audience: `NOTIFICATIONS_API_RESOURCE`.
- Env (`.env.example`): `PORT`, `CORS_ORIGIN`, `DATABASE_URL` (notifications-db :5434),
  `LOGTO_*`, `LOGTO_M2M_*`, `DIRECTORY_API_URL`, `NOTIFICATIONS_DEV_FALLBACK_EMAIL`, `RABBITMQ_URL`, `EVENTS_EXCHANGE`,
  `CONSUMER_ENABLED`, `CONSUMER_PREFETCH`, `CONSUMER_DELIVERY_LIMIT`, `SMTP_URL`, `MAIL_FROM`,
  `EMAIL_RETRY_INTERVAL_MS`, `EMAIL_RETRY_DELAY_MS`, `EMAIL_MAX_ATTEMPTS`. Read via `ConfigService`
  through `readEnv` from `@ticketmanager/nest-common` (`notifications.config.ts`,
  `messaging.config.ts`). The dev fallback email is ignored when `NODE_ENV=production`.
- Tests: handler specs with the doubles in `infrastructure/testing.ts` (`StaticUserProfiles` for
  recipients); e2e via `test/utils/test-auth.ts`, built on `LocalTokenIssuer` from
  `@ticketmanager/nest-common/testing` (no infra); `test:int` needs notifications-db.
