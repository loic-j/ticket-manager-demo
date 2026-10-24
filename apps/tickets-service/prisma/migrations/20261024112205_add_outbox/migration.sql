-- CreateTable
CREATE TABLE "outbox_messages" (
    "id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL,
    "aggregate_type" VARCHAR(50) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_unpublished_idx" ON "outbox_messages"("published_at", "occurred_at");
