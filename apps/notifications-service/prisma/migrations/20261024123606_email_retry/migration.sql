-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "email_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "email_last_tried_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "notifications_email_retry_idx" ON "notifications"("email", "email_attempts", "created_at");
