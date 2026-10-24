-- Publication order for the outbox: database-assigned, monotonic per insert.
ALTER TABLE "outbox_messages" ADD COLUMN "sequence" BIGSERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "outbox_messages_sequence_key" ON "outbox_messages"("sequence");

-- Replace the unpublished index: the relay now orders by sequence.
DROP INDEX "outbox_unpublished_idx";
CREATE INDEX "outbox_unpublished_idx" ON "outbox_messages"("published_at", "sequence");
