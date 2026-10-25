-- The relay only ever reads pending rows (`published_at IS NULL`, ordered by `sequence`): index
-- those alone so the published majority never enters the index. Hand-written: Prisma cannot
-- express a partial index, so the model in schema.prisma declares no @@index for it.
DROP INDEX "outbox_unpublished_idx";
CREATE INDEX "outbox_unpublished_idx" ON "outbox_messages"("sequence") WHERE "published_at" IS NULL;
