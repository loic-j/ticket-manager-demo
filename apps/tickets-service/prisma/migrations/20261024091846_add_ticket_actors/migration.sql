-- Tickets created before actors were tracked are attributed to "system".
ALTER TABLE "tickets"
  ADD COLUMN "created_by" TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN "updated_by" TEXT NOT NULL DEFAULT 'system';

ALTER TABLE "tickets"
  ALTER COLUMN "created_by" DROP DEFAULT,
  ALTER COLUMN "updated_by" DROP DEFAULT;
