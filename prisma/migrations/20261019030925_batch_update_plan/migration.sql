-- CreateEnum
CREATE TYPE "BatchUpdatePlanStatus" AS ENUM ('Pending', 'Executing', 'Completed', 'Failed', 'Superseded');

-- CreateTable
CREATE TABLE "batch_update_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "BatchUpdatePlanStatus" NOT NULL,
    "payload" JSONB NOT NULL,
    "outcomes" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executionStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "logBatchId" TEXT,

    CONSTRAINT "batch_update_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batch_update_plans_organizationId_kind_targetType_targetId__idx" ON "batch_update_plans"("organizationId", "kind", "targetType", "targetId", "status");

-- AddForeignKey
ALTER TABLE "batch_update_plans" ADD CONSTRAINT "batch_update_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_update_plans" ADD CONSTRAINT "batch_update_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
