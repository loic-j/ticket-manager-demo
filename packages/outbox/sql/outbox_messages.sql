-- Transactional outbox table read by @ticketmanager/outbox's OutboxRelay.
-- Each producing service owns a copy of this table in its own database and ships this DDL in its
-- own migrations (Prisma model: see README.md). Column names and types are the contract between
-- the service's write side and the relay; change them here first, then in every service.
CREATE TABLE "outbox_messages" (
    "id"             UUID         NOT NULL,
    -- Publication order: assigned by the database at insert time.
    "sequence"       BIGSERIAL    NOT NULL,
    "type"           VARCHAR(100) NOT NULL,
    "version"        INTEGER      NOT NULL,
    "aggregate_type" VARCHAR(50)  NOT NULL,
    "aggregate_id"   UUID         NOT NULL,
    -- The whole event envelope, republished verbatim.
    "payload"        JSONB        NOT NULL,
    "occurred_at"    TIMESTAMP(3) NOT NULL,
    "published_at"   TIMESTAMP(3),
    "attempts"       INTEGER      NOT NULL DEFAULT 0,
    "last_error"     TEXT,

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbox_messages_sequence_key" ON "outbox_messages"("sequence");
-- Pending rows only: the relay reads `WHERE published_at IS NULL ... ORDER BY sequence`, and the
-- published majority stays out of the index. Partial indexes cannot be declared in a Prisma
-- schema, so each service ships this statement in a hand-written migration.
CREATE INDEX "outbox_unpublished_idx" ON "outbox_messages"("sequence") WHERE "published_at" IS NULL;
