-- DropForeignKey
ALTER TABLE "organization_log_entries" DROP CONSTRAINT "organization_log_entries_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "organization_log_entries" DROP CONSTRAINT "organization_log_entries_userId_fkey";

-- DropTable
DROP TABLE "organization_log_entries";

-- CreateTable
CREATE TABLE "log_entries" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "scope" TEXT NOT NULL,
    "organizationId" TEXT,
    "ownerId" TEXT,
    "userId" TEXT,
    "actorLabel" TEXT,
    "impersonatorId" TEXT,
    "batchId" TEXT,
    "action" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_entry_objects" (
    "id" TEXT NOT NULL,
    "logEntryId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "log_entry_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_batches" (
    "id" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "userId" TEXT,
    "actorLabel" TEXT,
    "description" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "log_entries_organizationId_idx" ON "log_entries"("organizationId");

-- CreateIndex
CREATE INDEX "log_entries_objectType_objectId_idx" ON "log_entries"("objectType", "objectId");

-- CreateIndex
CREATE INDEX "log_entries_scope_sequence_idx" ON "log_entries"("scope", "sequence");

-- CreateIndex
CREATE INDEX "log_entries_ownerId_idx" ON "log_entries"("ownerId");

-- CreateIndex
CREATE INDEX "log_entries_batchId_idx" ON "log_entries"("batchId");

-- CreateIndex
CREATE INDEX "log_entries_sequence_idx" ON "log_entries"("sequence");

-- CreateIndex
CREATE INDEX "log_entry_objects_objectType_objectId_idx" ON "log_entry_objects"("objectType", "objectId");

-- CreateIndex
CREATE INDEX "log_entry_objects_logEntryId_idx" ON "log_entry_objects"("logEntryId");

-- CreateIndex
CREATE INDEX "log_batches_operationKey_startedAt_idx" ON "log_batches"("operationKey", "startedAt");

-- AddForeignKey
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "log_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_entry_objects" ADD CONSTRAINT "log_entry_objects_logEntryId_fkey" FOREIGN KEY ("logEntryId") REFERENCES "log_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_batches" ADD CONSTRAINT "log_batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Exactly one primary ref per entry. Prisma's schema DSL cannot express a
-- partial unique index, so it lives here.
CREATE UNIQUE INDEX "log_entry_objects_primary_unique"
  ON "log_entry_objects" ("logEntryId") WHERE "role" = 'primary';
