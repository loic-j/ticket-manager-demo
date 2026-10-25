-- CreateTable
CREATE TABLE "ticket_versions" (
    "ticket_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_versions_pkey" PRIMARY KEY ("ticket_id")
);
